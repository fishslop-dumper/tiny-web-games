/* CDP 无头浏览器交互测试：启动 Edge、点击 UI、截图 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 9333;
const PROFILE = path.join(os.tmpdir(), 'sm-edge-' + Date.now());
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.handlers = {};
    this.ready = new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(msg.error.message));
          else p.resolve(msg.result);
        }
      } else {
        (this.handlers[msg.method] || []).forEach(fn => fn(msg.params));
      }
    };
  }
  async send(method, params) {
    await this.ready;
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  on(method, fn) { (this.handlers[method] = this.handlers[method] || []).push(fn); }
}

async function main() {
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + PROFILE,
    '--window-size=1600,900',
    'about:blank'
  ], { stdio: 'ignore' });

  let version = null;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (r.ok) { version = await r.json(); break; }
    } catch (e) { /* not ready */ }
    await sleep(250);
  }
  if (!version) throw new Error('Edge CDP 未启动');

  const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  let target = list.find(t => t.type === 'page');
  if (!target) {
    const r = await fetch('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' });
    target = await r.json();
  }
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  async function evalJS(expr) {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      throw new Error('Eval 异常: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text));
    }
    return r.result.value;
  }
  async function shot(name) {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(ROOT, name);
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }

  const results = [];
  function check(name, cond, detail) {
    results.push({ name, ok: !!cond, detail: detail || '' });
    console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));
  }

  try {
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await sleep(1600);
    check('开始界面加载', await evalJS('!!document.getElementById("start-btn")'));
    check('游戏未提前启动', await evalJS('window.__SM_GAME__ === undefined'));

    // 从开始界面进入游戏
    await evalJS('document.getElementById("start-btn").click()');
    await sleep(1200);
    check('点击启程后进入游戏', await evalJS('!!window.__SM_GAME__ && !document.getElementById("game-ui").hidden'));
    check('初始选中首都行星', await evalJS('SM.UI.selected && SM.UI.selected.type === "planet"'));
    const left = await evalJS('document.querySelector("#left-panel").innerText');
    check('左栏显示殖民地管理', /人口/.test(left) && /区划/.test(left), left.slice(0, 60).replace(/\n/g, ' '));
    const err = await evalJS('!!document.getElementById("error-banner")');
    check('无脚本错误banner', !err, err ? await evalJS('document.getElementById("error-banner").textContent') : '');
    // 关闭开场弹窗
    const introStarted = await evalJS('(function(){var b=document.querySelector(".modal-actions .btn.primary");if(b){b.click();return true;}return false;})()');
    await sleep(300);
    check('开场「开始执政」启动游戏', introStarted && !(await evalJS('SM.UI.modalOpen')) && (await evalJS('SM.UI.speed')) === 1);
    await evalJS('SM.UI.setSpeed(0)');
    if (await evalJS('SM.UI.modalOpen')) await evalJS('SM.UI.closeModal(true)');
    await sleep(200);

    // 新手任务与殖民目标
    check('新手任务卡显示', await evalJS('!!document.querySelector(".quest-card") && document.querySelectorAll(".quest-dots i").length >= 7'));
    check('殖民地建造建议卡', /建造建议/.test(await evalJS('document.querySelector("#left-panel").innerText')));
    await evalJS('SM.UI.openQuests()');
    await sleep(250);
    check('任务弹窗列出步骤', (await evalJS('document.querySelectorAll(".quest-line").length')) >= 7);
    await evalJS('SM.UI.closeModal(true)');
    await evalJS('SM.UI.openColonyTargets()');
    await sleep(250);
    check('殖民目标弹窗', /殖民目标/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    await evalJS('SM.UI.closeModal(true)');
    // 首次接触弹窗
    await evalJS('SM.UI.firstContactPrompt = "e1"');
    await sleep(350);
    check('首次接触弹窗', /首次接触|白银|星辉|赤辉|螺旋/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    await evalJS('SM.UI.closeModal(true)');
    // 无战争时的战争指挥
    await evalJS('document.getElementById("btn-war").click()');
    await sleep(350);
    check('无战争时战争指挥显示指南', /当前没有战争/.test(await evalJS('document.querySelector(".modal-body").innerText')));
    await evalJS('SM.UI.closeModal(true)');

    // 研究选择
    await evalJS('document.querySelector("[data-action=open-tech]").click()');
    await sleep(300);
    const modalTitle = await evalJS('document.querySelector(".modal-title") && document.querySelector(".modal-title").innerText');
    check('打开科技选择弹窗', /选择研究项目/.test(modalTitle || ''), modalTitle);
    const techBtn = await evalJS('!!document.querySelector("[data-ttech]")');
    check('科技卡存在', techBtn);
    if (techBtn) {
      await evalJS('document.querySelector("[data-ttech]").click()');
      await sleep(300);
      check('选定科技写入引擎', await evalJS('!!SM.UI.player().research.physics.current || !!SM.UI.player().research.society.current || !!SM.UI.player().research.engineering.current'));
    }
    const modalOpenNow = await evalJS('SM.UI.modalOpen');
    check('选择科技后弹窗关闭', !modalOpenNow);

    // 建造区划
    const beforeMinerals = await evalJS('Math.round(SM.UI.player().resources.minerals)');
    const beforeQueue = await evalJS('SM.UI.game.colony(SM.UI.player().capital).queue.length');
    await evalJS('(function(){var b=document.querySelector("[data-action=build-district]:not([disabled])"); if(b) b.click();})()');
    await sleep(300);
    const afterMinerals = await evalJS('Math.round(SM.UI.player().resources.minerals)');
    const afterQueue = await evalJS('SM.UI.game.colony(SM.UI.player().capital).queue.length');
    check('建造区划扣矿物并进队列', afterMinerals < beforeMinerals && afterQueue > beforeQueue, beforeMinerals + '->' + afterMinerals + ' queue ' + beforeQueue + '->' + afterQueue);
    // 取消建造，返还一半矿物
    const queueBeforeCancel = await evalJS('SM.UI.game.colony(SM.UI.player().capital).queue.length');
    const minBeforeCancel = await evalJS('Math.round(SM.UI.player().resources.minerals)');
    await evalJS('(function(){var b=document.querySelector("[data-action=cancel-build]");if(b)b.click();})()');
    await sleep(300);
    const queueAfterCancel = await evalJS('SM.UI.game.colony(SM.UI.player().capital).queue.length');
    const minAfterCancel = await evalJS('Math.round(SM.UI.player().resources.minerals)');
    check('取消建造并返还矿物', queueAfterCancel < queueBeforeCancel && minAfterCancel > minBeforeCancel, minBeforeCancel + '->' + minAfterCancel);

    // 选中舰队并右键移动
    const fleetId = await evalJS('SM.UI.game.combatFleets(SM.UI.player())[0].id');
    await evalJS('SM.UI.selectFleet(' + JSON.stringify(fleetId) + ')');
    await sleep(200);
    const fleetPanel = await evalJS('document.querySelector("#left-panel").innerText');
    check('舰队面板打开', /指令/.test(fleetPanel) && /编成/.test(fleetPanel), fleetPanel.slice(0, 50).replace(/\n/g, ' '));
    check('舰队面板有攻击入口', /选择攻击目标/.test(fleetPanel));
    const coords = await evalJS('(function(){var g=SM.UI.game;var f=g.fleet(' + JSON.stringify(fleetId) + ');var sys=g.system(f.systemId);var tgt=g.state.systems[sys.lanes[0]];var p=SM.UI.worldToScreen(tgt.x,tgt.y);return {x:p.x,y:p.y,name:tgt.name};})()');
    await evalJS('(function(){var c=document.getElementById("galaxy-canvas");var x=' + coords.x + ',y=' + coords.y + ';c.dispatchEvent(new MouseEvent("contextmenu",{clientX:x,clientY:y,button:2,bubbles:true,cancelable:true}));})()');
    await sleep(300);
    const moving = await evalJS('(function(){var f=SM.UI.game.fleet(' + JSON.stringify(fleetId) + ');return !!(f.travel || f.path.length);})()');
    check('右键命令舰队移动', moving, '目标 ' + coords.name);

    // 左键点击星系
    await evalJS('(function(){var c=document.getElementById("galaxy-canvas");var x=' + coords.x + ',y=' + coords.y + ';c.dispatchEvent(new MouseEvent("mousedown",{clientX:x,clientY:y,button:0,bubbles:true}));window.dispatchEvent(new MouseEvent("mouseup",{clientX:x,clientY:y,button:0,bubbles:true}));})()');
    await sleep(300);
    const clickedSys = await evalJS('SM.UI.selected && SM.UI.selected.type === "system" && SM.UI.selected.id');
    check('左键选择星系', !!clickedSys, String(clickedSys));

    // 外交弹窗
    await evalJS('SM.UI.openDiplomacy()');
    await sleep(250);
    check('外交弹窗', /星际外交/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    await evalJS('SM.UI.closeModal(true)');

    // 船坞
    await evalJS('SM.UI.openShipyard(SM.UI.player().capital)');
    await sleep(250);
    check('船坞弹窗', /帝国船坞/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    check('船坞弹窗标记首都', /首都/.test(await evalJS('document.querySelector(".modal-body").innerText')));
    const alloysBefore = await evalJS('Math.round(SM.UI.player().resources.alloys)');
    await evalJS('(function(){var b=document.querySelectorAll("[data-yard-ship]")[0];if(b)b.click();})()');
    await sleep(350);
    const alloysAfter = await evalJS('Math.round(SM.UI.player().resources.alloys)');
    check('船坞下订单扣合金', alloysAfter < alloysBefore, alloysBefore + '->' + alloysAfter);
    check('船坞刷新无入场动画', await evalJS('document.querySelector(".modal").classList.contains("no-anim")'));
    await evalJS('SM.UI.closeModal(true)');

    // 传统
    await evalJS('SM.UI.openTraditions()');
    await sleep(250);
    check('传统弹窗', /传统/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    const tradCost = await evalJS('SM.UI.game.traditionCost(SM.UI.player(), SM.TRADITIONS[0])');
    check('传统费用随采纳数缩放', tradCost >= 220, String(tradCost));
    await evalJS('SM.UI.closeModal(true)');

    // 存档
    await evalJS('SM.UI.hooks.save()');
    await sleep(300);
    check('保存到 localStorage', await evalJS('(localStorage.getItem(SM.SAVE_KEY)||"").length > 1000'));
    const savedDay = await evalJS('SM.UI.game.state.day');
    await evalJS('SM.UI.hooks.load()');
    await sleep(900);
    check('读取存档恢复日期', await evalJS('SM.UI.game.state.day') === savedDay, savedDay + ' -> ' + await evalJS('SM.UI.game.state.day'));
    check('读取后 UI 仍然可用', await evalJS('!!SM.UI.game && document.getElementById("left-panel").innerText.length > 50'));

    // 运行三秒
    const dayBefore = await evalJS('SM.UI.game.state.day');
    await evalJS('SM.UI.setSpeed(3)');
    await sleep(2600);
    const dayAfter = await evalJS('SM.UI.game.state.day');
    check('时间推进', dayAfter > dayBefore, dayBefore + ' -> ' + dayAfter);
    await evalJS('SM.UI.setSpeed(0)');

    // 事件弹窗（清掉可能已经弹出的 onboarding 弹窗，保证测试确定性）
    await evalJS('SM.UI.closeModal(true); SM.UI.habitablePrompt=null; SM.UI.firstContactPrompt=null; SM.UI.warBriefing=null; SM.UI.techPrompt=null;');
    await evalJS('(function(){var g=SM.UI.game;g.state.pendingEvent={eventId:"trade",empireId:g.player().id};})()');
    await sleep(500);
    check('事件弹窗自动打开', await evalJS('!!document.querySelector("[data-choice]")'));
    await evalJS('(function(){var b=document.querySelectorAll("[data-choice]")[2];if(b)b.click();})()');
    await sleep(300);
    check('事件处理完成', await evalJS('SM.UI.game.state.pendingEvent === null'));
    check('事件链后续已排队', await evalJS('SM.UI.game.state.delayedEvents.some(function(q){return q.eventId === "trade_network";})'));
    check('事件库足够丰富', (await evalJS('SM.EVENTS.length')) >= 25, await evalJS('SM.EVENTS.length'));

    // 底栏快捷入口
    await evalJS('SM.UI.setSpeed(1)');
    await sleep(160);
    await evalJS('document.getElementById("btn-yard").click()');
    await sleep(350);
    check('底栏「船坞」按钮', /帝国船坞/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    await evalJS('SM.UI.closeModal()');
    await sleep(250);
    check('关闭船坞后恢复时间', await evalJS('SM.UI.speed') === 1);
    await evalJS('SM.UI.setSpeed(0)');
    await evalJS('document.getElementById("btn-home").click()');
    await sleep(300);
    const homeSelected = await evalJS('(function(){var p=SM.UI.player();var c=p.capital?SM.UI.game.colony(p.capital):null;return !!(SM.UI.selected&&SM.UI.selected.type==="planet"&&c&&SM.UI.selected.id===c.planetId);})()');
    check('底栏「首都」按钮', homeSelected);

    // 最后通牒：支付赔款避免战争
    await evalJS('SM.UI.closeModal(true)');
    const energyBefore = await evalJS('Math.round(SM.UI.player().resources.energy)');
    await evalJS('(function(){var g=SM.UI.game,p=g.player(),a=g.empire("e1");g.state.pendingUltimatum={from:a.id,to:p.id,demand:50,day:g.state.day};})()');
    await sleep(400);
    check('最后通牒弹窗', /最后通牒|要求赔款/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    await evalJS('document.querySelectorAll(".modal-actions .btn")[0].click()');
    await sleep(350);
    const energyAfter = await evalJS('Math.round(SM.UI.player().resources.energy)');
    check('支付赔款避免战争', energyAfter <= energyBefore - 50 && !(await evalJS('SM.UI.game.isAtWar(SM.UI.player().id, "e1")')), energyBefore + '->' + energyAfter);

    // 截图
    await evalJS('SM.UI.selectFleet(' + JSON.stringify(fleetId) + ')');
    await evalJS('SM.UI.camera.zoom = 0.72');
    await sleep(500);
    const f1 = await shot('shot-ui-test.png');
    console.log('截图: ' + f1);

    // 殖民目标按钮必须真的能点（回归测试）
    const targetSetup = await evalJS(`(function(){
      var g=SM.UI.game,p=g.player(),best=null;
      g.state.systems.forEach(function(s){
        s.planets.forEach(function(pl){
          if(!pl.habitable||pl.colonyId) return;
          s.surveyed[p.id]=true;
          if(!best && g.canColonizeCheck(pl,p).ok) best=pl.id;
        });
      });
      return best;
    })()`);
    await evalJS('SM.UI.closeModal(true); SM.UI.openColonyTargets()');
    await sleep(400);
    const colonizeBtn = await evalJS('!!document.querySelector("[data-action=colonize]:not([disabled])")');
    check('殖民目标有可点按钮', colonizeBtn, targetSetup ? 'target ' + targetSetup : 'no target');
    if (colonizeBtn) {
      const clickedPlanet = await evalJS('document.querySelector("[data-action=colonize]:not([disabled])").dataset.planet');
      await evalJS('document.querySelector("[data-action=colonize]:not([disabled])").click()');
      await sleep(500);
      const queuedTarget = await evalJS('(function(){var q=SM.UI.game.colony(SM.UI.player().capital).shipQueue.find(function(x){return x.cls==="colony";});return q?q.targetPlanetId:null;})()');
      check('点击殖民进入船坞队列', !!queuedTarget, String(queuedTarget));
      check('点击的殖民目标一致', queuedTarget === clickedPlanet, clickedPlanet + ' / ' + queuedTarget);
    } else {
      check('点击殖民进入船坞队列', false, '没有可殖民目标');
      check('点击的殖民目标一致', false, '没有可殖民目标');
    }
    await evalJS('SM.UI.closeModal(true)');

    // 殖民地总览
    await evalJS('document.getElementById("btn-colonies").click()');
    await sleep(350);
    check('殖民地总览弹窗', /殖民地总览/.test(await evalJS('document.querySelector(".modal-title").innerText')));
    check('殖民地列表有内容', (await evalJS('document.querySelectorAll(".mgr-colony").length')) >= 1);
    await evalJS('SM.UI.closeModal(true)');

    // 战争指挥：建立战争 → 选目标 → 派舰队
    const warOk = await evalJS('(function(){var g=SM.UI.game,p=g.player(),e=g.empire("e1");p.contacts[e.id]=true;e.contacts[p.id]=true;g.state.truces[g.diploKey(p.id,e.id)]=0;p.resources.influence=100;return g.declareWar(p.id,e.id,true).ok;})()');
    await sleep(300);
    check('测试战争建立', warOk);
    await evalJS('SM.UI.closeModal(true); document.getElementById("btn-war").click()');
    await sleep(400);
    check('战争指挥列出目标', (await evalJS('document.querySelectorAll(".war-target").length')) >= 1);
    check('战争指挥列出舰队', (await evalJS('document.querySelectorAll(".war-fleet").length')) >= 1);
    const targetSys = await evalJS('(function(){var b=document.querySelector("[data-action=war-attack]:not([disabled])");return b?b.dataset.system:null;})()');
    await evalJS('(function(){var b=document.querySelector("[data-action=war-attack]:not([disabled])");if(b)b.click();})()');
    await sleep(500);
    const warMoved = await evalJS('(function(){var f=SM.UI.game.fleet(SM.UI.warFleetId);return !!(f && (f.travel || f.path.length || f.systemId === ' + JSON.stringify(targetSys) + '));})()');
    check('战争指挥下达攻击命令', !!targetSys && warMoved, '目标 ' + targetSys);
    await evalJS('SM.UI.setSpeed(0)');
    check('底栏殖民地/战争按钮', await evalJS('!!document.getElementById("btn-colonies") && !!document.getElementById("btn-war")'));

    const err2 = await evalJS('!!document.getElementById("error-banner")');
    check('测试结束时无脚本错误', !err2, err2 ? await evalJS('document.getElementById("error-banner").textContent') : '');
  } finally {
    const failed = results.filter(r => !r.ok);
    console.log('\n结果：' + (results.length - failed.length) + '/' + results.length + ' 通过');
    if (failed.length) console.log('失败项: ' + failed.map(f => f.name).join(', '));
    try { await cdp.send('Browser.close'); } catch (e) {}
    proc.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
    process.exitCode = failed.length ? 1 : 0;
  }
}

main().catch(err => {
  console.error(err.stack || err);
  process.exit(1);
});
