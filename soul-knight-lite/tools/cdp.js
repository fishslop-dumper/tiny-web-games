/* 用 CDP 驱动 headless Edge：载入游戏、注入操作、截图、收集 console 错误
   用法： node tools/cdp.js [场景名...]
   依赖： Node 22+ 自带 WebSocket / fetch */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const ROOT = path.join(__dirname, '..');
const PAGE = 'file:///' + path.join(ROOT, 'index.html').replace(/\\/g, '/');
const PORT = 9344;
const OUT = path.join(ROOT, 'shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch() {
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
    '--remote-debugging-port=' + PORT,
    '--user-data-dir=' + path.join(process.env.TEMP || '.', 'sk-edge-profile'),
    '--window-size=1400,820',
    '--allow-file-access-from-files',
    'about:blank'
  ];
  const proc = spawn(EDGE, args, { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) {
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
      setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('timeout ' + method)); } }, 20000);
    });
  };
  return { send, events, ready, close: () => ws.close() };
}

(async () => {
  const scenNames = process.argv.slice(2);
  const names = scenNames.length ? scenNames : ['title'];
  const { proc, ws } = await launch();
  const cd = client(ws);
  await cd.ready;
  const errors = [];
  await cd.send('Runtime.enable');
  await cd.send('Log.enable');
  await cd.send('Page.enable');
  cd.events.length = 0;

  const pausedStacks = [];
  const watchPause = setInterval(() => {
    for (const e of cd.events) {
      if (e.method === 'Debugger.paused' && !e.__seen) {
        e.__seen = true;
        const frames = (e.params.callFrames || []).slice(0, 8).map((f) =>
          (f.functionName || '<anon>') + ' @' + (f.url || '').split('/').pop() + ':' + (f.location.lineNumber + 1));
        pausedStacks.push(frames);
        console.log('!! 主线程卡在这里:\n  ' + frames.join('\n  '));
      }
    }
  }, 400);

  const evalJS = async (expr) => {
    let r;
    try {
      r = await cd.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    } catch (e) {
      try { await cd.send('Debugger.pause'); } catch (e2) { /* ignore */ }
      throw new Error('evaluate 失败: ' + e.message + ' | expr=' + String(expr).slice(0, 160));
    }
    if (r.exceptionDetails) {
      const d = r.exceptionDetails;
      throw new Error('JS 异常: ' + ((d.exception && d.exception.description) || d.text) + ' | expr=' + String(expr).slice(0, 160));
    }
    return r.result.value;
  };

  await cd.send('Page.navigate', { url: PAGE });
  await sleep(1800);

  const alive = await evalJS('!!window.SK && !!window.SK.game');
  console.log('游戏实例存在:', alive);

  const scenario = require('./scenarios.js');
  const T = {
    async key(type, code, keyStr, vk) {
      await cd.send('Input.dispatchKeyEvent', {
        type: type, code: code, key: keyStr,
        windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk
      });
    },
    async mouse(type, x, y, button) {
      await cd.send('Input.dispatchMouseEvent', {
        type: type, x: Math.round(x), y: Math.round(y),
        button: button || 'left', clickCount: 1, buttons: type === 'mousePressed' ? 1 : 0
      });
    }
  };
  for (const name of names) {
    const fn = scenario[name];
    if (!fn) { console.log('未知场景', name); continue; }
    try {
      await fn(evalJS, sleep, T);
    } catch (e) {
      console.log('场景失败 [' + name + ']:', e.message);
      continue;
    }
    const shot = await cd.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(OUT, name + '.png');
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
    console.log('截图:', file);
  }

  for (const e of cd.events) {
    if (e.method === 'Log.entryAdded' && e.params.entry.level === 'error') errors.push(e.params.entry.text);
    if (e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error') {
      errors.push(e.params.args.map((a) => a.value || a.description).join(' '));
    }
    if (e.method === 'Runtime.exceptionThrown') {
      const d = e.params.exceptionDetails;
      errors.push(d.text + ' ' + ((d.exception || {}).description || ''));
    }
  }
  console.log('错误数:', errors.length);
  errors.slice(0, 14).forEach((e) => console.log('  !', String(e).slice(0, 400)));

  await sleep(600);
  clearInterval(watchPause);
  cd.close();
  proc.kill();
  process.exit(0);
})().catch((e) => { console.error('FAILED', e); process.exit(1); });
