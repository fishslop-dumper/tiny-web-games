'use strict';
/* Headless Edge screenshot helper (dev only, not part of the game) */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const BUDGET = process.env.SHOT_BUDGET || '2600';

const DRIVER = `
document.addEventListener('DOMContentLoaded', function () {
  var q = String(location.search || '');
  var m = q.match(/s=([a-z]+)/);
  var mode = m ? m[1] : 'title';
  var G = window.__GAME;
  if (!G) { document.body.innerHTML = '<h1 style="color:red">NO GAME</h1>'; return; }
  G.Main.boot();
  try {
    if (mode === 'play') {
      G.Main.startGame();
      var st = G.Scav.state(), h = G.Scav.houseRef();
      var it = h.items.filter(function (o) { return o.key === 'water'; })[0] || h.items[0];
      st.px = (it.x + 0.5) * 24; st.py = (it.y + 0.5) * 24;
      var fam = h.family[0];
      fam.following = true; st.following.push(fam.id);
      fam.px = st.px - 22; fam.py = st.py + 16;
      st.grabbed = ['food', 'food', 'choco', 'radio', 'firstaid'];
      st.t = 41.4;
      st.grabTarget = it; st.grabP = 0.55;
      st.msg = G.ITEMS[it.key].emoji + ' ' + G.ITEMS[it.key].name; st.msgT = 1.2;
      G.Scav.render(document.getElementById('cv').getContext('2d'));
    } else if (mode === 'bunker' || mode === 'event') {
      G.Bunker.init({ items: ['water','water','food','food','food','radio','rifle','meds','cards','teddy','firstaid','soap','choco'], family: ['dolores','mary'], tLeft: 30 }, 20240);
      for (var d = 0; d < 3; d++) {
        G.Bunker.confirmRation();
        if (G.Bunker.state().ended) break;
        G.Bunker.choose(0);
        G.Bunker.advance();
        var S = G.Bunker.state();
        if (S.stage === 'expedition' && S.members[2]) G.Bunker.expedition(S.members[2].id);
        G.Bunker.advance();
        G.Bunker.advance();
      }
      if (mode === 'event' && !G.Bunker.state().ended) G.Bunker.confirmRation();
      G.UI.show('bunker');
      G.UI.renderBunker();
    } else if (mode === 'end') {
      G.UI.showEnding({
        reason: 'rescue', day: 15, goal: 15, aliveCount: 3, brought: 9, rescued: 2, deaths: ['timmy'],
        alive: G.FAMILY.slice(0, 3).map(function (f) { return { emoji: f.emoji, name: f.name }; }),
        seed: 123456
      });
    } else {
      G.UI.show('title');
    }
  } catch (err) {
    document.body.innerHTML = '<pre style="color:red;font-size:18px">' + err.message + '</pre>';
  }
});
`;

function buildShotPage() {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace('<head>', '<head>\n<base href="../">\n<style>*{animation:none !important;transition:none !important}</style>');
  html = html.replace('</body>', '<script>' + DRIVER + '<\/script>\n</body>');
  fs.writeFileSync(path.join(ROOT, 'dev', '_shot.html'), html, 'utf8');
}

const SHOTS = ['title', 'play', 'bunker', 'event', 'end'];

buildShotPage();

for (const mode of SHOTS) {
  const out = path.join(ROOT, 'dev', 'shot-' + mode + '.png');
  if (fs.existsSync(out)) fs.unlinkSync(out);
  const url = 'file:///' + path.join(ROOT, 'dev', '_shot.html').replace(/\\/g, '/') + '?s=' + mode;
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions',
    '--user-data-dir=' + path.join(ROOT, 'dev', '_profile'),
    '--window-size=1280,820',
    '--virtual-time-budget=' + BUDGET,
    '--screenshot=' + out, url
  ];
  try {
    execFileSync(EDGE, args, { stdio: 'pipe', timeout: 90000 });
  } catch (e) {
    console.log('  ! ' + mode + ' failed: ' + (e.stdout ? e.stdout.toString().slice(0, 300) : e.message));
  }
  console.log(mode + ' -> ' + (fs.existsSync(out) ? (fs.statSync(out).size / 1024).toFixed(0) + ' KB' : 'MISSING'));
}
