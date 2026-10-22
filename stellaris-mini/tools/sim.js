/* 无头模拟：在 Node 中加载引擎，跑完整局，捕捉异常并输出节奏数据 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = {
  console,
  Math,
  JSON,
  Date,
  Set,
  Map,
  isNaN,
  parseInt,
  parseFloat,
  Infinity,
  NaN
};
vm.createContext(ctx);
for (const f of ['data.js', 'galaxy.js', 'engine.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const SM = ctx.SM;

function fmt(n) { return (Math.round(n * 10) / 10).toFixed(1); }

function summary(game, label) {
  const s = game.state;
  const date = SM.dateParts(s.day);
  console.log('\n=== ' + label + ' ' + date.year + '.' + date.month + ' ===');
  s.empires.forEach(e => {
    const pop = game.empirePops(e);
    const colonies = game.empireColonyCount(e);
    const inc = e.income;
    console.log(
      (e.isPlayer ? '[玩家] ' : '[AI] ') + e.name.padEnd(8, '　') +
      ' 殖民地 ' + String(colonies).padStart(2) +
      ' 人口 ' + String(pop).padStart(3) +
      ' 科技 ' + String(Object.keys(e.techs).length).padStart(2) +
      ' 舰队力量 ' + String(game.empirePower(e)).padStart(5) +
      ' 矿 ' + fmt(inc.minerals) + ' 能 ' + fmt(inc.energy) + ' 食 ' + fmt(inc.food) +
      ' 合 ' + fmt(inc.alloys) + ' 研 ' + fmt(inc.physics) + '/' + fmt(inc.society) + '/' + fmt(inc.engineering) +
      ' 影响 ' + fmt(inc.influence) + ' 凝 ' + fmt(inc.unity) +
      ' 战争 ' + game.warsFor(e).length +
      (e.alive ? '' : ' [灭亡]')
    );
  });
  console.log('总殖民地 ' + game.totalColonies() + '，已调查星系 ' +
    s.systems.filter(x => x.surveyed && s.empires.some(e => x.surveyed[e.id])).length + '/' + s.systems.length +
    '，空间站 ' + s.systems.reduce((a, x) => a + (x.stations.mining && x.stations.mining.built ? 1 : 0) + (x.stations.research && x.stations.research.built ? 1 : 0), 0) +
    '，战争 ' + s.wars.length);
}

const seed = Number(process.argv[2] || 20260217);
const years = Number(process.argv[3] || 60);
console.log('创建游戏 seed=' + seed);
let game;
try {
  game = new SM.Game({ seed, difficulty: 'normal', aiCount: 3, empireName: '大肥鱼帝国', color: '#4cc9f0', trait: 'industrious' });
} catch (err) {
  console.error('初始化失败');
  console.error(err.stack);
  process.exit(1);
}
summary(game, '开局');
const p = game.player();
console.log('玩家首都:', game.colony(p.capital).name, ' 星系:', game.system(game.colony(p.capital).systemId).name);
console.log('玩家岗位:', JSON.stringify(game.colony(p.capital).jobSlots));
console.log('玩家分配:', JSON.stringify(game.colony(p.capital).assigned));
console.log('玩家收入:', JSON.stringify(p.income));

// 让玩家也由 AI 托管
p.isPlayer = false;

const totalDays = years * SM.DAYS_PER_YEAR;
const t0 = Date.now();
try {
  for (let d = 0; d < totalDays; d++) {
    game.stepDay();
    if (game.state.pendingEvent) game.resolveEvent(0);
    if (game.state.day % (5 * SM.DAYS_PER_YEAR) === 0) summary(game, '进度');
    if (game.state.gameOver) break;
  }
} catch (err) {
  console.error('模拟崩溃于 day ' + game.state.day);
  console.error(err.stack);
  process.exit(1);
}
console.log('\n模拟耗时 ' + (Date.now() - t0) + 'ms, 天数 ' + game.state.day);
summary(game, '结束');
console.log('游戏结束状态:', game.state.gameOver);
console.log('分数榜:', game.scoreBoard());

// 检查 NaN / 负数
let issues = 0;
game.state.empires.forEach(e => {
  Object.keys(e.resources).forEach(k => {
    if (!isFinite(e.resources[k]) || e.resources[k] < 0) { console.log('资源异常', e.name, k, e.resources[k]); issues++; }
  });
});
game.state.colonies.forEach(c => {
  if (!isFinite(c.pops) || c.pops < 0) { console.log('人口异常', c.name, c.pops); issues++; }
  if (!isFinite(c.defense)) { console.log('防御异常', c.name, c.defense); issues++; }
  if (!isFinite(c.starbase.hull)) { console.log('基地异常', c.name, c.starbase.hull); issues++; }
});
game.state.fleets.forEach(f => {
  f.ships.forEach(s => {
    if (!isFinite(s.hull) || !isFinite(s.shield)) { console.log('舰船数值异常', f.name, s.cls, s.hull, s.shield); issues++; }
  });
});
console.log('资源/数值异常数:', issues);
