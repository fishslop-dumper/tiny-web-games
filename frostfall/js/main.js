/* =========================================================================
   永冬 · Frostfall —— 启动与主循环
   ========================================================================= */
(function (root) {
  'use strict';
  const FW = root.FW;

  let game = null;
  let renderer = null;
  let lastT = 0;
  let uiAcc = 0;
  let settings = { difficulty: 'normal', seed: 1887 };

  /* ------------------------------ 开始界面 ------------------------------ */
  function initStart() {
    // 难度
    const diffPick = document.getElementById('diffPick');
    const diffs = [
      ['easy', '简单', '资源多 35%，人更抗冻'],
      ['normal', '普通', '标准体验'],
      ['hard', '严苛', '资源少，病得更多']
    ];
    diffPick.innerHTML = diffs.map((d) =>
      '<button class="diff' + (d[0] === settings.difficulty ? ' on' : '') + '" data-d="' + d[0] + '" title="' + d[2] + '">' + d[1] + '</button>'
    ).join('');
    diffPick.onclick = (e) => {
      const b = e.target.closest('.diff');
      if (!b) return;
      settings.difficulty = b.dataset.d;
      for (const n of diffPick.children) n.classList.toggle('on', n === b);
    };

    document.getElementById('seedRandom').onclick = () => {
      document.getElementById('seedInput').value = Math.floor(Math.random() * 999999);
    };
    document.getElementById('startBtn').onclick = () => {
      settings.seed = Number(document.getElementById('seedInput').value) || 1887;
      startGame();
    };
    drawStartBg();
    // 调试 / 直接开局：#play 或 #play=1
    if (/play/.test(location.hash)) {
      const m = location.hash.match(/play=(\w+)/);
      if (m) settings.difficulty = m[1];
      startGame();
      const sp = location.hash.match(/sp=(\d)/);
      if (sp) setTimeout(() => root.UI.setSpeed(Number(sp[1])), 100);
    }
  }

  function drawStartBg() {
    const cv = document.getElementById('startBg');
    const c = cv.getContext('2d');
    let flakes = [];
    function fit() {
      cv.width = root.innerWidth;
      cv.height = root.innerHeight;
      flakes = [];
      const n = Math.round((cv.width * cv.height) / 9000);
      for (let i = 0; i < n; i++) {
        flakes.push({ x: Math.random() * cv.width, y: Math.random() * cv.height, r: 0.6 + Math.random() * 1.8, vy: 12 + Math.random() * 55, vx: -8 - Math.random() * 26, a: 0.1 + Math.random() * 0.4 });
      }
    }
    fit();
    root.addEventListener('resize', fit);
    let t = 0;
    function frame() {
      if (document.getElementById('start').hidden) return;
      t += 0.016;
      c.clearRect(0, 0, cv.width, cv.height);
      // 地平线余烬
      const g = c.createRadialGradient(cv.width * 0.5, cv.height * 1.02, 0, cv.width * 0.5, cv.height * 1.02, cv.width * 0.55);
      g.addColorStop(0, 'rgba(255,150,60,' + (0.16 + 0.04 * Math.sin(t * 1.6)) + ')');
      g.addColorStop(0.5, 'rgba(150,70,20,0.06)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, cv.width, cv.height);
      // 远处城市剪影
      c.fillStyle = 'rgba(6,10,16,0.85)';
      const baseY = cv.height * 0.94;
      c.beginPath();
      c.moveTo(0, baseY);
      for (let x = 0; x <= cv.width; x += 42) {
        const h = 10 + ((Math.sin(x * 0.021) + 1) * 0.5) * 36 + ((x * 7) % 13);
        c.lineTo(x, baseY - h);
        c.lineTo(x + 20, baseY - h);
      }
      c.lineTo(cv.width, baseY);
      c.lineTo(cv.width, cv.height);
      c.lineTo(0, cv.height);
      c.closePath();
      c.fill();
      // 雪
      for (const p of flakes) {
        p.x += p.vx * 0.016; p.y += p.vy * 0.016;
        if (p.y > cv.height + 6) { p.y = -6; p.x = Math.random() * cv.width; }
        if (p.x < -6) { p.x = cv.width + 6; }
        c.beginPath(); c.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        c.fillStyle = 'rgba(220,240,255,' + p.a + ')';
        c.fill();
      }
      requestAnimationFrame(frame);
    }
    frame();
  }

  /* ------------------------------ 开局 ------------------------------ */
  function startGame() {
    game = new FW.Game({ seed: settings.seed, difficulty: settings.difficulty });
    document.getElementById('start').hidden = true;
    const app = document.getElementById('app');
    app.hidden = false;

    const cv = document.getElementById('cv');
    renderer = new FW.Renderer(cv, game);
    FW.renderer = renderer;
    root.UI.bindGame(game, renderer);
    root.UI.buildTopbar();
    root.UI.buildPalette();
    root.UI.updateSpeedBtns();
    root.UI.lastStamp = undefined;
    root.UI.setSpeed(1);

    attachInput(cv);
    root.__fw = { game: game, renderer: renderer, UI: root.UI, get FW() { return FW; } };
    if (!startGame.raf) {
      startGame.raf = true;
      lastT = performance.now();
      requestAnimationFrame(loop);
    }
    // 首日提示
    setTimeout(() => root.UI.toast('煤炭储备只够 3 天。先建一座煤矿。', 'warn'), 900);
    setTimeout(() => root.UI.toast('沿十字道路两侧建造，注意别把路堵死。', 'hint'), 4200);
  }
  FW.restart = function () {
    root.UI.closeModal();
    document.getElementById('app').hidden = true;
    startGame();
  };

  /* ------------------------------ 输入 ------------------------------ */
  function attachInput(cv) {
    if (attachInput.bound) return;
    attachInput.bound = true;
    let down = false, btn = 0, mx = 0, my = 0, moved = 0, sx = 0, sy = 0;
    let painting = false, painted = false, lastPaint = '';
    const UIRef = () => root.UI;

    const localPos = (e) => {
      const rect = cv.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    cv.addEventListener('contextmenu', (e) => e.preventDefault());

    cv.addEventListener('mousedown', (e) => {
      down = true; btn = e.button; moved = 0;
      const p = localPos(e); mx = p.x; my = p.y; sx = p.x; sy = p.y;
      const UI = UIRef();
      painting = btn === 0 && UI && UI.buildMode === 'road';
      painted = false; lastPaint = '';
    });

    root.addEventListener('mousemove', (e) => {
      if (!renderer) return;
      const p = localPos(e);
      if (p.x < 0 || p.y < 0 || p.x > renderer.w || p.y > renderer.h) {
        if (!down) { renderer.hover = null; }
      } else {
        const w = renderer.screenToWorld(p.x, p.y);
        renderer.hover = renderer.tileAt(w.x, w.y);
      }
      if (!down) return;
      const dx = p.x - mx, dy = p.y - my;
      const px = mx, py = my;
      moved += Math.abs(dx) + Math.abs(dy);
      mx = p.x; my = p.y;
      // 道路：拖拽连续铺设
      if (painting && renderer.hover) {
        const k = renderer.hover.r + ':' + renderer.hover.s;
        if (k !== lastPaint) {
          lastPaint = k;
          const t = game.tile(renderer.hover.r, renderer.hover.s);
          if (t && !t.kind && !t.feat) {
            const r = game.build('road', renderer.hover.r, renderer.hover.s);
            if (r.ok) { painted = true; UIRef().sideSig = ''; }
          }
        }
        return;
      }
      if (moved > 5) renderer.pan(dx, dy, px, py);
    });

    root.addEventListener('mouseup', (e) => {
      if (!down) return;
      down = false;
      if (painting) { painting = false; if (painted) return; }
      if (moved > 5) return;
      const p = localPos(e);
      if (p.x < 0 || p.y < 0 || p.x > renderer.w || p.y > renderer.h) return;
      if (btn === 2) {
        if (root.UI.buildMode) root.UI.setBuildMode(null);
        else { renderer.selected = null; root.UI.sideSig = ''; }
        return;
      }
      if (btn !== 0) return;
      const w = renderer.screenToWorld(p.x, p.y);
      const tile = renderer.tileAt(w.x, w.y);
      if (!tile) { root.UI.onEmptyClick(); return; }
      root.UI.onTileClick(tile.r, tile.s, e.shiftKey);
    });

    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const p = localPos(e);
      renderer.zoomAt(p.x, p.y, e.deltaY > 0 ? 0.88 : 1.14);
    }, { passive: false });

    root.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const S = game && game.state;
      if (e.code === 'Space') {
        e.preventDefault();
        if (S.gameOver) return;
        root.UI.setSpeed(S.speed === 0 ? (S.lastSpeed || 1) : 0);
      } else if (e.key === '1' || e.key === '2' || e.key === '3') {
        if (S.gameOver) return;
        root.UI.setSpeed(Number(e.key));
      } else if (e.key === 'Escape') {
        if (root.UI.modal) { if (!root.UI.modalBlocking) root.UI.closeModal(); }
        else if (root.UI.buildMode) root.UI.setBuildMode(null);
        else { renderer.selected = null; root.UI.sideSig = ''; }
      } else if (e.key === 'h') {
        root.UI.openHelp();
      } else if (e.key === 'r') {
        renderer.center();
      } else if (e.key === 'q' || e.key === 'Q') {
        renderer.azim -= 0.12;
      } else if (e.key === 'e' || e.key === 'E') {
        renderer.azim += 0.12;
      }
    });

    root.addEventListener('resize', () => {
      renderer.resize();
      root.UI.sideSig = '';
    });
  }

  /* ------------------------------ 主循环 ------------------------------ */
  function loop(ts) {
    const dt = Math.min(0.06, Math.max(0, (ts - lastT) / 1000));
    lastT = ts;
    if (game && !game.state.gameOver) {
      if (game.state.speed > 0) {
        game.advance(dt * FW.CFG.HOURS_PER_SEC * game.state.speed);
      }
    }
    if (renderer) renderer.draw(dt);
    uiAcc += dt;
    if (uiAcc > 0.1) {
      uiAcc = 0;
      root.UI.tick();
      root.UI.pump();
    }
    requestAnimationFrame(loop);
  }

  root.addEventListener('DOMContentLoaded', initStart);
  if (document.readyState !== 'loading') initStart();
})(typeof globalThis !== 'undefined' ? globalThis : this);
