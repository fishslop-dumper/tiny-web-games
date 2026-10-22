/* 无头模拟：Node 中加载引擎，用脚本 AI 打一局，检查崩溃 / 数值爆炸 / 存活曲线 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, Math, JSON, Date, Set, Map, isNaN, parseInt, parseFloat, Infinity, NaN };
vm.createContext(ctx);
for (const f of ['data.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const FW = ctx.FW;
const N = FW.CFG.SECTORS, R = FW.CFG.RINGS;

function freeTiles(g, need) {
  const out = [];
  for (let r = 1; r <= R; r++) {
    for (let s = 0; s < N; s++) {
      const t = g.tile(r, s);
      if (!t || t.kind) continue;
      if (need) { if (t.feat !== need) continue; } else if (t.feat) continue;
      out.push(t);
    }
  }
  return out;
}

function place(g, type) {
  const def = FW.BLD[type];
  if (!def || !g.canAfford(def.cost)) return null;
  let best = null, bestScore = 1e9, bestPath = null;
  for (const t of freeTiles(g, def.need)) {
    let p = null;
    if (!g.isConnected(t)) { p = g.pathRoads(t.r, t.s); if (!p) continue; }
    const score = t.r * 8 + (p ? p.length : 0);
    if (score < bestScore) { bestScore = score; best = t; bestPath = p; }
  }
  if (!best) return null;
  if (bestPath) for (const p of bestPath) { const tt = g.tile(p.r, p.s); if (tt && !tt.kind && !tt.feat) g.placeRaw('road', p.r, p.s); }
  g.afterChange();
  const res = g.build(type, best.r, best.s);
  return res.ok ? best : null;
}

function count(g) {
  const c = {};
  for (const b of g.state.buildings) c[b.type] = (c[b.type] || 0) + 1;
  return c;
}

function plan(g) {
  const S = g.state;
  const c = count(g);
  const acts = [];
  const want = (t) => { if (place(g, t)) { acts.push(t); return true; } return false; };

  if (!c.coalmine) want('coalmine');
  if (!c.sawmill) want('sawmill');
  if (!c.cookhouse && S.res.wood > 40) want('cookhouse');
  if (!c.hunter) want('hunter');
  if (!c.medical && S.sick > 3) want('medical');
  if (!c.workshop && S.res.wood > 50) want('workshop');

  // 住房
  for (let i = 0; i < 6; i++) {
    const H = g.housing();
    if (H.cap >= S.pop + 6) break;
    if (!want('tent')) break;
  }
  // 食物链
  if (S.res.raw < 60 && (c.hunter || 0) < 4) want('hunter');
  if (S.res.meal < 120 && (c.cookhouse || 0) < 3) want('cookhouse');
  // 煤
  if (S.res.coal < 160 && (c.coalmine || 0) < 3) want('coalmine');
  // 钢材/木材
  if (S.res.steel < 40 && (c.steelworks || 0) < 2) want('steelworks');
  if (S.res.wood < 60 && (c.sawmill || 0) < 3) want('sawmill');
  // 医疗
  if (S.sick > 8 && (c.medical || 0) < 4) want('medical');
  if ((c.workshop || 0) < 2 && S.rp > 120) want('workshop');
  if ((c.medical || 0) < 3 && S.pop > 90 && S.res.wood > 80) want('medical');
  return acts;
}

function research(g) {
  for (const id of FW.TECH_ORDER) {
    const c = g.canResearch(id);
    if (c.ok) { g.research(id); return id; }
  }
  return null;
}

const seed = Number(process.argv[2] || 20260217);
const difficulty = process.argv[3] || 'normal';
const g = new FW.Game({ seed, difficulty });

function line(tag) {
  const s = g.stats();
  console.log(
    tag.padEnd(4) + ' D' + String(s.day).padStart(2) +
    ' ' + String(Math.round(s.hour)).padStart(2) + 'h ' +
    '人' + String(s.pop).padStart(3) + ' 病' + String(s.sick).padStart(3) +
    ' 希' + String(s.hope).padStart(3) + ' 怨' + String(s.discontent).padStart(3) +
    ' | 煤' + String(s.coal).padStart(4) + ' 木' + String(s.wood).padStart(4) + ' 钢' + String(s.steel).padStart(3) +
    ' 生' + String(s.raw).padStart(3) + ' 餐' + String(s.meal).padStart(3) +
    ' | 建' + String(s.buildings).padStart(2) + ' 屋' + s.homes + '/' + s.cap +
    ' 暖' + s.warm + ' 冷' + s.cold + ' 无家' + s.homeless +
    ' | 温' + s.temp + ' 供热' + s.heat + ' 档' + s.genLevel + '/' + g.state.genCap +
    ' RP' + s.rp + ' 闲' + s.free
  );
}

line('开局');
const t0 = Date.now();
let steps = 0;
try {
  for (let day = 1; day <= 24; day++) {
    // 每天做规划
    for (let i = 0; i < 8; i++) { const a = plan(g); if (!a.length) break; }
    let r = research(g);
    if (r) console.log('  研究:', r, FW.TECHS[r].name);
    // 发电机档位
    const S = g.state;
    if (S.res.coal > 220 && S.gen.level < g.state.genCap && S.day > 3) { g.setGenLevel(S.gen.level + 1); console.log('  发电机升档 ->', S.gen.level); }
    if (S.res.coal < 70 && S.gen.level > 0) { g.setGenLevel(S.gen.level - 1); console.log('  发电机降档 ->', S.gen.level); }
    // 过载
    g.setOverdrive(S.weather.temp <= -55 && S.res.coal > 120);
    if (S.res.meal === 0 && S.res.coal > 60) { /* 保留 */ }
    for (let h = 0; h < 24; h++) {
      g.advance(1);
      steps++;
      while (S.queue.length) {
        const ev = S.queue[0];
        console.log('  事件:', ev.title, '->', ev.choices[0].label);
        g.resolveEvent(0);
      }
      if (S.gameOver) break;
    }
    if (g.state.day % 2 === 0) line('D' + g.state.day);
    if (S.gameOver) break;
  }
} catch (err) {
  console.error('崩溃于 day ' + g.state.day + ' hour ' + g.state.hour);
  console.error(err.stack);
  process.exit(1);
}
console.log('\n耗时 ' + (Date.now() - t0) + 'ms, 步数 ' + steps);
line('结束');
console.log('结局:', g.state.gameOver || '存活到末段', '| 科技', Object.keys(g.state.techs).length, '| 建筑', g.state.buildings.length);

// 数值卫生检查
let bad = 0;
const S = g.state;
for (const k in S.res) if (!isFinite(S.res[k]) || S.res[k] < 0) { console.log('资源异常', k, S.res[k]); bad++; }
if (!isFinite(S.pop) || S.pop < 0) { console.log('人口异常', S.pop); bad++; }
if (!isFinite(S.hope) || !isFinite(S.discontent)) { console.log('情绪异常', S.hope, S.discontent); bad++; }
for (const b of S.buildings) if (!isFinite(b.workers) || b.workers < 0) { console.log('职工异常', b.type, b.workers); bad++; }
console.log('数值异常数:', bad);
console.log('最后日志:');
for (const l of S.log.slice(-12)) console.log('  [D' + l.day + '] ' + l.text);
