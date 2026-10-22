/* =========================================================================
 * 群星：微光银河 —— 启动、主循环、存档
 * ========================================================================= */
(function (g) {
  'use strict';
  const SM = g.SM;
  const UI = SM.UI;

  let game = null;
  let acc = 0;
  let lastFrame = performance.now();
  let autosaveYear = -1;
  let started = false;

  function showError(msg) {
    let box = document.getElementById('error-banner');
    if (!box) {
      box = document.createElement('div');
      box.id = 'error-banner';
      box.style.cssText = 'position:fixed;left:50%;top:12px;transform:translateX(-50%);z-index:9999;max-width:90vw;background:#3b0d16;color:#ffd7dd;border:1px solid #ff6b6b;padding:8px 12px;border-radius:8px;font:12px/1.5 monospace;white-space:pre-wrap;box-shadow:0 10px 40px rgba(0,0,0,.6)';
      document.body.appendChild(box);
    }
    box.textContent = '脚本错误：' + msg;
  }

  window.addEventListener('error', function (ev) {
    showError(ev.message + (ev.filename ? '\n' + ev.filename + ':' + ev.lineno : ''));
  });
  window.addEventListener('unhandledrejection', function (ev) {
    showError('Promise: ' + (ev.reason && ev.reason.message ? ev.reason.message : ev.reason));
  });

  /* ------------------------------------------------------------------ */
  /* 存档                                                              */
  /* ------------------------------------------------------------------ */
  function saveGame(silent) {
    if (!game) return;
    try {
      localStorage.setItem(SM.SAVE_KEY, game.serialize());
      if (!silent) UI.toast({ type: 'info', icon: '💾', text: '银河已保存（' + SM.dateParts(game.state.day).year + ' 年）' });
    } catch (err) {
      showError('保存失败：' + err.message);
    }
  }

  UI.hooks.save = function () { saveGame(false); };

  function loadGame() {
    let raw = null;
    try { raw = localStorage.getItem(SM.SAVE_KEY); } catch (err) { raw = null; }
    if (!raw) {
      UI.toast({ type: 'info', icon: '⚠', text: '没有找到存档（或浏览器禁用了本地存储）。' });
      return;
    }
    let g = null;
    try { g = SM.Game.deserialize(raw); } catch (err) { g = null; }
    if (!g) {
      UI.toast({ type: 'info', icon: '⚠', text: '存档损坏，无法读取。' });
      return;
    }
    game = g;
    window.__SM_GAME__ = g;
    UI.attach(g, { isNew: false });
    autosaveYear = SM.dateParts(g.state.day).year;
  }
  UI.hooks.load = loadGame;

  /* ------------------------------------------------------------------ */
  /* 启动游戏                                                          */
  /* ------------------------------------------------------------------ */
  function startGame(cfg) {
    if (started) return;
    started = true;
    UI.stopStartBG();
    let loaded = false;
    if (cfg && cfg.load) {
      let raw = null;
      try { raw = localStorage.getItem(SM.SAVE_KEY); } catch (err) { raw = null; }
      if (raw) {
        try { game = SM.Game.deserialize(raw); } catch (err) { game = null; }
        if (game) loaded = true;
        else UI.toast({ type: 'info', icon: '⚠', text: '存档损坏，将开始新游戏。' });
      }
    }
    if (!game) {
      try {
        game = new SM.Game({
          seed: cfg && cfg.seed !== undefined ? cfg.seed : 22000217,
          difficulty: (cfg && cfg.difficulty) || 'normal',
          empireName: (cfg && cfg.empireName) || '大肥鱼帝国',
          color: (cfg && cfg.color) || '#4cc9f0',
          trait: (cfg && cfg.trait) || 'industrious',
          aiCount: 3
        });
      } catch (err) {
        showError('初始化失败：' + (err.stack || err.message));
        started = false;
        return;
      }
    }
    window.__SM_GAME__ = game;
    UI.attach(game, { isNew: !loaded });
    autosaveYear = SM.dateParts(game.state.day).year;
  }

  /* ------------------------------------------------------------------ */
  /* 主循环                                                            */
  /* ------------------------------------------------------------------ */
  function frame(now) {
    const dt = Math.min(0.12, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (game && !UI.modalOpen) {
      const speed = UI.speed | 0;
      if (speed > 0) {
        acc += dt * UI.DAYS_PER_SEC[speed];
        let steps = 0;
        while (acc >= 1 && steps < 240) {
          acc -= 1;
          steps++;
          game.stepDay();
          if (UI.speed === 0) break;
        }
      }
    } else {
      acc = 0;
    }
    if (game) {
      UI.render(now);
      UI.tick(now);
      const year = SM.dateParts(game.state.day).year;
      if (year !== autosaveYear && game.state.day > 0) {
        autosaveYear = year;
        saveGame(true);
      }
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------------ */
  /* 键盘                                                              */
  /* ------------------------------------------------------------------ */
  function bindKeys() {
    document.addEventListener('keydown', function (ev) {
      if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
      if (ev.key === ' ') {
        ev.preventDefault();
        if (UI.modalOpen) return;
        UI.setSpeed(UI.speed === 0 ? 1 : 0);
        return;
      }
      if (ev.key === '0' || ev.key === '`') { if (!UI.modalOpen) UI.setSpeed(0); return; }
      if (ev.key === '1') { if (!UI.modalOpen) UI.setSpeed(1); return; }
      if (ev.key === '2') { if (!UI.modalOpen) UI.setSpeed(2); return; }
      if (ev.key === '3') { if (!UI.modalOpen) UI.setSpeed(3); return; }
      if (ev.key === 'Escape') {
        if (UI.modalOpen) {
          if (UI.modalClosable) UI.closeModal();
        } else {
          UI.select(null);
        }
        return;
      }
      if (ev.key === 'h' || ev.key === 'H' || ev.key === '?') {
        if (!UI.modalOpen) UI.openHelp();
        return;
      }
      if (ev.key === 'f' || ev.key === 'F') {
        if (!UI.modalOpen) UI.selectCapital();
        return;
      }
    });
  }

  /* ------------------------------------------------------------------ */
  /* 启动                                                              */
  /* ------------------------------------------------------------------ */
  function boot() {
    UI.init();
    bindKeys();
    UI.initStart({ onStart: startGame });
    requestAnimationFrame(frame);

    // 调试/截图：?autostart=1&ff=天数&seed=...
    const params = new URLSearchParams(location.search);
    if (params.get('autostart')) {
      const seed = Number(params.get('seed') || 22000217) || 22000217;
      startGame({ empireName: '大肥鱼帝国', color: '#4cc9f0', trait: 'industrious', difficulty: params.get('diff') || 'normal', seed: seed, _auto: true });
      if (game) {
        const keepIntro = params.get('intro') === '1';
        if (!keepIntro && UI.modalOpen) UI.closeModal(true);
        const ff = Math.max(0, Math.min(40000, Number(params.get('ff') || 0) || 0));
        const aiFF = params.get('ai') === '1' && ff > 0;
        if (aiFF) game.player().isPlayer = false;
        for (let i = 0; i < ff; i++) {
          game.stepDay();
          if (game.state.pendingEvent) game.resolveEvent(0);
          if (game.state.gameOver && game.state.gameOver.type === 'defeat') break;
        }
        if (aiFF) {
          game.player().isPlayer = true;
          game.refreshEconomy(game.player());
        }
        game.notices = [];
        if (!keepIntro && UI.modalOpen) UI.closeModal(true);
        UI.lastGameOver = game.state.gameOver;
        UI.renderTopbar();
        UI.renderLeft();
        UI.renderRight(true);
        UI.setSpeed(params.get('speed') !== null ? Number(params.get('speed')) : 0);
      }
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.addEventListener('beforeunload', function () {
    if (game) saveGame(true);
  });
})(typeof window !== 'undefined' ? window : globalThis);
