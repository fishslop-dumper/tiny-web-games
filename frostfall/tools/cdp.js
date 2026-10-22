/* 用 CDP 驱动 headless Edge：载入游戏、注入操作、截图、收集 console 错误
   用法： node tools/cdp.js [场景名]
   依赖： Node 22+ 自带 WebSocket / fetch */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PAGE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const PORT = 9333;
const SCEN = process.argv[2] || 'basic';
const OUT = path.join(ROOT, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'fw-edge-' + Date.now()),
    '--window-size=1600,900',
    'about:blank'
  ];
  const proc = spawn(EDGE, args, { stdio: 'ignore' });
  for (let i = 0; i < 80; i++) {
    await sleep(250);
    try {
      const r = await fetch('http://127.0.0.1:' + PORT + '/json/list');
      const list = await r.json();
      const page = list.find((t) => t.type === 'page');
      if (page) return { proc, ws: page.webSocketDebuggerUrl };
    } catch (e) { /* not ready */ }
  }
  throw new Error('CDP 未就绪');
}

function client(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let id = 0;
  const pending = new Map();
  const events = [];
  const ready = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(JSON.stringify(msg.error)));
      else res(msg.result);
    } else if (msg.method) {
      events.push(msg);
    }
  };
  const send = (method, params) => {
    const mid = ++id;
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    return new Promise((res, rej) => {
      pending.set(mid, { res, rej });
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('timeout ' + method)); } }, 30000);
    });
  };
  return { send, events, ready, close: () => ws.close() };
}

(async () => {
  const { proc, ws } = await launch();
  const cd = client(ws);
  await cd.ready;
  const errors = [];
  await cd.send('Runtime.enable');
  await cd.send('Log.enable');
  await cd.send('Page.enable');

  const evalJS = async (expr) => {
    const r = await cd.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('JS 异常: ' + ((d.exception && d.exception.description) || d.text));
    }
    return r.result.value;
  };

  await cd.send('Page.navigate', { url: PAGE + '#play' });
  await sleep(400);
  try {
    await cd.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 900, deviceScaleFactor: 1, mobile: false });
  } catch (e) { console.log('设置视口失败', e.message); }
  await sleep(2000);

  const alive = await evalJS('!!window.__fw && !!window.__fw.game');
  console.log('游戏实例存在:', alive);

  const lib = Object.assign({}, require('./scenarios.js'),
    fs.existsSync(path.join(__dirname, 'diag.js')) ? require('./diag.js') : {});
  const scenario = lib[SCEN];
  if (!scenario) throw new Error('未知场景 ' + SCEN);
  await scenario(evalJS, sleep);

  for (const e of cd.events) {
    if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') errors.push(e.params.entry.text);
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      errors.push(e.params.args.map((a) => a.value || a.description).join(' '));
    }
    if (e.method === 'Runtime.exceptionThrown') errors.push(e.params.exceptionDetails.text + ' ' + ((e.params.exceptionDetails.exception || {}).description));
  }
  console.log('错误数:', errors.length);
  errors.slice(0, 12).forEach((e) => console.log('  !', String(e).slice(0, 400)));

  const shot = await cd.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(OUT, SCEN + '.png');
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log('截图:', file);

  cd.close();
  proc.kill();
  process.exit(0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
