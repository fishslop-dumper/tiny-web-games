/* 截图：殖民地总览、战争指挥、星图殖民地标识 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 9338;
const PROFILE = path.join(os.tmpdir(), 'sm-war-' + Date.now());
const URL = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/') + '?autostart=1&ai=1&ff=3600';
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
    await sleep(2600);
    await ev('SM.UI.closeModal(true); SM.UI.habitablePrompt=null; SM.UI.firstContactPrompt=null; SM.UI.warBriefing=null; SM.UI.techPrompt=null; SM.UI.game.state.pendingEvent=null; SM.UI.game.state.pendingUltimatum=null; SM.UI.game.state.pendingPeace=null; SM.UI.selectCapital(); SM.UI.setSpeed(0);');
    await sleep(400);
    await ev('SM.UI.openColonyManager()');
    await sleep(450);
    await shot('shot-colonymanager.png');
    console.log('colonies', await ev('document.querySelectorAll(".mgr-colony").length'));
    await ev('SM.UI.closeModal(true)');
    await ev('(function(){var g=SM.UI.game,p=g.player();var e=g.empire("e1");p.contacts[e.id]=true;e.contacts[p.id]=true;g.state.truces[g.diploKey(p.id,e.id)]=0;p.resources.influence=100;if(!g.isAtWar(p.id,e.id))g.declareWar(p.id,e.id,true);})()');
    await sleep(400);
    await ev('SM.UI.openWarRoom()');
    await sleep(450);
    await shot('shot-warroom.png');
    console.log('targets', await ev('document.querySelectorAll(".war-target").length'), 'fleets', await ev('document.querySelectorAll(".war-fleet").length'));
    await ev('SM.UI.closeModal(true); SM.UI.select(null); SM.UI.camera.x=0; SM.UI.camera.y=0; SM.UI.camera.zoom=0.32;');
    await sleep(600);
    await shot('shot-colonymap.png');
    // 被占领殖民地面板
    await ev(`(function(){
      var g=SM.UI.game,p=g.player();
      var c=g.colony(p.colonies[1]||p.capital);
      p.contacts["e1"]=true;g.empire("e1").contacts[p.id]=true;
      g.state.truces[g.diploKey(p.id,"e1")]=0;
      if(!g.isAtWar(p.id,"e1")) g.declareWar("e1",p.id,true);
      c.occupiedBy="e1";
      SM.UI.closeModal(true); SM.UI.selectPlanet(c.planetId); SM.UI.camera.zoom=1.0; SM.UI.centerOnSystem(c.systemId,1.0);
    })()`);
    await sleep(600);
    await shot('shot-occupied.png');
    console.log('errors:', await ev('document.getElementById("error-banner") ? document.getElementById("error-banner").textContent : "none"'));
  } finally {
    try { await cdp.send('Browser.close'); } catch (e) {}
    proc.kill(); await sleep(300); try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
