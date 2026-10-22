'use strict';
/* 在真实浏览器里跑一遍打包产物，确认内联脚本真的能启动（开发辅助） */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const SRC = path.join(ROOT, '60秒地堡余生.html');

const INJ = '<script>\nwindow.addEventListener("load", function () {\n' +
  '  try {\n' +
  '    var G = window.__GAME;\n' +
  '    G.Main.boot();\n' +
  '    G.Main.startGame();\n' +
  '    G.Scav.update(0.016);\n' +
  '    G.Scav.render(document.getElementById("cv").getContext("2d"));\n' +
  '    var st = G.Scav.state();\n' +
  '    document.title = "OK t=" + st.t.toFixed(1) + " items=" + G.Scav.houseRef().items.length +\n' +
  '      " screen=" + document.getElementById("screen-play").className;\n' +
  '  } catch (e) { document.title = "ERR " + e.message; }\n' +
  '});\n<\/script>';

let html = fs.readFileSync(SRC, 'utf8');
html = html.replace('</body>', INJ + '\n</body>');
const tmp = path.join(ROOT, 'dev', '_bundlecheck.html');
fs.writeFileSync(tmp, html, 'utf8');

const dom = execFileSync(EDGE, [
  '--headless=new', '--disable-gpu', '--dump-dom', '--virtual-time-budget=1500',
  '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + path.join(ROOT, 'dev', '_profile2'),
  'file:///' + tmp.replace(/\\/g, '/')
], { encoding: 'utf8', timeout: 90000 });

const m = dom.match(/<title[^>]*>([^<]*)<\/title>/);
const title = m ? m[1] : '(no title)';
console.log('浏览器内运行结果: ' + title);
fs.unlinkSync(tmp);
if (title.indexOf('OK') !== 0) process.exitCode = 1;
