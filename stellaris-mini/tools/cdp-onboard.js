/* 截图：新手任务、殖民目标、建造建议、最后通牒 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 9337;
const PROFILE = path.join(os.tmpdir(), 'sm-onboard-' + Date.now());
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?autostart=1&ai=1';
const sleep = ms => new Promise(r => setTimeout(r, ms));

class CDP {
  constructor(url) {
    this.ws = new WebSocket(url); this.id = 0; this.pending = new Map();
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = ev => {
      const m = JSON.parse(ev.data);
      if (m.id) { const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
    };
  }
  async send(method, params) {
    await this.ready; const id = ++this.id;
    return new Promise((res, rej) => { this.pending.set(id, { resolve: res, reject: rej }); this.ws.send(JSON.stringify({ id, method, params: params || {} })); });
  }
}

(async () => {
  const proc = spawn(EDGE, ['--headless=new','--disable-gpu','--hide-scrollbars','--no-first-run','--no-default-browser-check','--remote-debugging-port='+PORT,'--user-data-dir='+PROFILE,'--window-size=1600,900','about:blank'], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) { try { const r = await fetch('http://127.0.0.1:'+PORT+'/json/version'); if (r.ok) break; } catch (e) {} await sleep(250); }
  const list = await (await fetch('http://127.0.0.1:'+PORT+'/json/list')).json();
  const target = list.find(t => t.type === 'page');
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable');
  const ev = async (e) => { const r = await cdp.send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text); return r.result.value; };
  const shot = async n => { const r = await cdp.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(ROOT, n), Buffer.from(r.data, 'base64')); console.log('shot ' + n); };
  try {
    await cdp.send('Page.navigate', { url: URL });
    await sleep(2400);
    await ev('SM.UI.closeModal(true); SM.UI.setSpeed(0)');
    await ev('SM.UI.selectCapital(); SM.UI.setSpeed(1)');
    await sleep(1400);
    await ev('SM.UI.setSpeed(0)');
    await sleep(400);
    await shot('shot-onboard.png');
    await ev('SM.UI.closeModal(true); SM.UI.openQuests()');
    await sleep(400);
    await shot('shot-quests.png');
    // 让科研船调查出可殖民目标
    await ev('SM.UI.closeModal(true); SM.UI.setSpeed(3)');
    await sleep(2600);
    await ev('SM.UI.setSpeed(0)');
    const promptTitle = await ev('document.querySelector(".modal-title") ? document.querySelector(".modal-title").innerText : ""');
    if (promptTitle) await shot('shot-habitable.png');
    await ev('SM.UI.closeModal(true); SM.UI.habitablePrompt=null; SM.UI.firstContactPrompt=null;');
    await sleep(300);
    await ev('SM.UI.openColonyTargets()');
    await sleep(400);
    await shot('shot-targets.png');
    console.log('targets before', await ev('JSON.stringify(Array.from(document.querySelectorAll(".colony-target")).map(function(e){return e.innerText.replace(/\\n/g," | ");}))'));
    // 点击第一个可殖民目标，确认按钮有反馈
    const clicked = await ev('(function(){var b=document.querySelector("[data-action=colonize]:not([disabled])");if(b){b.click();return true;}return false;})()');
    await sleep(500);
    if (clicked) await shot('shot-targets-after.png');
    console.log('colonize clicked', clicked, 'queued', await ev('JSON.stringify(SM.UI.game.colony(SM.UI.player().capital).shipQueue.map(function(q){return {cls:q.cls,target:q.targetPlanetId};}))'));
    console.log('targets now', await ev('JSON.stringify(Array.from(document.querySelectorAll(".colony-target")).map(function(e){return e.innerText.replace(/\\n/g," | ");}))'));
    await ev('SM.UI.closeModal(true)');
    await ev('(function(){var g=SM.UI.game;g.state.pendingUltimatum={from:"e1",to:g.player().id,demand:120,day:g.state.day};SM.UI.openUltimatumModal();})()');
    await sleep(400);
    await shot('shot-ultimatum.png');
    await ev('SM.UI.closeModal(true)');
    await ev('(function(){var g=SM.UI.game;var p=g.player();var a=g.empire("e1");g.state.pendingUltimatum=null;p.contacts[a.id]=true;a.contacts[p.id]=true;g.declareWar(a.id,p.id);})()');
    await sleep(500);
    await shot('shot-warbrief.png');
    console.log('quests:', await ev('document.querySelectorAll(".quest-line").length'));
    console.log('targets:', await ev('document.querySelectorAll(".colony-target").length'));
    console.log('errors:', await ev('document.getElementById("error-banner") ? document.getElementById("error-banner").textContent : "none"'));
  } finally {
    try { await cdp.send('Browser.close'); } catch (e) {}
    proc.kill(); await sleep(300); try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
