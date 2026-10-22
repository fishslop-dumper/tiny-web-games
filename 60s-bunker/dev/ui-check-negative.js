'use strict';
/* 反向验证：把委托悄悄改回 #stage（旧的 bug），确认 ui-check 能抓出来 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const src = path.join(ROOT, '60秒地堡余生.html');
const bad = path.join(ROOT, 'dev', '_broken.html');

let html = fs.readFileSync(src, 'utf8');
const needle = "UI.bind($('screen-bunker'), onStageAction);";
if (html.indexOf(needle) < 0) throw new Error('没找到绑定语句，测试脚本需要更新');
html = html.replace(needle, "UI.bind($('stage'), onStageAction);");
fs.writeFileSync(bad, html, 'utf8');

console.log('— 用旧的（有 bug 的）绑定跑一遍，期望出现 FAIL —');
let code = 0;
try {
  execFileSync(process.execPath, [path.join(__dirname, 'ui-check.js')], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, { UI_SRC: 'dev/_broken.html' })
  });
} catch (e) {
  code = e.status || 1;
}
fs.unlinkSync(bad);
if (code === 0) {
  console.log('\n⚠️ 有 bug 的版本也通过了，说明这个测试抓不住问题');
  process.exitCode = 1;
} else {
  console.log('\n✅ 反向验证通过：旧绑定确实会被判 FAIL（测试有效）');
}
