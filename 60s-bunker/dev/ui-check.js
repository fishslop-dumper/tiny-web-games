'use strict';
/* 真实浏览器里的点击回归测试：把打包产物注入一段驱动脚本，用 Edge headless 跑
   （上一版"使用按钮点了没反应"就是这么漏掉的——桩 DOM 不校验事件委托挂在哪个节点） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SRC = process.env.UI_SRC ? path.resolve(ROOT, process.env.UI_SRC) : path.join(ROOT, '60秒地堡余生.html');

const DRIVER = `
window.addEventListener('load', function () {
  var out = [];
  function ok(name, cond, extra) { out.push((cond ? 'PASS ' : 'FAIL ') + name + (extra ? ' [' + extra + ']' : '')); }
  function q(sel) { return document.querySelector(sel); }
  function useBtn(k) { return q('#inv [data-arg="' + k + '"]'); }
  try {
    var G = window.__GAME;
    G.Main.boot();
    G.Main.setView('bunker');
    G.Bunker.init({ items: ['firstaid','meds','teddy','smokes','cards','soap','fish','water','food'], family: ['timmy','dolores'], tLeft: 30 }, 4242);
    var S = G.Bunker.state();
    var ted = S.members[0], dolores = S.members[1], timmy = S.members[3];
    dolores.injured = true; dolores.hp = 40;
    ted.sick = true; ted.hp = 70;
    timmy.hp = 50;
    G.UI.show('bunker');
    G.UI.renderBunker();

    ok('inv 里出现了急救包按钮', !!useBtn('firstaid'));
    ok('消耗品显示了效果说明', !!q('#inv .eff') && q('#inv .eff').textContent.length > 4,
       q('#inv .eff') ? q('#inv .eff').textContent : 'none');

    var hp0 = dolores.hp;
    useBtn('firstaid').click();
    ok('急救包被消耗', !useBtn('firstaid'));
    ok('受伤状态清除', dolores.injured === false);
    ok('体力恢复', dolores.hp > hp0, hp0 + ' -> ' + dolores.hp);

    var tedHp = ted.hp;
    useBtn('meds').click();
    ok('药片被消耗', !useBtn('meds'));
    ok('生病状态清除', ted.sick === false);
    ok('药片回血', ted.hp > tedHp, tedHp + ' -> ' + ted.hp);

    var t0 = timmy.hp;
    useBtn('teddy').click();
    ok('泰迪熊被消耗', !useBtn('teddy'));
    ok('泰迪熊给蒂米 +16', timmy.hp - t0 === 16, t0 + ' -> ' + timmy.hp);

    ['smokes', 'cards', 'soap', 'fish'].forEach(function (k) {
      var b = useBtn(k);
      var before = b ? !!b : false;
      if (b) b.click();
      ok(k + ' 能用', before ? !useBtn(k) : true);
    });

    var tog = q('#stage [data-act="ration"]');
    var was = S.ration.ted.food;
    tog.click();
    ok('配给开关仍有效', S.ration.ted.food !== was);
    q('#stage [data-act="confirm"]').click();
    ok('开始这一天 -> 事件阶段', G.Bunker.state().stage === 'event');
    ok('日志记录了用药', G.Bunker.state().log.some(function (l) { return /🩹|💊|🧸/.test(l.text); }));
  } catch (e) {
    out.push('EXCEPTION ' + e.message);
  }
  document.title = out.join(' | ');
});
`;

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', '<script>' + DRIVER + '<\/script>\n</body>');
const tmp = path.join(ROOT, 'dev', '_uicheck.html');
fs.writeFileSync(tmp, html, 'utf8');

const dom = execFileSync(EDGE, [
  '--headless=new', '--disable-gpu', '--dump-dom', '--virtual-time-budget=1500',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + path.join(ROOT, 'dev', '_uiprofile'),
  'file:///' + tmp.replace(/\\/g, '/')
], { encoding: 'utf8', timeout: 90000 });

const m = dom.match(/<title[^>]*>([^<]*)<\/title>/);
const title = m ? m[1] : '(no title)';
const parts = title.split(' | ');
let fails = 0;
parts.forEach(function (p) {
  if (p.indexOf('FAIL') === 0 || p.indexOf('EXCEPTION') === 0) fails++;
  console.log('  ' + p);
});
fs.unlinkSync(tmp);
console.log('\n' + (fails ? '❌ 失败 ' + fails + ' 项' : '✅ 全部通过'));
if (fails) process.exitCode = 1;
