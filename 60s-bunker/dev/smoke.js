'use strict';
/* 无浏览器冒烟测试：桩掉 DOM/Canvas，跑生成、抢物资、地堡三轮逻辑 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = ['src/game-core.js', 'src/game-scavenge.js', 'src/game-bunker.js', 'src/game-ui.js'];
const BUNDLE = process.argv[2];
let CODE, SOURCE;
if (BUNDLE) {
  const html = fs.readFileSync(path.join(ROOT, BUNDLE), 'utf8');
  const blocks = (html.match(/<script>[\s\S]*?<\/script>/g) || []).map(s => s.replace(/^<script>/, '').replace(/<\/script>$/, ''));
  if (!blocks.length) throw new Error('单文件版本里没有找到内联脚本');
  CODE = blocks.join('\n;\n');
  SOURCE = BUNDLE + ' (' + blocks.length + ' 个内联脚本)';
} else {
  CODE = FILES.map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n;\n');
  SOURCE = 'src/*.js';
}
console.log('测试目标: ' + SOURCE + '\n');

/* ------------------------------ DOM 桩 ------------------------------ */
function makeCtx() {
  const noop = function () { };
  const target = {
    canvas: { width: 960, height: 600 },
    measureText: function () { return { width: 42 }; },
    createRadialGradient: function () { return { addColorStop: noop }; },
    createLinearGradient: function () { return { addColorStop: noop }; },
    createPattern: function () { return null; },
    setLineDash: noop,
    getImageData: function () { return { data: [] }; }
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string') return noop;
      return undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function makeEl(id, tag) {
  const el = {
    id: id, tagName: (tag || 'div').toUpperCase(), textContent: '', innerHTML: '',
    scrollTop: 0, scrollHeight: 120, style: {}, dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, v) { if (v === undefined) v = !this._s.has(c); if (v) this._s.add(c); else this._s.delete(c); return v; },
      contains(c) { return this._s.has(c); }
    },
    addEventListener() { }, removeEventListener() { },
    appendChild(c) { return c; },
    getContext() { return makeCtx(); },
    getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 600 }; },
    querySelector() { return null; },
    closest() { return null; },
    setAttribute() { }, getAttribute() { return null; },
    click() { }, focus() { }
  };
  return el;
}

const els = {};
const winHandlers = {};
const sandbox = {
  console: console,
  setTimeout: function (fn) { return 0; },
  clearTimeout: function () { },
  requestAnimationFrame: function () { return 1; },
  localStorage: { getItem() { return null; }, setItem() { }, removeItem() { } },
  document: {
    readyState: 'complete',
    getElementById(id) { return els[id] || (els[id] = makeEl(id)); },
    createElement(tag) { return makeEl('created', tag); },
    addEventListener() { },
    body: makeEl('body')
  }
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.__NO_AUTOSTART = true;
sandbox.window.addEventListener = function (type, fn) { (winHandlers[type] = winHandlers[type] || []).push(fn); };
sandbox.window.removeEventListener = function () { };

vm.createContext(sandbox);
vm.runInContext(CODE, sandbox, { filename: 'bundle.js' });

const G = sandbox.window.__GAME;
const errors = [];
function check(cond, msg) { if (!cond) throw new Error(msg); }
function key(k, down) {
  const ev = {
    key: k, code: k === ' ' ? 'Space' : 'Key' + String(k).toUpperCase(),
    preventDefault() { }
  };
  const list = winHandlers[down ? 'keydown' : 'keyup'] || [];
  list.forEach(fn => fn(ev));
}
const CTX = makeCtx();
G.Main.boot();   /* 绑定输入与按钮（桩 DOM），后续测试才收得到键盘事件 */

/* ------------------------------ 1. 房屋生成 ------------------------------ */
(function testHouse() {
  let minItems = 1e9, minFree = 1e9;
  for (let s = 1; s <= 400; s++) {
    const h = G.House.generate(s * 37 + 11);
    check(!h.isBlocked(h.spawn.x, h.spawn.y), 'seed ' + s + ': spawn blocked');
    check(h.reach[h.spawn.x + ',' + h.spawn.y], 'seed ' + s + ': spawn unreachable');
    check(h.reach[h.hatch.x + ',' + h.hatch.y], 'seed ' + s + ': hatch unreachable');
    check(h.family.length === 3, 'seed ' + s + ': family count ' + h.family.length);
    h.items.forEach(it => check(h.reach[it.x + ',' + it.y], 'seed ' + s + ': item cell unreachable'));
    h.family.forEach(f => check(h.reach[f.x + ',' + f.y], 'seed ' + s + ': family cell unreachable'));
    const cells = {};
    h.items.forEach(it => {
      const k = it.x + ',' + it.y;
      check(!cells[k], 'seed ' + s + ': two items on one cell');
      cells[k] = 1;
    });
    check(h.items.filter(i => i.key === 'water').length >= 3, 'seed ' + s + ': <3 water');
    minItems = Math.min(minItems, h.items.length);
    minFree = Math.min(minFree, h.freeReach.length);
  }
  console.log('  [1] 房屋生成 400 个种子 OK · 最少物资 ' + minItems + ' 件 · 最少可达空地 ' + minFree);
})();

/* ------------------------------ 2. 抢物资：超时失败 ------------------------------ */
(function testScavFail() {
  G.Main.setView('play');
  let res = null;
  G.Scav.start(4242, r => { res = r; });
  G.Scav.render(CTX);
  const st = G.Scav.state();
  const x0 = st.px, y0 = st.py;
  const dirs = ['d', 's', 'a', 'w'];
  let moved = false;
  for (let di = 0; di < dirs.length && !moved; di++) {
    key(dirs[di], true);
    for (let i = 0; i < 5; i++) G.Scav.update(0.1);
    key(dirs[di], false);
    if (G.Scav.state().px !== x0 || G.Scav.state().py !== y0) moved = true;
  }
  check(moved, '玩家四个方向都动不了（出生点被卡住）');
  for (let i = 0; i < 700 && !res; i++) {
    G.Scav.update(0.1);
    if (i % 37 === 0) G.Scav.render(CTX);
  }
  check(res && res.success === false, '超时没有判失败');
  check(G.Scav.state().t <= 0.0001, '计时器没有归零');
  console.log('  [2] 60 秒超时判定 OK（未进避难所 → 失败）');
})();

/* ------------------------------ 3. 抢物资：抓取 / 带家人 / 进地堡 ------------------------------ */
(function testScavWin() {
  G.Main.setView('play');
  let res = null;
  G.Scav.start(777, r => { res = r; });
  const st = G.Scav.state();
  const h = G.Scav.houseRef();

  const it = h.items.filter(o => o.key === 'water')[0];
  st.px = (it.x + 0.5) * 24; st.py = (it.y + 0.5) * 24;
  key(' ', true);
  for (let i = 0; i < 8; i++) { G.Scav.update(0.1); G.Scav.render(CTX); }
  key(' ', false);
  check(st.grabbed.length === 1, '按住空格没有抓到东西');
  check(it.taken === true, '物资没有被标记为已拿');

  const fam = h.family[0];
  st.px = fam.px; st.py = fam.py;
  G.Scav.update(0.05);
  key(' ', true);
  G.Scav.update(0.05);
  key(' ', false);
  check(st.following.length === 1, '家人没有跟上');
  for (let i = 0; i < 6; i++) G.Scav.update(0.05);
  check(st.following[0] === fam.id, '跟随的家人 id 不对');

  st.px = (h.hatch.x + 0.5) * 24; st.py = (h.hatch.y + 0.5) * 24;
  G.Scav.update(0.02);
  check(st.nearHatch === true, '没有识别到避难所');
  key('e', true);
  G.Scav.update(0.02);
  key('e', false);
  check(res && res.success === true, '进入避难所没有判成功');
  check(res.grabbed.length === 1 && res.family.length === 1, '结果数据不完整');
  console.log('  [3] 抓取 / 带家人 / 进地堡 OK（剩 ' + res.tLeft.toFixed(1) + ' 秒）');
})();

/* ------------------------------ 4. 地堡跑通 + 结局分布 ------------------------------ */
function randBag(seed) {
  const keys = Object.keys(G.ITEMS);
  const rng = G.Util.mulberry32(seed * 7 + 3);
  const items = [];
  for (let i = 0; i < 12; i++) items.push(keys[Math.floor(rng() * keys.length)]);
  items.push('water', 'water', 'food', 'food');
  const famIds = ['dolores', 'mary', 'timmy'];
  const fam = famIds.filter(() => rng() < 0.62);
  return { items: items, family: fam, tLeft: 40 };
}

function runBunker(seed, opts) {
  const bag = opts.bag || randBag(seed);
  G.Main.setView('bunker');
  G.Bunker.init(bag, seed);
  G.UI.renderBunker();
  let guard = 0;
  while (!G.Bunker.state().ended && guard++ < 500) {
    const S = G.Bunker.state();
    if (S.stage === 'ration') {
      if (opts.useItems) {
        S.inv.slice().forEach(slot => { if (G.ITEMS[slot.key].kind === 'consumable') G.Main.onStageAction('use', slot.key); });
      }
      G.Main.onStageAction('confirm');
    } else if (S.stage === 'event') {
      G.Main.onStageAction('choose', String(Math.floor(S.rng() * S.event.choices.length)));
    } else if (S.stage === 'expedition') {
      const pool = S.members.filter(m => m.alive && m.present);
      if (opts.expedition && pool.length) {
        const best = pool.slice().sort((a, b) => b.hp - a.hp)[0];
        G.Main.onStageAction('exp', best.id);
      } else {
        G.Main.onStageAction('skipexp');
      }
    } else if (S.stage === 'outcome' || S.stage === 'expResult' || S.stage === 'night') {
      G.Main.onStageAction('advance');
    } else {
      throw new Error('未知阶段 ' + S.stage);
    }
  }
  const S = G.Bunker.state();
  check(S.ended, '地堡循环没有结束（可能死循环）');
  check(S.ending && S.ending.reason, '没有结局数据');
  return S;
}

(function testBunker() {
  const stats = {};
  let totalDays = 0, n = 0, noExpDays = 0;
  for (let seed = 1; seed <= 120; seed++) {
    const S = runBunker(seed, { expedition: seed % 5 !== 0, useItems: seed % 3 === 0, bag: randBag(seed) });
    const r = S.ending.reason;
    stats[r] = (stats[r] || 0) + 1;
    totalDays += S.ending.day;
    n++;
  }
  for (let seed = 200; seed <= 220; seed++) {
    const S = runBunker(seed, { expedition: false, bag: randBag(seed) });
    noExpDays += S.ending.day;
  }
  console.log('  [4] 地堡循环 120 局 OK · 结局 ' + JSON.stringify(stats) +
    ' · 平均 ' + (totalDays / n).toFixed(1) + ' 天');
  console.log('      从不外出探险的 21 局平均只撑到 ' + (noExpDays / 21).toFixed(1) + ' 天');
})();

/* ------------------------------ 5. 极端输入 ------------------------------ */
(function testEdge() {
  /* 空手下来 */
  let S = runBunker(9, { bag: { items: [], family: [], tLeft: 0 }, expedition: true, useItems: true });
  check(S.ended, '空手袋没有结束');

  /* 全都带下来 */
  S = runBunker(11, { bag: { items: ['water', 'water', 'food', 'food', 'food', 'radio', 'rifle', 'mask', 'tools', 'flash', 'map', 'firstaid', 'meds', 'cards', 'teddy', 'smokes', 'soap', 'fish', 'choco'], family: ['dolores', 'mary', 'timmy'], tLeft: 55 }, expedition: true, useItems: true });
  check(S.members.filter(m => m.present).length === 4, '四人全员在场');

  /* 所有事件牌至少能跑一遍 */
  for (let i = 0; i < G.EVENTS.length; i++) {
    const ev = G.EVENTS[i];
    ev.choices.forEach((c, ci) => {
      G.Bunker.init({ items: ['water', 'food', 'food', 'water', 'smokes', 'cards', 'meds', 'firstaid'], family: ['dolores', 'mary', 'timmy'], tLeft: 50 }, 500 + i * 3 + ci);
      const st = G.Bunker.state();
      st.stage = 'event';
      st.event = ev;
      G.Bunker.choose(ci);
      check(G.Bunker.state().stage === 'outcome' || G.Bunker.state().ended, '事件 ' + ev.id + ' 选择 ' + ci + ' 没有产生结果');
    });
  }

  /* UI 字符串生成不炸 */
  G.Main.setView('bunker');
  G.Bunker.init({ items: ['water', 'food', 'radio'], family: ['mary'], tLeft: 30 }, 77);
  G.UI.renderBunker();
  G.UI.hud();
  check(els['stage'].innerHTML.length > 50, '舞台 HTML 为空');
  console.log('  [5] 空手 / 满配 / 全部事件牌 / UI 渲染 OK（' + G.EVENTS.length + ' 张事件牌）');
})();

/* ------------------------------ 6. 主流程 ------------------------------ */
(function testBoot() {
  G.UI.show('title');
  check(els['screen-title'].classList.contains('active'), 'UI.show 没切到标题页');
  G.Main.startGame();
  check(els['screen-play'].classList.contains('active'), '开始游戏后应进入抢物资页');
  check(!!G.Scav.state(), '没有生成抢物资场景');
  G.Main.setView('bunker');
  G.Main.onStageAction('ration', 'ted:food');
  console.log('  [6] Main.boot / startGame / 屏幕切换 OK');
})();

console.log('\n全部通过 ✅');
