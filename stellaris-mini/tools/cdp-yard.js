/* 截图：新帝国船坞、首都星标 */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PORT = 9336;
const PROFILE = path.join(os.tmpdir(), 'sm-yard-' + Date.now());
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
    await sleep(2400);
    await ev('SM.UI.closeModal(true); SM.UI.habitablePrompt=null; SM.UI.firstContactPrompt=null; SM.UI.warBriefing=null; SM.UI.techPrompt=null; SM.UI.game.state.pendingEvent=null; SM.UI.game.state.pendingUltimatum=null; SM.UI.game.state.pendingPeace=null; SM.UI.setSpeed(0)');
    await sleep(300);
    await ev('SM.UI.selectCapital(); SM.UI.camera.zoom = 0.85;');
    await sleep(500);
    await shot('shot-capital.png');
    await ev('SM.UI.openShipyard()');
    await sleep(500);
    await shot('shot-yard.png');
    // 切换到第二座殖民地（如果有）
    const switched = await ev('(function(){var b=document.querySelectorAll("[data-yard-colony]")[1];if(b){b.click();return true;}return false;})()');
    await sleep(400);
    if (switched) await shot('shot-yard2.png');
    console.log('colonies', await ev('SM.UI.player().colonies.length'), 'modal', await ev('document.querySelector(".modal-title").innerText'));
    console.log('errors:', await ev('document.getElementById("error-banner") ? document.getElementById("error-banner").textContent : "none"'));
  } finally {
    try { await cdp.send('Browser.close'); } catch (e) {}
    proc.kill(); await sleep(300); try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) {}
  }
})().catch(e => { console.error(e.stack || e); process.exit(1); });
