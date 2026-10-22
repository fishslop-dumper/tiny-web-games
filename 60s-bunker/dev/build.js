'use strict';
/* 把 index.html + style.css + src/*.js 打成单文件（可直接双击打开 / 发给别人） */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, '60秒地堡余生.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const FILES = ['src/game-core.js', 'src/game-scavenge.js', 'src/game-bunker.js', 'src/game-ui.js'];

html = html.replace(/<link rel="stylesheet" href="style\.css">/, function () {
  return '<style>\n' + css + '\n</style>';
});

let inlined = 0;
html = html.replace(/<script src="(src\/[^"]+)"><\/script>/g, function (m, src) {
  const idx = FILES.indexOf(src);
  if (idx < 0) throw new Error('未知脚本: ' + src);
  const code = fs.readFileSync(path.join(ROOT, src), 'utf8');
  if (/<\/script>/i.test(code)) throw new Error(src + ' 含 </script>，不能内联');
  inlined++;
  return '<script>\n/* ==== ' + src + ' ==== */\n' + code + '\n</script>';
});

if (inlined !== FILES.length) throw new Error('内联脚本数量不对: ' + inlined);
if (/<link rel="stylesheet"/.test(html)) throw new Error('CSS 未内联');

fs.writeFileSync(OUT, html, 'utf8');
const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log('已生成单文件: ' + path.relative(ROOT, OUT) + '  (' + kb + ' KB, ' + inlined + ' 个脚本 + CSS 内联)');
