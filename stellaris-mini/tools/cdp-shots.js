/* 生成多张 UI 截图：中期、科技弹窗、银河远景、战斗、结算 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 9334;
const PROFILE = path.join(os.tmpdir(), 'sm-shots-' + Date.now());
const PAGE_URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?autostart=1&ai=1&ff=5400';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id) {
        const p = this.pending.get(m.id);
        if (!p) return;
        this.pending.delete(m.id);
        if (m.error) p.reject(new Error(m.error.message)); else p.resolve(m.result);
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
}

(async () => {
  const proc = spawn(EDGE, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--remote-debugging-port=' + PORT, '--user-data-dir=' + PROFILE, '--window-size=1600,900', 'about:blank'
  ], { stdio: 'ignore' });
  let ok = false;
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/version');
      if (r.ok) { ok = true; break; }
    } catch (e) {}
    await sleep(250);
  }
  if (!ok) throw new Error('CDP not ready');
  const list = await (await fetch('http://127.0.0.1:' + PORT + '/json/list')).json();
  const target = list.find(t => t.type === 'page');
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  const ev = async (expr) => {
    const r = await cdp.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error('Eval: ' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description));
    return r.result.value;
  };
  const shot = async (name) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(ROOT, name), Buffer.from(r.data, 'base64'));
    console.log('shot ' + name);
  };

  try {
    await cdp.send('Page.navigate', { url: PAGE_URL });
    await sleep(2400);
    await ev('SM.UI.closeModal(true); SM.UI.habitablePrompt=null; SM.UI.firstContactPrompt=null; SM.UI.warBriefing=null; SM.UI.techPrompt=null; SM.UI.game.state.pendingEvent=null; SM.UI.game.state.pendingUltimatum=null; SM.UI.game.state.pendingPeace=null;');
    // 中期概览：选中首都
    await ev('SM.UI.selectCapital(); SM.UI.setSpeed(0)');
    await sleep(400);
    await shot('shot-mid.png');
    // 科技弹窗
    await ev('SM.UI.openTechModal("engineering")');
    await sleep(400);
    await shot('shot-tech.png');
    await ev('SM.UI.closeModal(true)');
    // 远景银河
    await ev('SM.UI.select(null); SM.UI.camera.x=0; SM.UI.camera.y=0; SM.UI.camera.zoom=0.30;');
    await sleep(500);
    await shot('shot-galaxy.png');
    // 战斗
    const war = await ev(`(function(){
      var g=SM.UI.game,p=g.player();
      var enemies=g.state.empires.filter(function(e){return e.alive&&e.id!==p.id;});
      enemies.sort(function(a,b){return g.empireColonyCount(b)-g.empireColonyCount(a);});
      var e=enemies[0]; if(!e) return {ok:false,reason:'no enemy'};
      p.contacts[e.id]=true; e.contacts[p.id]=true;
      if(!g.isAtWar(p.id,e.id)) { if(g.truceUntil(p.id,e.id)>g.state.day) g.state.truces[g.diploKey(p.id,e.id)]=0; var r=g.declareWar(p.id,e.id,true); if(!r.ok) return {ok:false,reason:r.reason}; }
      var fleet=g.combatFleets(p)[0];
      if(!fleet){ fleet=g.createFleet(p,g.colony(p.capital).systemId,[],{name:'测试舰队',kind:'combat'}); }
      while(fleet.ships.length<10) fleet.ships.push(g.makeShip('cruiser',p));
      var cap=g.colony(e.capital); if(!cap) return {ok:false,reason:'no cap'};
      fleet.systemId=cap.systemId; fleet.travel=null; fleet.path=[]; fleet.mission=null;
      SM.UI.selectFleet(fleet.id); SM.UI.selectSystem(cap.systemId); SM.UI.centerOnSystem(cap.systemId,1.0);
      SM.UI.setSpeed(3);
      return {ok:true,sys:cap.systemId,name:g.system(cap.systemId).name};
    })()`);
    console.log('war setup', JSON.stringify(war));
    await sleep(5000);
    await ev('SM.UI.setSpeed(0)');
    await sleep(300);
    await shot('shot-battle.png');
    // 结算弹窗
    await ev('SM.UI.closeModal(true); SM.UI.game.state.gameOver={type:"score",day:SM.UI.game.state.day}; SM.UI.openGameOver();');
    await sleep(500);
    await shot('shot-score.png');
    console.log('error banner:', await ev('document.getElementById("error-banner") ? document.getElementById("error-banner").textContent : "none"'));
  } finally {
    try { await cdp.send('Browser.close'); } catch (e) {}
    proc.kill();
    await sleep(400);
    try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(err => { console.error(err.stack || err); process.exit(1); });
