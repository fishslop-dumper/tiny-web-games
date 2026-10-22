/* =========================================================================
 * 群星：微光银河 —— 界面层
 * ========================================================================= */
(function (g) {
  'use strict';
  const SM = g.SM;
  const UI = (SM.UI = {});

  /* ------------------------------------------------------------------ */
  /* 小工具                                                              */
  /* ------------------------------------------------------------------ */
  function $(sel) { return document.querySelector(sel); }
  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmt(n) { return SM.formatNum(n); }
  function signed(n) { return SM.formatSigned(n); }
  function compact(n) {
    const a = Math.abs(n);
    if (a >= 1000) return (n / 1000).toFixed(1) + 'k';
    return fmt(n);
  }
  function compactSigned(n) {
    const r = Math.abs(n) >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(Math.round(n * 10) / 10);
    return (n >= 0 ? '+' : '') + r;
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function catColor(cat) { return SM.RESEARCH[cat].color; }
  function catIcon(cat) { return SM.RESEARCH[cat].icon; }
  function pname(p) { return SM.PLANET_TYPES[p.type] ? SM.PLANET_TYPES[p.type].name : p.type; }
  function pcolor(p) { return SM.PLANET_TYPES[p.type] ? SM.PLANET_TYPES[p.type].color : '#888'; }
  function resIcon(k) { return SM.RESOURCES[k] ? SM.RESOURCES[k].icon : ''; }
  function resName(k) { return SM.RESOURCES[k] ? SM.RESOURCES[k].name : k; }
  function tag(text, cls) { return '<span class="tag ' + (cls || '') + '">' + esc(text) + '</span>'; }
  function bar(pct, cls) {
    return '<div class="progress ' + (cls || '') + '"><i style="width:' + clamp(pct, 0, 100).toFixed(1) + '%"></i></div>';
  }
  function fmtPct(v) { return Math.round(v * 100) + '%'; }
  function monthOf(day) { const d = SM.dateParts(day); return d.year + '年' + d.month + '月'; }
  function dateFull(day) { const d = SM.dateParts(day); return d.year + '年' + d.month + '月' + d.day + '日'; }
  function ownerBadge(e) {
    if (!e) return '<span class="badge">无主</span>';
    return '<span class="badge owner" style="background:' + e.color + ';color:#061018">' + esc(e.name) + '</span>';
  }
  function jobSummary(jobs) {
    if (!jobs) return '';
    const parts = [];
    Object.keys(jobs).forEach(function (j) {
      if (jobs[j] <= 0) return;
      const def = SM.JOBS[j];
      const out = [];
      Object.keys(def.out || {}).forEach(function (k) { out.push((SM.RESOURCES[k] ? SM.RESOURCES[k].icon : '') + def.out[k]); });
      parts.push(def.name + '×' + jobs[j] + (out.length ? '（' + out.join(' ') + '）' : ''));
    });
    return parts.join(' · ');
  }
  function outSummary(out) {
    const parts = [];
    Object.keys(out || {}).forEach(function (k) {
      if (!SM.RESOURCES[k]) return;
      parts.push(resIcon(k) + out[k]);
    });
    return parts.join(' ');
  }
  function jobSlotsText(jobs) {
    return Object.keys(jobs || {}).map(function (j) {
      return jobs[j] + ' ' + (SM.JOBS[j] ? SM.JOBS[j].name : j);
    }).join(' + ');
  }
  function jobOutputText(jobs) {
    const total = {};
    Object.keys(jobs || {}).forEach(function (j) {
      const def = SM.JOBS[j];
      if (!def) return;
      Object.keys(def.out || {}).forEach(function (k) {
        total[k] = (total[k] || 0) + def.out[k] * jobs[j];
      });
    });
    return Object.keys(total).map(function (k) {
      const meta = SM.RESOURCES[k] || SM.RESEARCH[k];
      return (meta ? meta.icon : '') + (Math.round(total[k] * 10) / 10);
    }).join(' ');
  }
  function totalDistricts(c) {
    return Object.keys(c.districts || {}).reduce(function (a, k) { return a + (c.districts[k] || 0); }, 0);
  }

  /* ------------------------------------------------------------------ */
  /* 状态                                                               */
  /* ------------------------------------------------------------------ */
  UI.game = null;
  UI.camera = { x: 0, y: 0, zoom: 0.66 };
  UI.selected = null;           // {type:'system'|'planet'|'fleet', id, systemId}
  UI.hover = null;
  UI.tab = 'overview';
  UI.speed = 0;
  UI.DAYS_PER_SEC = [0, 20, 40, 70];
  UI.showBorders = true;
  UI.showLanes = true;
  UI.autoPause = true;
  UI.modalOpen = false;
  UI.modalKind = null;
  UI.modalQueue = [];
  UI.techPrompt = null;
  UI.lastPanels = 0;
  UI.lastTop = 0;
  UI.lastNotices = 0;
  UI.hoverLeft = false;
  UI.hoverRight = false;
  UI.panelDirty = true;
  UI.startBG = null;
  UI.startCfg = null;
  UI.hooks = { save: null, load: null };
  UI.renderer = null;
  UI.toastTimer = {};
  UI.lastGameOver = null;
  UI.lastYardColony = null;
  UI.speedBeforeModal = 0;
  UI.keepSpeedBefore = false;
  UI.questFlags = { openedDiplomacy: false };
  UI.lastQuestDone = 0;
  UI.firstContactPrompt = null;
  UI.warBriefing = null;
  UI.habitablePrompt = null;
  UI.lastManagerColony = null;
  UI.warFleetId = null;

  UI.player = function () { return UI.game ? UI.game.player() : null; };

  /* ------------------------------------------------------------------ */
  /* 开始界面                                                            */
  /* ------------------------------------------------------------------ */
  UI.initStart = function (opts) {
    const colors = $('#color-picker');
    const traits = $('#trait-picker');
    const diffs = $('#difficulty-picker');
    UI.startCfg = { color: SM.EMPIRE_COLORS[0].color, trait: 'industrious', difficulty: 'normal', seed: 22000217 };
    UI.startBG = new StartBG($('#start-bg'));

    colors.innerHTML = SM.EMPIRE_COLORS.map(function (c) {
      return '<button type="button" class="swatch" data-color="' + c.color + '" title="' + esc(c.name) + '" style="background:' + c.color + ';color:' + c.color + '"></button>';
    }).join('');
    colors.querySelectorAll('.swatch').forEach(function (b) {
      b.classList.toggle('active', b.dataset.color === UI.startCfg.color);
      b.onclick = function () {
        UI.startCfg.color = b.dataset.color;
        colors.querySelectorAll('.swatch').forEach(function (x) { x.classList.toggle('active', x === b); });
      };
    });

    traits.innerHTML = SM.TRAIT_ORDER.map(function (id) {
      const t = SM.TRAITS[id];
      return '<button type="button" class="trait-card' + (id === UI.startCfg.trait ? ' active' : '') + '" data-trait="' + id + '">' +
        '<b>' + t.icon + ' ' + esc(t.name) + '</b><small>' + esc(t.desc) + '</small></button>';
    }).join('');
    traits.querySelectorAll('.trait-card').forEach(function (b) {
      b.onclick = function () {
        UI.startCfg.trait = b.dataset.trait;
        traits.querySelectorAll('.trait-card').forEach(function (x) { x.classList.toggle('active', x === b); });
      };
    });

    diffs.innerHTML = Object.keys(SM.DIFFICULTY).map(function (id) {
      const d = SM.DIFFICULTY[id];
      return '<button type="button" class="diff-card' + (id === UI.startCfg.difficulty ? ' active' : '') + '" data-diff="' + id + '" title="' + esc(d.desc) + '">' +
        '<b>' + esc(d.name) + '</b><small>' + (id === 'easy' ? '轻松' : id === 'normal' ? '标准' : '凶险') + '</small></button>';
    }).join('');
    diffs.querySelectorAll('.diff-card').forEach(function (b) {
      b.onclick = function () {
        UI.startCfg.difficulty = b.dataset.diff;
        diffs.querySelectorAll('.diff-card').forEach(function (x) { x.classList.toggle('active', x === b); });
      };
    });

    const seedInput = $('#seed-input');
    seedInput.value = UI.startCfg.seed;
    $('#seed-random').onclick = function () {
      UI.startCfg.seed = Math.floor(Math.random() * 99999999);
      seedInput.value = UI.startCfg.seed;
    };

    $('#start-btn').onclick = function () {
      const name = ($('#empire-name').value || '').trim() || '大肥鱼帝国';
      const seed = parseInt(seedInput.value, 10);
      UI.startCfg.seed = isNaN(seed) ? UI.startCfg.seed : seed;
      UI.startCfg.empireName = name;
      UI.stopStartBG();
      opts.onStart(Object.assign({}, UI.startCfg));
    };

    const save = (function () {
      try { return localStorage.getItem(SM.SAVE_KEY); } catch (err) { return null; }
    })();
    const cont = $('#continue-btn');
    if (save) {
      cont.hidden = false;
      cont.onclick = function () {
        UI.stopStartBG();
        opts.onStart({ load: true });
      };
    }
  };

  UI.stopStartBG = function () {
    if (UI.startBG) { UI.startBG.stop(); UI.startBG = null; }
  };

  class StartBG {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.stars = [];
      this.shoot = null;
      this.t = 0;
      this.run = true;
      this.resize();
      this.boundResize = this.resize.bind(this);
      window.addEventListener('resize', this.boundResize);
      this.loop = this.loop.bind(this);
      this.raf = requestAnimationFrame(this.loop);
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.floor(this.w * dpr);
      this.canvas.height = Math.floor(this.h * dpr);
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!this.stars.length) {
        for (let i = 0; i < 220; i++) {
          this.stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.3 + 0.2, a: Math.random() * 0.65 + 0.15, tw: Math.random() * 6.28 });
        }
      }
    }
    loop(now) {
      if (!this.run) return;
      const dt = now ? 0.016 : 0.016;
      this.t += dt;
      const g = this.ctx;
      g.clearRect(0, 0, this.w, this.h);
      // 星云
      const blobs = [
        [0.2, 0.25, 420, 'rgba(50,110,200,0.10)'],
        [0.82, 0.75, 500, 'rgba(130,60,180,0.09)'],
        [0.6, 0.18, 380, 'rgba(60,190,200,0.06)']
      ];
      blobs.forEach(function (b) {
        const gr = g.createRadialGradient(b[0] * this.w, b[1] * this.h, 0, b[0] * this.w, b[1] * this.h, b[2]);
        gr.addColorStop(0, b[3]);
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, this.w, this.h);
      }, this);
      // 星点
      this.stars.forEach(function (s) {
        const a = s.a * (0.72 + 0.28 * Math.sin(this.t * 1.6 + s.tw));
        g.fillStyle = 'rgba(215,235,255,' + a.toFixed(3) + ')';
        g.beginPath();
        g.arc(s.x * this.w, s.y * this.h, s.r, 0, Math.PI * 2);
        g.fill();
      }, this);
      // 流星
      if (!this.shoot && Math.random() < 0.006) {
        this.shoot = { x: Math.random() * this.w * 0.8, y: Math.random() * this.h * 0.4, vx: 520, vy: 220, life: 1 };
      }
      if (this.shoot) {
        const s = this.shoot;
        s.x += s.vx * 0.016;
        s.y += s.vy * 0.016;
        s.life -= 0.011;
        if (s.life <= 0) this.shoot = null;
        else {
          const gr = g.createLinearGradient(s.x, s.y, s.x - s.vx * 0.12, s.y - s.vy * 0.12);
          gr.addColorStop(0, 'rgba(200,240,255,' + s.life + ')');
          gr.addColorStop(1, 'rgba(200,240,255,0)');
          g.strokeStyle = gr;
          g.lineWidth = 1.6;
          g.beginPath();
          g.moveTo(s.x, s.y);
          g.lineTo(s.x - s.vx * 0.12, s.y - s.vy * 0.12);
          g.stroke();
        }
      }
      this.raf = requestAnimationFrame(this.loop);
    }
    stop() {
      this.run = false;
      cancelAnimationFrame(this.raf);
      window.removeEventListener('resize', this.boundResize);
    }
  }

  /* ------------------------------------------------------------------ */
  /* 初始化与绑定                                                        */
  /* ------------------------------------------------------------------ */
  UI.init = function () {
    UI.renderer = new Renderer($('#galaxy-canvas'));
    UI.bindCanvas();
    UI.bindTopbar();
    UI.bindPanels();
    UI.bindModalRoot();
    UI.bindToggles();
    $('#btn-save').onclick = function () { if (UI.hooks.save) UI.hooks.save(); };
    $('#btn-load').onclick = function () { UI.confirmLoad(); };
    $('#btn-help').onclick = function () { UI.openHelp(); };
    $('#btn-colonies').onclick = function () { UI.openColonyManager(); };
    $('#btn-yard').onclick = function () { UI.openShipyard(); };
    $('#btn-war').onclick = function () { UI.openWarRoom(); };
    $('#btn-home').onclick = function () { UI.selectCapital(); };
  };

  UI.bindTopbar = function () {
    const controls = $('#speed-controls');
    controls.querySelectorAll('button').forEach(function (b) {
      b.onclick = function () { UI.setSpeed(parseInt(b.dataset.speed, 10)); };
    });
    const bar = $('#resource-bar');
    bar.addEventListener('mouseover', function (ev) {
      const chip = ev.target.closest('.res-chip');
      if (!chip) return;
      UI.showTooltip(chip.dataset.tip, ev.clientX, ev.clientY);
    });
    bar.addEventListener('mousemove', function (ev) {
      if (ev.target.closest('.res-chip')) UI.moveTooltip(ev.clientX, ev.clientY);
    });
    bar.addEventListener('mouseout', function (ev) {
      if (!ev.relatedTarget || !ev.relatedTarget.closest || !ev.relatedTarget.closest('.res-chip')) UI.hideTooltip();
    });
  };

  UI.bindToggles = function () {
    $('#toggle-borders').onchange = function (e) { UI.showBorders = e.target.checked; };
    $('#toggle-lanes').onchange = function (e) { UI.showLanes = e.target.checked; };
    $('#toggle-autopause').onchange = function (e) { UI.autoPause = e.target.checked; };
  };

  UI.bindPanels = function () {
    const left = $('#left-panel');
    const right = $('#right-panel');
    left.addEventListener('mouseenter', function () { UI.hoverLeft = true; });
    left.addEventListener('mouseleave', function () {
      UI.hoverLeft = false;
      if (!UI.modalOpen) { UI.renderLeft(); UI.renderRight(); }
    });
    right.addEventListener('mouseenter', function () { UI.hoverRight = true; });
    right.addEventListener('mouseleave', function () {
      UI.hoverRight = false;
      if (!UI.modalOpen) { UI.renderLeft(); UI.renderRight(); }
    });
    left.addEventListener('click', function (ev) {
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      UI.handleAction(btn.dataset, ev);
    });
    right.addEventListener('click', function (ev) {
      const tab = ev.target.closest('.tab');
      if (tab) {
        UI.tab = tab.dataset.tab;
        UI.renderRight(true);
        return;
      }
      const btn = ev.target.closest('[data-action]');
      if (!btn) return;
      UI.handleAction(btn.dataset, ev);
    });
    // 面板内自定义 tooltip
    function onTipOver(ev) {
      const el = ev.target.closest('[data-tip]');
      if (!el) { UI.hideTooltip(); return; }
      UI.showTooltip(el.dataset.tip, ev.clientX, ev.clientY);
    }
    left.addEventListener('mouseover', onTipOver);
    right.addEventListener('mouseover', onTipOver);
    left.addEventListener('mousemove', function (ev) {
      if (ev.target.closest('[data-tip]')) UI.moveTooltip(ev.clientX, ev.clientY);
    });
    right.addEventListener('mousemove', function (ev) {
      if (ev.target.closest('[data-tip]')) UI.moveTooltip(ev.clientX, ev.clientY);
    });
    left.addEventListener('mouseout', function (ev) {
      if (!ev.relatedTarget || !ev.relatedTarget.closest || !ev.relatedTarget.closest('[data-tip]')) UI.hideTooltip();
    });
    right.addEventListener('mouseout', function (ev) {
      if (!ev.relatedTarget || !ev.relatedTarget.closest || !ev.relatedTarget.closest('[data-tip]')) UI.hideTooltip();
    });
  };

  UI.bindCanvas = function () {
    const canvas = $('#galaxy-canvas');
    UI.drag = { active: false, moved: false, x: 0, y: 0, camX: 0, camY: 0 };
    canvas.addEventListener('mousedown', function (ev) {
      if (ev.button !== 0) return;
      UI.drag.active = true;
      UI.drag.moved = false;
      UI.drag.x = ev.clientX;
      UI.drag.y = ev.clientY;
      UI.drag.camX = UI.camera.x;
      UI.drag.camY = UI.camera.y;
      canvas.classList.add('dragging');
    });
    window.addEventListener('mousemove', function (ev) {
      if (UI.drag && UI.drag.active) {
        const dx = ev.clientX - UI.drag.x;
        const dy = ev.clientY - UI.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) UI.drag.moved = true;
        if (UI.drag.moved) {
          UI.camera.x = UI.drag.camX - dx / UI.camera.zoom;
          UI.camera.y = UI.drag.camY - dy / UI.camera.zoom;
          UI.hideTooltip();
        }
        return;
      }
      if (UI.game && UI.isOverCanvas(ev)) UI.onHover(ev.clientX, ev.clientY);
      else UI.hideTooltip();
    });
    window.addEventListener('mouseup', function (ev) {
      if (!UI.drag || !UI.drag.active) return;
      const wasDrag = UI.drag.moved;
      UI.drag.active = false;
      canvas.classList.remove('dragging');
      if (!wasDrag && UI.game) UI.onCanvasClick(ev.clientX, ev.clientY, ev);
    });
    canvas.addEventListener('mouseleave', function () {
      UI.hideTooltip();
      UI.hover = null;
    });
    canvas.addEventListener('wheel', function (ev) {
      ev.preventDefault();
      const factor = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
      const before = UI.screenToWorld(ev.clientX, ev.clientY);
      UI.camera.zoom = clamp(UI.camera.zoom * factor, 0.22, 2.4);
      const after = UI.screenToWorld(ev.clientX, ev.clientY);
      UI.camera.x += before.x - after.x;
      UI.camera.y += before.y - after.y;
    }, { passive: false });
    canvas.addEventListener('contextmenu', function (ev) {
      ev.preventDefault();
      if (!UI.game) return;
      UI.onCanvasRightClick(ev.clientX, ev.clientY);
    });
    canvas.addEventListener('dblclick', function (ev) {
      if (!UI.game) return;
      const hit = UI.renderer.hitTest(ev.clientX, ev.clientY);
      if (hit && hit.type === 'system') UI.centerOnSystem(hit.id, UI.camera.zoom);
    });
  };

  UI.isOverCanvas = function (ev) {
    if (ev.target && ev.target.id === 'galaxy-canvas') return true;
    return false;
  };

  UI.bindModalRoot = function () {
    const root = $('#modal-root');
    root.addEventListener('click', function (ev) {
      const act = ev.target.closest('[data-action]');
      if (act) {
        UI.handleAction(act.dataset, ev);
        return;
      }
      if (ev.target.classList.contains('modal-backdrop')) {
        if (UI.modalClosable) UI.closeModal();
      }
    });
  };

  /* ------------------------------------------------------------------ */
  /* 游戏挂载                                                            */
  /* ------------------------------------------------------------------ */
  UI.attach = function (game, opts) {
    UI.game = game;
    UI.selected = null;
    UI.tab = 'overview';
    UI.speed = 0;
    UI.modalQueue.length = 0;
    UI.techPrompt = null;
    UI.lastYardColony = null;
    UI.questFlags = { openedDiplomacy: false };
    UI.lastQuestDone = 0;
    UI.firstContactPrompt = null;
    UI.warBriefing = null;
    UI.habitablePrompt = null;
    UI.lastManagerColony = null;
    UI.warFleetId = null;
    UI.hideTooltip();
    UI.clearToasts();
    UI.closeModal(true);
    $('#start-screen').hidden = true;
    $('#game-ui').hidden = false;
    UI.renderer.resize();
    const p = game.player();
    const cap = p.capital ? game.colony(p.capital) : null;
    if (cap) {
      UI.selectPlanet(cap.planetId, true);
      UI.centerOnSystem(cap.systemId, 0.56);
    }
    UI.setSpeed(0);
    UI.renderTopbar();
    UI.renderLeft();
    UI.renderRight(true);
    UI.renderMapLegend();
    UI.processNotices();
    UI.lastQuestDone = UI.quests().filter(function (q) { return q.done; }).length;
    UI.lastGameOver = null;
    if (opts && opts.isNew) UI.showIntro();
    else UI.toast({ type: 'info', icon: '💾', text: '银河已读取。' });
  };

  UI.showIntro = function () {
    UI.openModal({
      kind: 'intro',
      kicker: '欢迎来到微光银河',
      title: '大肥鱼，出发！',
      sub: '2200 年 · 你的文明刚刚掌握超空间航行',
      width: 'narrow',
      body:
        '<p class="event-text">你是「' + esc(UI.player().name) + '」的领袖。银河里有 <b>64 个星系</b>、3 个 AI 帝国，以及一些不太友善的原生生物。</p>' +
        '<div class="help-grid" style="margin-top:14px">' +
        '<div><h4>① 先看右边</h4><p>右侧「概览」最上方是<b>舰长任务</b>，会一直告诉你下一步。先为三个研究领域各选一个项目。</p></div>' +
        '<div><h4>② 让船动起来</h4><p>科研船自动调查星系，工程船自动建太空站；选中它们能看到「这艘船做什么」。通常各 1–2 艘就够。</p></div>' +
        '<div><h4>③ 扩张</h4><p>调查星系 → 发现宜居行星 → 点任务卡的「打开殖民目标」派遣殖民船。殖民船会自动从首都出发。</p></div>' +
        '<div><h4>④ 保护自己</h4><p>点底栏「⚓ 船坞」造舰。选中舰队后点「🎯 选择攻击目标」，或点底栏「🎯 战争」进入战争指挥：先选舰队，再点敌方殖民地的「派舰队」。舰队会自动战斗、轰炸、占领。</p></div>' +
        '</div>' +
        '<p class="small" style="text-align:left;margin-top:16px;color:#8fa3c8">提示：点击「开始执政」后银河会开始运转。按空格暂停，或点 ⏸。遇到不懂的，点右上角 ❓。</p>',
      actions: [
        { label: '开始执政', cls: 'primary', onClick: function () { UI.setSpeed(1); } },
        { label: '完整教程', cls: 'ghost', onClick: function () { UI.openHelp(); } }
      ],
      closable: true
    });
  };

  UI.setSpeed = function (s) {
    if (!UI.game) { UI.speed = 0; return; }
    UI.speed = clamp(s, 0, 3);
    const controls = $('#speed-controls');
    if (controls) {
      controls.querySelectorAll('button').forEach(function (b) {
        b.classList.toggle('active', parseInt(b.dataset.speed, 10) === UI.speed);
      });
    }
    const label = $('#speed-label');
    if (label) label.textContent = ['已暂停', '正常速度', '2 倍速', '3 倍速'][UI.speed];
  };

  UI.select = function (type, id, systemId) {
    UI.selected = type ? { type: type, id: id, systemId: systemId || null } : null;
    UI.renderLeft();
    UI.renderRight();
  };
  UI.selectSystem = function (id) {
    const sys = UI.game.system(id);
    if (!sys) return null;
    UI.selected = { type: 'system', id: id, systemId: id };
    UI.renderLeft();
    UI.renderRight();
    return sys;
  };
  UI.selectPlanet = function (planetId, silent) {
    const sys = UI.game.planetSystem(planetId);
    if (!sys) return;
    UI.selected = { type: 'planet', id: planetId, systemId: sys.id };
    if (!silent) UI.centerOnSystem(sys.id, Math.max(UI.camera.zoom, 0.72));
    UI.renderLeft();
    UI.renderRight();
  };
  UI.selectColony = function (colonyId) {
    const c = UI.game.colony(colonyId);
    if (!c) return;
    UI.selectPlanet(c.planetId);
  };
  UI.selectFleet = function (fleetId) {
    const f = UI.game.fleet(fleetId);
    if (!f) return;
    if (f.kind === 'combat' && f.owner === UI.player().id) UI.warFleetId = fleetId;
    UI.selected = { type: 'fleet', id: fleetId, systemId: f.systemId };
    UI.renderLeft();
    UI.renderRight();
  };
  UI.selectSupportFleet = function (kind) {
    const g = UI.game, p = UI.player();
    const f = g.state.fleets.find(function (x) {
      return x.owner === p.id && x.kind === kind && x.ships.length;
    });
    if (!f) {
      UI.toast({ type: 'info', icon: kind === 'science' ? '🔭' : '🛠', text: '没有可用的' + (kind === 'science' ? '科研船' : '工程船') + '，已打开帝国船坞。' });
      UI.openShipyard(p.capital);
      return;
    }
    UI.closeModal();
    UI.selectFleet(f.id);
    UI.centerOnSystem(f.systemId, Math.max(UI.camera.zoom, 0.95));
  };
  UI.selectCapital = function () {
    const p = UI.player();
    const c = p.capital ? UI.game.colony(p.capital) : null;
    if (c) {
      UI.selectPlanet(c.planetId);
      UI.centerOnSystem(c.systemId, Math.max(UI.camera.zoom, 0.8));
    }
  };
  UI.cycleColony = function (delta) {
    const g = UI.game, p = UI.player();
    const cols = p.colonies.map(function (id) { return g.colony(id); }).filter(Boolean)
      .sort(function (a, b) {
        const ac = a.id === p.capital ? 1 : 0;
        const bc = b.id === p.capital ? 1 : 0;
        if (ac !== bc) return bc - ac;
        return b.pops - a.pops;
      });
    if (!cols.length) return;
    let idx = -1;
    if (UI.selected && UI.selected.type === 'planet') {
      idx = cols.findIndex(function (c) { return c.planetId === UI.selected.id; });
    }
    idx = (idx + delta + cols.length) % cols.length;
    const c = cols[idx];
    UI.selectPlanet(c.planetId);
    UI.centerOnSystem(c.systemId, Math.max(UI.camera.zoom, 0.9));
  };
  UI.centerOnSystem = function (systemId, zoom) {
    const sys = UI.game.system(systemId);
    if (!sys) return;
    UI.camera.x = sys.x;
    UI.camera.y = sys.y;
    if (zoom) UI.camera.zoom = zoom;
  };
  UI.screenToWorld = function (sx, sy) {
    const cam = UI.camera;
    return {
      x: (sx - window.innerWidth / 2) / cam.zoom + cam.x,
      y: (sy - window.innerHeight / 2) / cam.zoom + cam.y
    };
  };
  UI.worldToScreen = function (x, y) {
    const cam = UI.camera;
    return {
      x: (x - cam.x) * cam.zoom + window.innerWidth / 2,
      y: (y - cam.y) * cam.zoom + window.innerHeight / 2
    };
  };

  /* ------------------------------------------------------------------ */
  /* 画布交互                                                            */
  /* ------------------------------------------------------------------ */
  UI.onCanvasClick = function (mx, my) {
    if (UI.modalOpen) return;
    const hit = UI.renderer.hitTest(mx, my);
    if (!hit) { UI.select(null); return; }
    if (hit.type === 'fleet') { UI.selectFleet(hit.id); return; }
    if (hit.type === 'system') { UI.selectSystem(hit.id); return; }
  };

  UI.onCanvasRightClick = function (mx, my) {
    if (UI.modalOpen) return;
    if (!UI.selected || UI.selected.type !== 'fleet') return;
    const f = UI.game.fleet(UI.selected.id);
    if (!f || f.owner !== UI.player().id) return;
    const hit = UI.renderer.hitTest(mx, my);
    if (!hit) return;
    const sysId = hit.type === 'system' ? hit.id : (UI.game.fleet(hit.id) || {}).systemId;
    if (!sysId) return;
    const res = UI.game.moveFleet(f, sysId);
    if (!res.ok) UI.toast({ type: 'info', icon: '⚠', text: res.reason });
    else UI.toast({ type: 'info', icon: '🚀', text: f.name + ' 正在前往 ' + UI.game.system(sysId).name });
    UI.renderLeft();
  };

  UI.onHover = function (mx, my) {
    const hit = UI.renderer.hitTest(mx, my);
    UI.hover = hit;
    if (!hit) { UI.hideTooltip(); return; }
    const html = hit.type === 'fleet' ? UI.fleetTooltip(hit.id) : UI.systemTooltip(hit.id);
    UI.showTooltip(html, mx, my);
  };

  UI.systemTooltip = function (sysId) {
    const g = UI.game;
    const sys = g.system(sysId);
    if (!sys) return '';
    const p = UI.player();
    const owner = sys.owner ? g.empire(sys.owner) : null;
    const known = !!sys.surveyed[p.id];
    const fleets = g.fleetsIn(sys.id);
    const star = SM.STAR_TYPES[sys.star];
    let h = '<b>' + esc(sys.name) + '</b>';
    h += '<div class="tt-line"><span>' + esc(star.name) + '</span><span>' + (owner ? esc(owner.name) : '无主') + '</span></div>';
    h += '<div class="tt-line"><span>调查</span><span>' + (known ? '已完成' : '未调查') + '</span></div>';
    if (known) {
      const hab = sys.planets.filter(function (pl) { return pl.habitable; }).length;
      h += '<div class="tt-line"><span>行星</span><span>' + sys.planets.length + ' 颗（' + hab + ' 宜居）</span></div>';
      if (sys.deposits && (sys.deposits.energy + sys.deposits.minerals + sys.deposits.research) > 0) {
        h += '<div class="tt-line"><span>资源点</span><span>⚡' + sys.deposits.energy + ' ⛏' + sys.deposits.minerals + ' 🔭' + sys.deposits.research + '</span></div>';
      }
    }
    if (fleets.length) {
      h += '<div class="tt-line"><span>舰队</span><span>' + fleets.length + ' 支</span></div>';
    }
    if (sys.battle) h += '<div class="tt-line"><span style="color:#ff8a8a">💥 战斗进行中</span><span></span></div>';
    if (sys.hostiles) h += '<div class="tt-line"><span style="color:#ff8a8a">原生物种</span><span></span></div>';
    return h;
  };

  UI.fleetTooltip = function (fleetId) {
    const g = UI.game;
    const f = g.fleet(fleetId);
    if (!f) return '';
    const owner = f.owner ? g.empire(f.owner) : null;
    const sys = g.system(f.systemId);
    let h = '<b>' + esc(f.name) + '</b>';
    h += '<div class="tt-line"><span>所属</span><span>' + (owner ? '<span style="color:' + owner.color + '">' + esc(owner.name) + '</span>' : '中立生物') + '</span></div>';
    h += '<div class="tt-line"><span>舰船</span><span>' + f.ships.length + ' 艘</span></div>';
    if (f.kind === 'combat') h += '<div class="tt-line"><span>战力</span><span>' + g.fleetPower(f) + '</span></div>';
    if (sys) h += '<div class="tt-line"><span>位置</span><span>' + esc(sys.name) + '</span></div>';
    if (f.travel) h += '<div class="tt-line"><span>航行中</span><span>' + esc(g.system(f.travel.to).name) + '</span></div>';
    if (f.mission && f.mission.type === 'survey') h += '<div class="tt-line"><span>任务</span><span>调查中 ' + Math.round(f.mission.progress / f.mission.days * 100) + '%</span></div>';
    if (f.mission && f.mission.type === 'colonizing') h += '<div class="tt-line"><span>任务</span><span>殖民中 ' + Math.round(f.mission.progress / f.mission.days * 100) + '%</span></div>';
    return h;
  };

  /* ------------------------------------------------------------------ */
  /* 顶栏                                                                */
  /* ------------------------------------------------------------------ */
  UI.renderTopbar = function () {
    if (!UI.game) return;
    const g = UI.game;
    const p = UI.player();
    const d = SM.dateParts(g.state.day);
    $('#date-main').textContent = d.year + '年' + d.month + '月' + d.day + '日';
    $('#speed-label').textContent = ['已暂停', '正常速度', '2 倍速', '3 倍速'][UI.speed];
    $('#empire-badge').innerHTML =
      '<span class="color-dot" style="background:' + p.color + ';color:' + p.color + '"></span>' +
      '<div><div class="empire-name">' + esc(p.name) + '</div><div class="empire-sub">' + esc(p.species) + ' · ' + esc((SM.TRAITS[p.trait] || {}).name || '') + '</div></div>';
    const bar = $('#resource-bar');
    bar.innerHTML = SM.RESOURCE_ORDER.map(function (k) {
      const v = p.resources[k] || 0;
      const inc = p.income[k] || 0;
      const cls = inc >= 0 ? 'pos' : 'neg';
      const tip = UI.resourceTip(k);
      return '<div class="res-chip" data-tip="' + esc(tip) + '">' +
        '<span class="res-icon">' + resIcon(k) + '</span>' +
        '<span class="res-val' + (v < 40 && inc < 0 ? ' bad' : '') + '">' + compact(v) + '</span>' +
        '<span class="res-inc ' + cls + '">' + compactSigned(inc) + '</span></div>';
    }).join('');
    const controls = $('#speed-controls');
    controls.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', parseInt(b.dataset.speed, 10) === UI.speed);
    });
  };

  UI.renderMapLegend = function () {
    const el = $('#map-legend');
    if (!el) return;
    if (!UI.game) { el.hidden = true; return; }
    const g = UI.game, p = UI.player();
    const empires = g.state.empires.filter(function (e) { return e.alive; });
    let html = '<div class="map-legend-title">领土颜色</div>';
    empires.forEach(function (e) {
      const war = g.isAtWar(p.id, e.id);
      html += '<div class="legend-row"><span class="legend-dot" style="background:' + e.color + '"></span>' +
        '<span class="lg-name">' + esc(e.name) + (e.isPlayer ? '（你）' : '') + '</span>' +
        (war ? '<span style="color:#ff8a8a">战争</span>' : '') + '</div>';
    });
    const occupied = g.state.colonies.some(function (c) {
      return c.occupiedBy && (c.owner === p.id || c.occupiedBy === p.id);
    });
    const atWar = g.warsFor(p.id).length > 0;
    if (occupied) html += '<div class="legend-occ"><span class="legend-x">×</span>被占领 <span style="color:#ff6b6b;margin-left:4px">◌</span> 敌方目标</div>';
    else if (atWar) html += '<div class="legend-occ" style="color:var(--dim);border-top-color:rgba(255,255,255,.06)"><span style="color:#ff6b6b">◌</span> 红圈 = 敌方战争目标</div>';
    html += '<div class="legend-occ" style="color:var(--dim);border-top-color:rgba(255,255,255,.06)">航道半色 = 国界</div>';
    el.innerHTML = html;
    el.hidden = false;
  };

  UI.resourceTip = function (k) {
    const p = UI.player();
    const r = SM.RESOURCES[k];
    let tip = r.name + '\n库存 ' + fmt(p.resources[k] || 0) + '    月收入 ' + signed(p.income[k] || 0);
    if (k === 'energy') tip += '\n维护费 ' + fmt(p.upkeep ? p.upkeep.energy : 0) + '/月（建筑与舰队）';
    if (k === 'food') tip += '\n人口消耗 ' + fmt(p.popCount * SM.BASE.popFoodUpkeep) + '/月';
    if (k === 'consumer_goods') tip += '\n人口消耗 ' + fmt(p.popCount * SM.BASE.popCGUpkeep) + '/月';
    if (k === 'influence') tip += '\n用于殖民、宣战与外交';
    if (k === 'unity') tip += '\n用于采纳传统';
    if (k === 'alloys') tip += '\n用于建造舰船与升级星际基地';
    if (k === 'minerals') tip += '\n用于建造区划、建筑与太空站';
    return tip;
  };

  /* ------------------------------------------------------------------ */
  /* 目标 / 状态辅助                                                    */
  /* ------------------------------------------------------------------ */
  UI.objectives = function () {
    const g = UI.game, p = UI.player();
    const surveyed = g.state.systems.filter(function (s) { return s.surveyed[p.id]; }).length;
    const colonies = g.empireColonyCount(p);
    let stations = 0;
    g.state.systems.forEach(function (s) {
      ['mining', 'research'].forEach(function (t) {
        if (s.stations[t] && s.stations[t].built && s.stations[t].owner === p.id) stations++;
      });
    });
    const techs = Object.keys(p.techs).length;
    const warships = g.state.fleets.reduce(function (a, f) {
      if (f.owner !== p.id || f.kind !== 'combat') return a;
      return a + f.ships.length;
    }, 0);
    const contacts = Object.keys(p.contacts || {}).length;
    const captured = g.state.stats.coloniesOccupied || 0;
    const board = g.scoreBoard();
    const first = board.length && board[0].id === p.id;
    return [
      { text: '调查 3 个星系', done: surveyed >= 3, hint: surveyed + '/3' },
      { text: '建立第二个殖民地', done: colonies >= 2, hint: colonies + '/2' },
      { text: '建造 2 座太空站', done: stations >= 2, hint: stations + '/2' },
      { text: '完成 3 项科技', done: techs >= 3, hint: techs + '/3' },
      { text: '拥有 5 艘战舰', done: warships >= 5, hint: warships + '/5' },
      { text: '与一个外星帝国建立通讯', done: contacts >= 1, hint: contacts + '/1' },
      { text: '占领一座敌方殖民地', done: captured >= 1, hint: captured + '/1' },
      { text: '成为银河首强', done: first, hint: first ? '已达成' : '看分数' }
    ];
  };

  UI.quests = function () {
    const g = UI.game, p = UI.player();
    const surveyed = g.state.systems.filter(function (s) { return s.surveyed[p.id]; }).length;
    const colonies = g.empireColonyCount(p);
    let stations = 0;
    g.state.systems.forEach(function (s) {
      ['mining', 'research'].forEach(function (t) {
        if (s.stations[t] && s.stations[t].built && s.stations[t].owner === p.id) stations++;
      });
    });
    const warships = g.state.fleets.reduce(function (a, f) {
      if (f.owner !== p.id || f.kind !== 'combat') return a;
      return a + f.ships.length;
    }, 0);
    const contacts = Object.keys(p.contacts || {}).length;
    const captured = (p.stats && p.stats.coloniesCaptured) || 0;
    const researchCount = Object.keys(p.techs || {}).length >= 3 ? 3 : SM.RESEARCH_ORDER.filter(function (cat) {
      const r = p.research[cat];
      return r.current || r.progress > 0 || (UI.questFlags.research && UI.questFlags.research[cat]);
    }).length;
    return [
      {
        id: 'research', title: '选择三个研究项目', hint: researchCount + '/3',
        desc: '研究不会自动开始。三个领域各选一个，科技是殖民、造舰和扩张的基础。',
        done: researchCount >= 3, action: 'open-tech', actionLabel: '选择研究'
      },
      {
        id: 'survey', title: '调查 3 个星系', hint: Math.min(surveyed, 3) + '/3',
        desc: '科研船会自动调查未知星系。只有调查过的星系才能发现宜居行星、资源点和异常。',
        done: surveyed >= 3, action: 'select-science', actionLabel: '查看科研船'
      },
      {
        id: 'colony', title: '建立第一个殖民地', hint: colonies + '/2',
        desc: '找到宜居行星，在「殖民目标」里派遣殖民船。殖民需要合金与影响力，目标需在领土 4 跳内。',
        done: colonies >= 2, action: 'open-colony-targets', actionLabel: '打开殖民目标'
      },
      {
        id: 'station', title: '建造 2 座太空站', hint: stations + '/2',
        desc: '工程船会自动在领土内建造采矿站/研究站，直接产出资源，是前期最重要的收入来源。',
        done: stations >= 2, action: 'select-construction', actionLabel: '查看工程船'
      },
      {
        id: 'fleet', title: '拥有 5 艘战舰', hint: warships + '/5',
        desc: '在帝国船坞建造护卫舰。舰队是保护殖民地、清剿原生生物和发动战争的唯一手段。',
        done: warships >= 5, action: 'open-shipyard', actionLabel: '打开帝国船坞'
      },
      {
        id: 'diplomacy', title: '打开外交面板', hint: contacts ? '已建立通讯' : '未接触',
        desc: '接触外星帝国后可以赠礼改善关系、宣战或停战。关系越差，越容易被宣战。',
        done: UI.questFlags.openedDiplomacy || !!p.stats.openedDiplomacy, action: 'open-diplomacy', actionLabel: '打开外交'
      },
      {
        id: 'war', title: '占领一座敌方殖民地', hint: captured + '/1',
        desc: '战争流程：舰队进入敌方星系 → 摧毁星际基地 → 轨道轰炸削减行星防御 → 占领。停战按现状划界。',
        done: captured >= 1, action: 'open-war-room', actionLabel: '战争指挥'
      }
    ];
  };

  UI.nextQuest = function () {
    const qs = UI.quests();
    return qs.find(function (q) { return !q.done; }) || null;
  };

  UI.checkQuestProgress = function () {
    if (!UI.game) return;
    const qs = UI.quests();
    const done = qs.filter(function (q) { return q.done; }).length;
    if (done > UI.lastQuestDone) {
      const just = qs.filter(function (q) { return q.done; }).slice(-1)[0];
      UI.lastQuestDone = done;
      if (just) UI.toast({ type: 'info', icon: '🎯', text: '任务完成：' + just.title });
      UI.panelDirty = true;
    }
  };

  UI.warnings = function () {
    const g = UI.game, p = UI.player();
    const out = [];
    if (!p.research.physics.current) out.push({ icon: '🔭', text: '物理学研究空闲，点击选择项目' });
    if (!p.research.society.current) out.push({ icon: '🧬', text: '社会学研究空闲，点击选择项目' });
    if (!p.research.engineering.current) out.push({ icon: '🛠', text: '工程学研究空闲，点击选择项目' });
    if ((p.income.food || 0) < 0) out.push({ icon: '🌾', text: '食物短缺：人口增长减缓，可能发生饥荒', bad: true });
    if ((p.income.energy || 0) < 0) out.push({ icon: '⚡', text: '能量币赤字：注意舰队与建筑维护', bad: true });
    if ((p.income.consumer_goods || 0) < 0) out.push({ icon: '📦', text: '消费品短缺：请建造民用工厂', bad: true });
    if ((p.unemployed || 0) > 0) out.push({ icon: '👥', text: p.unemployed + ' 人口失业：建造区划或建筑提供岗位' });
    if ((p.housingShortage || false)) out.push({ icon: '🏠', text: '住房不足：建造城市区划', bad: true });
    const fleets = g.combatFleets(p).reduce(function (a, f) { return a + f.ships.length; }, 0);
    if (fleets < 3 && g.anyWar(p)) out.push({ icon: '⚠', text: '战争期间舰队规模过小', bad: true });
    return out;
  };

  /* ------------------------------------------------------------------ */
  /* 左栏                                                                */
  /* ------------------------------------------------------------------ */
  UI.renderLeft = function () {
    if (!UI.game) return;
    const box = $('#left-panel');
    const old = box.querySelector('.panel-body');
    const scroll = old ? old.scrollTop : 0;
    let html;
    const sel = UI.selected;
    if (!sel) html = UI.viewEmpire();
    else if (sel.type === 'system') html = UI.viewSystem(sel.id);
    else if (sel.type === 'planet') html = UI.viewPlanet(sel.id);
    else if (sel.type === 'fleet') html = UI.viewFleet(sel.id);
    else html = UI.viewEmpire();
    box.innerHTML = html;
    const nb = box.querySelector('.panel-body');
    if (nb) nb.scrollTop = scroll;
  };

  UI.panelHead = function (kicker, title, sub) {
    return '<div class="panel-head">' +
      '<div class="panel-kicker">' + kicker + '</div>' +
      '<div class="panel-title">' + title + '</div>' +
      (sub ? '<div class="panel-sub">' + sub + '</div>' : '') +
      '</div>';
  };

  UI.viewEmpire = function () {
    const g = UI.game, p = UI.player();
    const colonies = g.empireColonyCount(p);
    const pops = g.empirePops(p);
    const power = g.empirePower(p);
    const systems = g.ownedSystems(p.id).length;
    const techs = Object.keys(p.techs).length;
    const obj = UI.quests();
    const done = obj.filter(function (o) { return o.done; }).length;
    let h = UI.panelHead('银河概览', esc(p.name),
      esc(p.species) + ' · ' + (SM.DIFFICULTY[g.state.difficulty] || {}).name + ' 难度 · ' + SM.dateParts(g.state.day).year + ' 年');
    h += '<div class="panel-body">';
    h += '<div class="kv-grid">' +
      kv('殖民地', colonies, '颗') + kv('总人口', pops, '人') +
      kv('舰队力量', power, '') + kv('控制星系', systems, '个') +
      kv('已研究科技', techs, '项') + kv('当前得分', g.scoreOf(p), '') +
      '</div>';
    const cap = p.capital ? g.colony(p.capital) : null;
    if (cap) {
      const capSys = g.system(cap.systemId);
      h += '<div class="build-row" style="margin-top:9px;background:rgba(255,209,102,0.06);border:1px solid rgba(255,209,102,0.28);border-radius:10px;padding:8px 10px">' +
        '<span class="ic" style="color:var(--gold)">★</span>' +
        '<div><div class="nm">首都 · ' + esc(cap.name) + '</div><div class="sub">' +
        (capSys ? esc(capSys.name) + ' 星系 · ' : '') + cap.pops + ' 人口</div></div>' +
        '<div class="right"><button class="btn small" data-action="goto-capital">定位</button>' +
        '<button class="btn small primary" data-action="open-shipyard" data-colony="' + cap.id + '">⚓ 船坞</button></div></div>';
    }
    h += '<div class="section"><div class="section-title">帝国进度</div>' +
      '<div class="progress green"><i style="width:' + (done / obj.length * 100) + '%"></i></div>' +
      '<div class="small" style="text-align:left;margin-top:6px">' + done + ' / ' + obj.length + ' 个里程碑已达成</div></div>';
    const warn = UI.warnings();
    if (warn.length) {
      h += '<div class="section"><div class="section-title">需要关注</div>';
      warn.slice(0, 5).forEach(function (w) {
        h += '<div class="obj"><span class="mark" style="border-color:' + (w.bad ? 'rgba(255,107,107,.5)' : 'var(--line-strong)') + '">' + w.icon + '</span><span>' + esc(w.text) + '</span></div>';
      });
      h += '</div>';
    }
    h += '<div class="section"><div class="section-title">快捷操作</div><div class="btn-row">' +
      '<button class="btn" data-action="open-colonies">🏙 殖民地</button>' +
      '<button class="btn" data-action="open-war-room">🎯 战争指挥</button>' +
      '<button class="btn" data-action="open-shipyard">⚓ 帝国船坞</button>' +
      '<button class="btn" data-action="open-diplomacy">🕊 外交</button>' +
      '<button class="btn" data-action="open-traditions">☯ 传统</button>' +
      '<button class="btn" data-action="open-help">❓ 教程</button>' +
      '</div></div>';
    h += '<div class="section"><div class="section-title">银河态势</div>';
    const others = g.state.empires.filter(function (e) { return e.id !== p.id && e.alive; });
    others.forEach(function (e) {
      const contacted = !!p.contacts[e.id];
      const war = g.isAtWar(p.id, e.id);
      const rel = g.relation(p.id, e.id);
      h += '<div class="diplo-row" data-action="open-diplomacy" data-empire="' + e.id + '">' +
        '<div class="diplo-top"><span class="color-dot" style="background:' + e.color + ';color:' + e.color + '"></span>' +
        '<span class="diplo-name">' + esc(e.name) + '</span>' +
        '<span class="diplo-rel" style="color:' + (war ? 'var(--red)' : rel >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (war ? '战争' : contacted ? (rel >= 0 ? '+' : '') + Math.round(rel) : '未接触') + '</span></div>' +
        '<div class="diplo-sub"><span>' + g.empireColonyCount(e) + ' 殖民地</span><span>战力 ' + g.empirePower(e) + '</span></div></div>';
    });
    h += '</div>';
    h += '<div class="empty">点击星图上的星系查看详情。右键移动选中的舰队。</div>';
    h += '</div>';
    return h;
  };

  function kv(k, v, unit) {
    return '<div class="kv"><div class="k">' + esc(k) + '</div><div class="v">' + (typeof v === 'number' ? fmt(v) : esc(v)) +
      (unit ? ' <small>' + unit + '</small>' : '') + '</div></div>';
  }

  UI.viewSystem = function (sysId) {
    const g = UI.game, p = UI.player();
    const sys = g.system(sysId);
    if (!sys) return UI.viewEmpire();
    const owner = sys.owner ? g.empire(sys.owner) : null;
    const known = !!sys.surveyed[p.id];
    const star = SM.STAR_TYPES[sys.star];
    const capColony = p.capital ? g.colony(p.capital) : null;
    const isCapSystem = !!(capColony && capColony.systemId === sys.id);
    let h = UI.panelHead(isCapSystem ? '首都星系 · ' + star.name : '恒星系 · ' + star.name, esc(sys.name),
      (owner ? '<span style="color:' + owner.color + '">' + esc(owner.name) + '</span> 的领土' : '无主星系') +
      ' · ' + (known ? '已调查' : '未调查') +
      (sys.core ? ' · 银河核心' : ''));
    h += '<div class="panel-body">';
    // 战斗
    if (sys.battle) h += UI.battleBox(sys);
    // 状态标签
    const occupiedColony = sys.planets.map(function (pl) {
      return pl.colonyId ? g.colony(pl.colonyId) : null;
    }).find(function (c) { return c && c.occupiedBy; });
    h += '<div class="btn-row" style="margin-bottom:12px">' +
      (isCapSystem ? tag('★ 首都', 'gold') : '') +
      (known ? tag('已调查', 'cyan') : tag('未调查', 'gold')) +
      (owner ? (owner.id === p.id ? tag('己方领土', 'green') : tag('他国领土', 'red')) : tag('无主', '')) +
      (occupiedColony ? tag('殖民地被占领', 'red') : '') +
      (sys.hostiles ? tag('原生物种', 'red') : '') +
      '</div>';
    if (owner && owner.id !== p.id && g.isAtWar(p.id, owner.id)) {
      const targetColony = sys.colonyId ? g.colony(sys.colonyId) : null;
      h += '<div class="war-target-box"><div class="wt-title">🎯 敌方星系 · 可攻击</div>' +
        '<div class="small" style="text-align:left;margin-top:4px">' +
        (targetColony ? '目标殖民地：<b>' + esc(targetColony.name) + '</b> · 防御 ' + Math.round(targetColony.defense) + ' · 星基 Lv.' + targetColony.starbase.level : '该星系没有殖民地，可以攻击敌方舰队或太空站。') +
        '</div><div class="btn-row" style="margin-top:7px">' +
        '<button class="btn primary" data-action="war-attack" data-system="' + sys.id + '">➤ 派舰队攻击</button>' +
        '<button class="btn" data-action="open-war-room">战争指挥</button></div></div>';
    }
    // 舰队
    const fleets = g.fleetsIn(sys.id);
    if (fleets.length) {
      h += '<div class="section"><div class="section-title">星系内舰队</div>';
      fleets.forEach(function (f) {
        const fe = f.owner ? g.empire(f.owner) : null;
        const active = UI.selected && UI.selected.type === 'fleet' && UI.selected.id === f.id ? ' active' : '';
        h += '<div class="fleet-card clickable' + active + '" data-action="select-fleet" data-fleet="' + f.id + '">' +
          '<div class="top"><span class="color-dot" style="background:' + (fe ? fe.color : '#c77dff') + ';color:' + (fe ? fe.color : '#c77dff') + '"></span>' +
          '<span class="fleet-name">' + esc(f.name) + '</span>' +
          '<span class="fleet-power">' + (f.kind === 'combat' ? '战力 ' + g.fleetPower(f) : '') + '</span></div>' +
          '<div class="fleet-meta">' + (fe ? esc(fe.name) : '中立生物') + ' · ' + f.ships.length + ' 艘' +
          (f.mission ? ' · ' + missionText(f.mission) : '') + '</div></div>';
      });
      h += '</div>';
    }
    // 行星
    h += '<div class="section"><div class="section-title">行星</div>';
    sys.planets.forEach(function (pl) {
      const col = pl.colonyId ? g.colony(pl.colonyId) : null;
      const colOwner = col ? g.empire(col.owner) : null;
      const occupier = col && col.occupiedBy ? g.empire(col.occupiedBy) : null;
      const displayOwner = occupier || colOwner;
      const dotsColor = known ? pcolor(pl) : '#4a5a78';
      let tags = '';
      if (!known) tags = tag('未知', '');
      else if (occupier) tags = tag(occupier.id === p.id ? '已占领' : '被 ' + occupier.name + ' 占领', occupier.id === p.id ? 'green' : 'red');
      else if (col && col.id === p.capital) tags = tag('★ 首都', 'gold');
      else if (col) tags = tag(colOwner && colOwner.id === p.id ? '殖民地' : (colOwner ? colOwner.name : '殖民地'), colOwner && colOwner.id === p.id ? 'green' : 'red');
      else if (pl.habitable) tags = tag('可殖民', 'gold');
      else if (pl.deposits.energy + pl.deposits.minerals > 0) tags = tag('资源点', 'cyan');
      const active = UI.selected && UI.selected.type === 'planet' && UI.selected.id === pl.id ? ' active' : '';
      const rowStyle = displayOwner
        ? ' style="border-left:3px solid ' + displayOwner.color + ';background:linear-gradient(90deg,' + SM.hexToRgba(displayOwner.color, 0.12) + ',rgba(0,0,0,0) 66%)"'
        : '';
      h += '<button class="planet-row' + active + (col ? ' owned' : '') + '"' + rowStyle + ' data-action="select-planet" data-planet="' + pl.id + '">' +
        '<span class="planet-dot" style="background:' + dotsColor + '"></span>' +
        '<span class="li-main"><span class="planet-name">' + esc(known ? pl.name : '未知行星') + '</span>' +
        '<span class="planet-meta">' + (known ? pname(pl) + ' · 大小 ' + pl.size : '需要调查') + '</span></span>' +
        '<span class="planet-tags">' + tags + '</span></button>';
    });
    h += '</div>';
    // 太空站
    if (!sys.colonyId) {
      h += '<div class="section"><div class="section-title">太空站</div>';
      if (known) {
        ['mining', 'research'].forEach(function (type) {
          const st = sys.stations[type];
          const label = type === 'mining' ? '采矿站' : '研究站';
          if (st && st.built) {
            const se = st.owner ? g.empire(st.owner) : null;
            const y = g.stationIncome(sys, type);
            const yStr = Object.keys(y).map(function (k) { return (SM.RESOURCES[k] ? SM.RESOURCES[k].icon : '') + y[k]; }).join(' ');
            h += '<div class="build-row"><span class="ic">' + (type === 'mining' ? '⛏' : '🔭') + '</span>' +
              '<div><div class="nm">' + label + '</div><div class="sub">' + (se ? esc(se.name) : '') + ' · 产出 ' + yStr + '</div></div>' +
              '<div class="right">' + tag('已建成', 'green') + '</div></div>';
          } else if (st && st.building) {
            h += '<div class="build-row"><span class="ic">' + (type === 'mining' ? '⛏' : '🔭') + '</span>' +
              '<div><div class="nm">' + label + '</div><div class="sub">建造中……</div></div>' +
              '<div class="right">' + tag('施工中', 'gold') + '</div></div>';
          } else {
            const info = UI.stationInfo(sys, type);
            h += '<div class="build-row"><span class="ic">' + (type === 'mining' ? '⛏' : '🔭') + '</span>' +
              '<div><div class="nm">' + label + '</div><div class="sub">' + UI.depositText(sys.deposits) + ' · 造价 ' + info.cost + ' 矿物</div></div>' +
              '<div class="right"><button class="btn small" data-action="build-station" data-system="' + sys.id + '" data-type="' + type + '"' +
              (info.ok ? '' : ' disabled title="' + esc(info.reason) + '"') + '>建造</button></div></div>';
            if (!info.ok) h += '<div class="small" style="text-align:left;margin:-2px 0 4px 32px;color:#8b6b6b">' + esc(info.reason) + '</div>';
          }
        });
      } else {
        h += '<div class="empty">调查该星系后才能发现资源点。</div>';
      }
      h += '</div>';
    }
    // 快速操作
    h += '<div class="section"><div class="section-title">操作</div><div class="btn-row">';
    {
      const sci = fleets.find(function (f) { return f.owner === p.id && f.kind === 'science'; });
      if (sci && !sys.surveyed[p.id]) h += '<button class="btn" data-action="survey" data-fleet="' + sci.id + '">🔭 开始调查</button>';
    }
    if (sys.colonyId) {
      const col = g.colony(sys.colonyId);
      if (col && col.owner === p.id) {
        h += '<button class="btn primary" data-action="select-planet" data-planet="' + col.planetId + '">管理殖民地</button>';
        h += '<button class="btn" data-action="open-shipyard" data-colony="' + col.id + '">⚓ 船坞</button>';
        h += '<button class="btn" data-action="open-colonies">🏙 殖民地总览</button>';
      }
    }
    h += '<button class="btn" data-action="focus-system" data-system="' + sys.id + '">🎯 聚焦</button>';
    h += '</div></div>';
    h += '</div>';
    return h;
  };

  UI.depositText = function (dep) {
    if (!dep) return '无资源';
    const parts = [];
    if (dep.energy) parts.push('⚡' + dep.energy);
    if (dep.minerals) parts.push('⛏' + dep.minerals);
    if (dep.research) parts.push('🔭' + dep.research);
    return parts.length ? parts.join(' ') : '无资源';
  };

  UI.stationInfo = function (sys, type) {
    const g = UI.game, p = UI.player();
    const check = g.canBuildStation(sys, type, p);
    const cost = g.stationCost(p);
    const cons = g.state.fleets.some(function (f) {
      return f.owner === p.id && f.kind === 'construction' && f.ships.length && !f.mission;
    });
    let reason = null;
    if (!check.ok) reason = check.reason;
    else if (!cons) reason = '没有空闲的工程船';
    else if (p.resources.minerals < cost) reason = '矿物不足（需要 ' + cost + '）';
    return { ok: !reason, reason: reason || '', cost: cost };
  };

  UI.battleBox = function (sys) {
    const g = UI.game, p = UI.player();
    const fleets = g.fleetsIn(sys.id);
    const groups = {};
    fleets.forEach(function (f) {
      const key = f.owner || 'neutral';
      const ge = f.owner ? g.empire(f.owner) : null;
      groups[key] = groups[key] || { name: ge ? ge.name : '中立生物', color: ge ? ge.color : '#c77dff', ships: 0, power: 0, hostile: f.owner ? g.isAtWar(f.owner, p.id) : true };
      groups[key].ships += f.ships.length;
      groups[key].power += g.fleetPower(f);
    });
    const sides = Object.keys(groups).map(function (k) { return groups[k]; });
    if (!sides.length) return '';
    let h = '<div class="battle-box"><div class="battle-title">💥 战斗进行中<span style="margin-left:auto;font-size:10px;color:var(--dim)">第 ' + (g.state.day - sys.battle.startDay) + ' 天</span></div>' +
      '<div class="battle-sides">';
    if (sides.length >= 2) {
      h += '<div class="battle-side"><b>' + sides[0].ships + '</b><span style="color:' + sides[0].color + '">' + esc(sides[0].name) + '</span><div class="small" style="margin:0">战力 ' + sides[0].power + '</div></div>' +
        '<div class="battle-vs">VS</div>' +
        '<div class="battle-side"><b>' + sides[1].ships + '</b><span style="color:' + sides[1].color + '">' + esc(sides[1].name) + '</span><div class="small" style="margin:0">战力 ' + sides[1].power + '</div></div>';
    } else {
      h += '<div class="battle-side" style="grid-column:1/-1"><b>' + sides[0].ships + '</b><span style="color:' + sides[0].color + '">' + esc(sides[0].name) + '</span></div>';
    }
    h += '</div>';
    if (sys.battle.log && sys.battle.log.length) {
      sys.battle.log.slice(-2).forEach(function (l) {
        h += '<div class="small" style="text-align:left;margin-top:4px;color:#d6a3a3">· ' + esc(l.text) + '</div>';
      });
    }
    h += '</div>';
    return h;
  };

  function missionText(m) {
    if (!m) return '';
    if (m.type === 'survey') return '调查中';
    if (m.type === 'building') return '建造太空站';
    if (m.type === 'colonizing') return '殖民中';
    if (m.type === 'travelBuild') return '前往建造';
    if (m.type === 'travelColonize') return '前往殖民';
    return '';
  }

  UI.viewPlanet = function (planetId) {
    const g = UI.game, p = UI.player();
    const planet = g.planet(planetId);
    if (!planet) return UI.viewEmpire();
    const sys = g.planetSystem(planet.id);
    const known = sys && sys.surveyed[p.id];
    const col = planet.colonyId ? g.colony(planet.colonyId) : null;
    const colOwner = col ? g.empire(col.owner) : null;
    const occupier = col && col.occupiedBy ? g.empire(col.occupiedBy) : null;
    let kicker = '行星';
    if (col) {
      if (occupier) kicker = occupier.id === p.id ? '已占领' : '被占领';
      else if (col.owner === p.id) kicker = col.id === p.capital ? '首都殖民地' : '殖民地';
      else kicker = '敌方殖民地';
    }
    const titleTag = occupier ? (occupier.id === p.id ? ' <span class="tag cyan">已占领</span>' : ' <span class="tag red">被占领</span>') : '';
    let h = UI.panelHead(
      kicker,
      esc(known ? planet.name : '未知世界') + titleTag,
      (known ? pname(planet) + ' · 大小 ' + planet.size : '需要调查') +
      (sys ? ' · ' + esc(sys.name) + ' 星系' : '') +
      (occupier ? ' · 被 ' + esc(occupier.name) + ' 占领' : '')
    );
    h += '<div class="panel-body">';
    if (!known) {
      h += '<div class="empty">这颗行星尚未被调查。派一艘科研船来，或者等待自动调查完成。</div>';
      h += '<button class="btn wide" data-action="back-system">← 返回星系</button></div>';
      return h;
    }
    if (col) {
      const displayOwner = occupier || colOwner;
      if (displayOwner) {
        h += '<div class="owner-banner' + (occupier ? ' occupied' : '') + '" style="border-color:' + displayOwner.color +
          ';background:linear-gradient(90deg,' + SM.hexToRgba(displayOwner.color, 0.16) + ',rgba(0,0,0,0) 72%)">' +
          '<span class="legend-dot" style="background:' + displayOwner.color + '"></span>' +
          '<span class="ob-name">' + esc(displayOwner.name) + '</span>' +
          '<span class="ob-sub">' + (occupier ? '占领者' : (col.owner === p.id ? '你的殖民地' : '殖民地')) + '</span>' +
          (occupier ? '<span class="tag red">被占领</span>' : '') + '</div>';
      }
      h += UI.colonyView(col, colOwner);
    } else if (planet.habitable) {
      h += UI.colonizeView(planet, sys);
    } else {
      h += UI.barrenView(planet, sys);
    }
    h += '<div class="section" style="margin-top:14px"><div class="btn-row">' +
      '<button class="btn" data-action="back-system" data-system="' + (sys ? sys.id : '') + '">← 返回星系</button>' +
      '<button class="btn" data-action="focus-system" data-system="' + (sys ? sys.id : '') + '">🎯 聚焦</button></div></div>';
    h += '</div>';
    return h;
  };

  UI.colonizeView = function (planet, sys) {
    const g = UI.game, p = UI.player();
    const check = g.canColonizeCheck(planet, p);
    const cost = g.colonyShipCost(p);
    const max = planet.maxDistricts || {};
    let h = '<div class="kv-grid">' +
      kv('类型', pname(planet)) + kv('大小', planet.size, '格') +
      kv('城市区划上限', max.city || 0, '') + kv('宜居度', '100%', '') +
      '</div>';
    h += '<div class="section"><div class="section-title">殖民评估</div>' +
      '<div class="small" style="text-align:left;line-height:1.8">' + esc(SM.PLANET_TYPES[planet.type].desc) + '<br>' +
      '殖民费用：<b style="color:var(--gold)">' + cost.alloys + ' 合金</b> + <b style="color:var(--cyan)">' + cost.influence + ' 影响力</b>。' +
      '殖民船将在首都建造，建成后自动前往目标行星。</div>';
    if (!check.ok) h += '<div class="obj" style="margin-top:10px"><span class="mark" style="border-color:rgba(255,107,107,.4)">!</span><span>' + esc(check.reason) + '</span></div>';
    h += '<button class="btn primary wide" style="margin-top:12px" data-action="colonize" data-planet="' + planet.id + '"' +
      (check.ok ? '' : ' disabled') + '>🌱 派遣殖民船</button>';
    if (p.resources.alloys < cost.alloys) h += '<div class="small" style="text-align:left;margin-top:6px;color:#ff9b9b">合金不足</div>';
    if (p.resources.influence < cost.influence) h += '<div class="small" style="text-align:left;margin-top:6px;color:#ff9b9b">影响力不足</div>';
    h += '</div>';
    return h;
  };

  UI.barrenView = function (planet, sys) {
    const g = UI.game;
    let h = '<div class="kv-grid">' + kv('类型', pname(planet)) + kv('大小', planet.size, '格') + '</div>';
    h += '<div class="section"><div class="section-title">行星说明</div><div class="small" style="text-align:left;line-height:1.8">' +
      esc(SM.PLANET_TYPES[planet.type].desc) + '</div></div>';
    h += '<div class="section"><div class="section-title">资源点</div><div class="build-row"><span class="ic">💰</span><div><div class="nm">' +
      UI.depositText(planet.deposits) + '</div><div class="sub">在星系面板建造太空站以开采</div></div></div></div>';
    return h;
  };

  UI.buildSuggestion = function (c, e) {
    const g = UI.game;
    const housing = g.colonyHousing(c);
    const maxD = g.colonyMaxDistricts(c);
    const counts = {};
    c.buildings.forEach(function (b) { counts[b] = (counts[b] || 0) + 1; });
    const queuedB = c.queue.filter(function (q) { return q.type === 'building'; }).length;
    const freeSlots = g.colonyBuildingSlots(c) - g.colonyUsedBuildingSlots(c) - queuedB;
    const canDistrict = function (key) {
      const queued = c.queue.filter(function (q) { return q.type === 'district' && q.key === key; }).length;
      return (c.districts[key] || 0) + queued < (maxD[key] || 0);
    };
    const canBuilding = function (key) {
      const def = SM.BUILDINGS[key];
      if (!def || freeSlots <= 0) return false;
      if (def.req && !e.techs[def.req]) return false;
      if (counts[key] && !def.repeatable) return false;
      return true;
    };
    if (housing <= c.pops + 1 && canDistrict('city')) {
      return { text: '住房紧张。城市区划提供 5 住房与 1 个建筑位，是继续发展人口的前提。', type: 'district', key: 'city' };
    }
    if ((e.income.food || 0) < 0 && canDistrict('agri')) {
      return { text: '食物赤字。农业区划提供 2 个农民岗位（约 +10 食物/月），避免人口饿死。', type: 'district', key: 'agri' };
    }
    if ((e.income.energy || 0) < 0 && canDistrict('generator')) {
      return { text: '能量币赤字。发电区划提供 2 个技师岗位（约 +16 能量/月），是舰队与建筑的燃料。', type: 'district', key: 'generator' };
    }
    if ((e.income.consumer_goods || 0) < 0 && canBuilding('factory')) {
      return { text: '消费品赤字。民用工厂提供 2 个工匠岗位（约 +8 消费品/月），否则研究会减速。', type: 'building', key: 'factory' };
    }
    if ((e.income.alloys || 0) < 12 && canBuilding('foundry')) {
      return { text: '合金不足。合金冶炼厂提供 2 个冶金师岗位（约 +10 合金/月），是造舰的瓶颈。', type: 'building', key: 'foundry' };
    }
    if ((e.income.minerals || 0) < 15 && canDistrict('mining')) {
      return { text: '矿物不足。采矿区划提供 2 个矿工岗位（约 +16 矿物/月），用于区划、建筑与太空站。', type: 'district', key: 'mining' };
    }
    if (c.unemployed > 0) {
      const keys = ['mining', 'generator', 'agri'].filter(canDistrict);
      if (keys.length) return { text: '有 ' + c.unemployed + ' 人口失业。建造区划提供岗位，失业人口会拖慢凝聚力。', type: 'district', key: keys[0] };
    }
    if (freeSlots > 0) {
      if (canBuilding('lab')) return { text: '建筑位空闲。研究实验室提供 2 个研究员岗位（约 +8 研究/月），长期收益最高。', type: 'building', key: 'lab' };
      if (canBuilding('foundry')) return { text: '建筑位空闲。合金冶炼厂把矿物转成合金，支撑更大的舰队。', type: 'building', key: 'foundry' };
      if (canBuilding('factory')) return { text: '建筑位空闲。民用工厂保障消费品供应，避免研究惩罚。', type: 'building', key: 'factory' };
    }
    return { text: '当前殖民地运转正常。可以继续补研究/合金建筑，或打开殖民目标去开拓新世界。', type: null };
  };

  UI.colonyView = function (c, owner) {
    const g = UI.game, p = UI.player();
    const mine = c.owner === p.id;
    const housing = g.colonyHousing(c);
    const slots = g.colonyBuildingSlots(c);
    const usedSlots = g.colonyUsedBuildingSlots(c);
    const jobs = g.colonyJobs(c);
    const totalJobs = Object.keys(jobs).reduce(function (a, k) { return a + jobs[k]; }, 0);
    const assigned = Object.keys(c.assigned || {}).reduce(function (a, k) { return a + c.assigned[k]; }, 0);
    const maxD = g.colonyMaxDistricts(c);
    let h = '';
    if (mine) {
      h += '<div class="colony-nav"><button class="btn small" data-action="colony-prev" title="上一座殖民地">◀</button>' +
        '<button class="btn small" data-action="open-colonies">🏙 全部殖民地</button>' +
        '<button class="btn small" data-action="colony-next" title="下一座殖民地">▶</button></div>';
    }
    if (c.occupiedBy) {
      const occ = g.empire(c.occupiedBy);
      h += '<div class="small" style="text-align:left;color:#ffb3b3;margin:0 0 9px">当前由 ' +
        (occ ? esc(occ.name) : '未知势力') + ' 占领；产出归占领者，停战或和约将决定归属。</div>';
    } else if (!mine) {
      h += '<div class="obj"><span class="mark">👁</span><span>这是 ' + esc(owner ? owner.name : '其他帝国') + ' 的殖民地。防御 ' + Math.round(c.defense) + ' / ' + c.defenseMax + '，星际基地 lv.' + c.starbase.level + '。</span></div>';
    }
    h += '<div class="kv-grid">' +
      kv('人口', c.pops + ' / ' + housing, '') +
      kv('岗位', assigned + ' / ' + totalJobs, '') +
      kv('防御', Math.round(c.defense) + ' / ' + c.defenseMax, '') +
      kv('建筑位', usedSlots + ' / ' + slots, '') +
      kv('失业', c.unemployed || 0, '') +
      kv('星际基地', 'Lv.' + c.starbase.level, '') +
      '</div>';
    h += '<div class="small" style="text-align:left;margin-top:7px;line-height:1.65;color:var(--dim)">区划提供住房与岗位，建筑提供高级岗位；人口会自动分配岗位。岗位空着说明人口不足，住房不足会拖慢增长。</div>';
    if (mine && !c.occupiedBy) {
      const sug = UI.buildSuggestion(c, p);
      let sugCost = 0, sugCan = false, sugReason = '';
      if (sug.type === 'district') {
        sugCost = g.districtCost(p, sug.key);
        sugCan = p.resources.minerals >= sugCost && c.queue.length < 6;
        if (p.resources.minerals < sugCost) sugReason = '矿物不足';
        if (c.queue.length >= 6) sugReason = '建造队列已满';
      } else if (sug.type === 'building') {
        sugCost = g.buildingCost(p, sug.key);
        const free = usedSlots + c.queue.filter(function (q) { return q.type === 'building'; }).length < slots;
        sugCan = free && p.resources.minerals >= sugCost;
        if (!free) sugReason = '建筑位不足';
        else if (p.resources.minerals < sugCost) sugReason = '矿物不足';
      }
      h += '<div class="hint-card"><div class="hint-title">建造建议</div><div class="hint-row">' +
        '<div class="hint-text">' + esc(sug.text) + (sug.type ? '<br><span class="dim">' + (sug.type === 'district' ? '区划' : '建筑') + ' · ' + sugCost + '⛏ · ' + (sug.type === 'district' ? g.buildDays(p, SM.DISTRICTS[sug.key].time) : g.buildDays(p, SM.BUILDINGS[sug.key].time)) + ' 天</span>' : '') + '</div>' +
        (sug.type ? '<button class="btn small primary" data-action="build-suggest" data-colony="' + c.id + '" data-type="' + sug.type + '" data-key="' + sug.key + '" title="' + esc(sugReason) + '"' + (sugCan ? '' : ' disabled') + '>建造</button>' : '') +
        '</div></div>';
    }
    if (mine && !c.occupiedBy) {
      h += '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn primary" data-action="open-shipyard" data-colony="' + c.id + '">⚙ 建造舰船</button>' +
        '<button class="btn" data-action="upgrade-starbase" data-colony="' + c.id + '"' + UI.starbaseUpgradeState(c) + '>🏰 升级基地</button>' +
        '</div>';
    }
    // 建造队列
    if (c.queue.length) {
      h += '<div class="section"><div class="section-title">建造队列</div>';
      c.queue.forEach(function (q, qi) {
        const pct = (1 - q.daysLeft / q.days) * 100;
        h += '<div class="build-row"><span class="ic">🏗</span><div style="flex:1"><div class="nm">' + esc(q.name) + '</div>' +
          bar(pct) + '</div><div class="right"><span class="count-pill">' + Math.max(0, Math.ceil(q.daysLeft)) + '天</span>' +
          '<button class="btn small" data-action="cancel-build" data-colony="' + c.id + '" data-index="' + qi + '" title="取消建造，返还一半矿物">×</button></div></div>';
      });
      h += '</div>';
    }
    // 区划
    if (mine) {
      const totalDistricts = Object.keys(c.districts).reduce(function (a, k) { return a + (c.districts[k] || 0); }, 0);
      const planetSize = (g.planet(c.planetId) || {}).size || 0;
      h += '<div class="section"><div class="section-title">区划 <span>' + totalDistricts + ' / ' + planetSize + '</span></div>';
      SM.DISTRICT_ORDER.forEach(function (key) {
        const def = SM.DISTRICTS[key];
        const built = c.districts[key] || 0;
        const queued = c.queue.filter(function (q) { return q.type === 'district' && q.key === key; }).length;
        const max = maxD[key] || 0;
        const cost = g.districtCost(p, key);
        const days = g.buildDays(p, def.time);
        const can = built + queued < max && p.resources.minerals >= cost && c.queue.length < 6;
        let reason = '';
        if (built + queued >= max) reason = '已达上限';
        else if (c.queue.length >= 6) reason = '队列已满';
        else if (p.resources.minerals < cost) reason = '矿物不足';
        const tip = def.name + '\n' + def.desc + '\n岗位：' + jobSlotsText(def.jobs) + ' → ' + jobOutputText(def.jobs) + '/月' +
          '\n住房 +' + def.housing + '\n造价 ' + cost + ' 矿物 · ' + days + ' 天';
        h += '<div class="district-row" data-tip="' + esc(tip) + '"><span class="ic">' + def.icon + '</span>' +
          '<div><div class="nm">' + esc(def.name) + '</div><div class="sub">' +
          esc(jobSlotsText(def.jobs)) + ' → ' + esc(jobOutputText(def.jobs)) + '/月 · 住房 +' + def.housing +
          ' · ' + cost + '⛏ · ' + days + '天</div></div>' +
          '<div class="right"><span class="count-pill">' + built + '/' + max + (queued ? ' +' + queued : '') + '</span>' +
          '<button class="btn small" data-action="build-district" data-colony="' + c.id + '" data-key="' + key + '" title="' + esc(reason) + '"' +
          (can ? '' : ' disabled') + '>建造</button></div></div>';
      });
      h += '</div>';
    }
    // 建筑
    h += '<div class="section"><div class="section-title">建筑（' + usedSlots + '/' + slots + '）</div>';
    const counts = {};
    c.buildings.forEach(function (b) { counts[b] = (counts[b] || 0) + 1; });
    Object.keys(counts).forEach(function (b) {
      const def = SM.BUILDINGS[b];
      if (!def) return;
      const out = def.jobs ? jobOutputText(def.jobs) : '';
      const effect = def.jobs ? jobSlotsText(def.jobs) + (out ? ' → ' + out + '/月' : '') : (def.growth ? '+' + def.growth + ' 增长/月' : '');
      const tip = def.name + '\n' + (def.desc || '') + (effect ? '\n' + effect : '') +
        (def.defense ? '\n殖民地防御 +' + def.defense : '') + (def.upkeep ? '\n维护 ' + def.upkeep + ' 能量币/月' : '');
      h += '<div class="build-row" data-tip="' + esc(tip) + '"><span class="ic">' + def.icon + '</span><div><div class="nm">' + esc(def.name) + (counts[b] > 1 ? ' ×' + counts[b] : '') + '</div>' +
        '<div class="sub">' + esc(effect || def.desc || '') + (def.upkeep ? ' · 维护 ' + def.upkeep + '⚡' : '') + '</div></div></div>';
    });
    if (mine && !c.occupiedBy) {
      const available = SM.BUILDING_ORDER.filter(function (key) {
        const def = SM.BUILDINGS[key];
        if (def.req && !p.techs[def.req]) return false;
        if (counts[key] && !def.repeatable) return false;
        return true;
      });
      available.forEach(function (key) {
        const def = SM.BUILDINGS[key];
        const cost = g.buildingCost(p, key);
        const days = g.buildDays(p, def.time);
        const free = usedSlots + c.queue.filter(function (q) { return q.type === 'building'; }).length < slots;
        const can = free && p.resources.minerals >= cost;
        let reason = !free ? '建筑位不足（建造城市区划可增加）' : p.resources.minerals < cost ? '矿物不足' : '';
        const out = def.jobs ? jobOutputText(def.jobs) : '';
      const effect = def.jobs ? jobSlotsText(def.jobs) + (out ? ' → ' + out + '/月' : '') : (def.growth ? '+' + def.growth + ' 增长/月' : '');
        const tip = def.name + '\n' + (def.desc || '') + (effect ? '\n' + effect : '') +
          (def.defense ? '\n殖民地防御 +' + def.defense : '') + (def.upkeep ? '\n维护 ' + def.upkeep + ' 能量币/月' : '') +
          '\n造价 ' + cost + ' 矿物 · ' + days + ' 天';
        h += '<div class="build-row" data-tip="' + esc(tip) + '"><span class="ic">' + def.icon + '</span><div><div class="nm">' + esc(def.name) + '</div>' +
          '<div class="sub">' + esc(effect || def.desc || '') + ' · ' + cost + '⛏ · ' + days + '天' +
          (def.upkeep ? ' · 维护 ' + def.upkeep + '⚡' : '') + '</div></div>' +
          '<div class="right"><button class="btn small" data-action="build-building" data-colony="' + c.id + '" data-key="' + key + '" title="' + esc(reason) + '"' +
          (can ? '' : ' disabled') + '>建造</button></div></div>';
      });
    }
    h += '</div>';
    // 岗位
    h += '<div class="section"><div class="section-title">岗位分配</div>';
    let anyJob = false;
    SM.JOB_ORDER.forEach(function (j) {
      const slotsN = jobs[j] || 0;
      const assignedN = (c.assigned && c.assigned[j]) || 0;
      if (!slotsN && !assignedN) return;
      anyJob = true;
      const jd = SM.JOBS[j];
      const unit = Object.keys(jd.out || {}).map(function (k) {
        const meta = SM.RESOURCES[k] || SM.RESEARCH[k];
        return (meta ? meta.icon : '') + jd.out[k];
      }).join(' ');
      const tip = jd.name + (jd.desc ? '\n' + jd.desc : '') + (unit ? '\n每人产出：' + unit + '/月' : '') +
        (jd.defense ? '\n殖民地防御 +' + jd.defense : '');
      h += '<div class="job-row" data-tip="' + esc(tip) + '"><span style="width:62px">' + jd.icon + ' ' + jd.name + '</span>' +
        '<div class="bar"><i style="width:' + (slotsN ? assignedN / slotsN * 100 : 0) + '%"></i></div>' +
        '<span class="num">' + assignedN + '/' + slotsN + '</span></div>';
    });
    if (!anyJob) h += '<div class="empty">暂无岗位。</div>';
    if (c.unemployed) h += '<div class="small" style="text-align:left;margin-top:5px;color:#ffb86b">' + c.unemployed + ' 个失业人口（建造区划或建筑）</div>';
    h += '</div>';
    // 船坞
    if (mine) {
      h += '<div class="section"><div class="section-title">船坞</div>';
      if (c.shipQueue && c.shipQueue.length) {
        c.shipQueue.forEach(function (q) {
          const pct = (1 - q.daysLeft / q.days) * 100;
          h += '<div class="build-row"><span class="ic">' + (SM.SHIPS[q.cls] ? SM.SHIPS[q.cls].icon : '⚙') + '</span><div style="flex:1"><div class="nm">' + esc(q.name) + '</div>' + bar(pct) + '</div>' +
            '<div class="right"><span class="count-pill">' + Math.max(0, Math.ceil(q.daysLeft)) + '天</span></div></div>';
        });
      } else {
        h += '<div class="empty">船坞空闲。点击上方「建造舰船」。</div>';
      }
      h += '</div>';
      const next = c.starbase.level + 1;
      h += '<div class="section"><div class="section-title">星际基地</div>';
      if (next <= 3) {
        const def = SM.STARBASE_LEVELS[next];
        const canTech = g.maxStarbaseLevel(p) >= next;
        h += '<div class="build-row"><span class="ic">🏰</span><div><div class="nm">' + esc(SM.STARBASE_LEVELS[c.starbase.level].name) + '</div>' +
          '<div class="sub">船体 ' + Math.round(c.starbase.hull) + '/' + c.starbase.hullMax + ' · 升级至 ' + esc(def.name) + '：' + def.upgradeCost.alloys + ' 合金</div></div>' +
          '<div class="right"><span class="count-pill">Lv.' + c.starbase.level + '</span></div></div>' +
          (canTech ? '' : '<div class="small" style="text-align:left;margin-left:32px;color:#ffb86b">需要研究「' + esc(def.name) + '」相关科技</div>');
      } else {
        h += '<div class="build-row"><span class="ic">🏰</span><div><div class="nm">' + esc(SM.STARBASE_LEVELS[c.starbase.level].name) + '</div>' +
          '<div class="sub">已达最高等级 · 船体 ' + Math.round(c.starbase.hull) + '/' + c.starbase.hullMax + '</div></div>' +
          '<div class="right"><span class="count-pill">Lv.' + c.starbase.level + '</span></div></div>';
      }
      if (c.starbase.upgrading) {
        const up = c.starbase.upgrading;
        h += bar((1 - up.daysLeft / up.days) * 100, 'gold') +
          '<div class="small" style="text-align:left;margin-top:4px">升级中：剩余 ' + Math.max(0, Math.ceil(up.daysLeft)) + ' 天</div>';
      }
      h += '</div>';
    }
    return h;
  };

  UI.starbaseUpgradeState = function (c) {
    const g = UI.game, p = UI.player();
    const next = c.starbase.level + 1;
    if (next > 3) return ' disabled title="已达最高等级"';
    if (g.maxStarbaseLevel(p) < next) return ' disabled title="需要相关科技"';
    const def = SM.STARBASE_LEVELS[next];
    if (p.resources.alloys < def.upgradeCost.alloys) return ' disabled title="合金不足"';
    if (c.starbase.upgrading) return ' disabled title="正在升级"';
    return '';
  };

  UI.viewFleet = function (fleetId) {
    const g = UI.game, p = UI.player();
    const f = g.fleet(fleetId);
    if (!f) return UI.viewEmpire();
    const owner = f.owner ? g.empire(f.owner) : null;
    const mine = f.owner === p.id;
    const sys = g.system(f.systemId);
    let h = UI.panelHead(
      '舰队 · ' + (f.kind === 'combat' ? '作战' : f.kind === 'science' ? '科研' : f.kind === 'construction' ? '工程' : f.kind === 'colony' ? '殖民' : '中立'),
      esc(f.name),
      (owner ? '<span style="color:' + owner.color + '">' + esc(owner.name) + '</span>' : '中立生物') +
      ' · ' + (sys ? esc(sys.name) : '航行中')
    );
    h += '<div class="panel-body">';
    if (!f.ships.length) return h + '<div class="empty">舰队已经没有舰船。</div></div>';
    h += '<div class="kv-grid">' +
      kv('舰船', f.ships.length, '艘') +
      kv('战力', f.kind === 'combat' ? g.fleetPower(f) : 0, '') +
      kv('维护', signed(-f.ships.reduce(function (a, s) { return a + (SM.SHIPS[s.cls].upkeep || 0); }, 0)) + '⚡', '') +
      kv('航速', (SM.SHIPS[f.ships[0].cls] ? SM.SHIPS[f.ships[0].cls].speed : 1).toFixed(2), '')
      + '</div>';
    if (f.kind === 'science' || f.kind === 'construction' || f.kind === 'colony' || f.kind === 'combat') {
      const role = f.kind === 'science' ? '科研船会自动调查未探索星系。只有调查过的星系才能发现宜居行星、资源点和异常。通常 1–2 艘就够。' :
        f.kind === 'construction' ? '工程船会自动在领土内建造采矿站/研究站。太空站直接产出资源，是前期最重要的收入来源。通常 1–2 艘就够。' :
        f.kind === 'colony' ? '殖民船前往目标行星建立殖民地。从「殖民目标」或行星面板派遣。' :
        '作战舰队用于保护殖民地、清剿原生生物和发动战争。右键星图移动，不要分散。';
      h += '<div class="hint-card" style="margin:9px 0"><div class="hint-title">这艘船做什么</div><div class="hint-text">' + esc(role) +
        ((f.kind === 'science' || f.kind === 'construction') ? '<br>当前模式：<b>' + (f.auto ? '自动' : '手动') + '</b>' + (f.mission ? ' · 正在执行任务' : ' · 空闲') : '') + '</div></div>';
    }
    if (f.travel) {
      const to = g.system(f.travel.to);
      const pct = f.travel.progress / f.travel.total * 100;
      h += '<div class="section"><div class="section-title">航行</div><div class="small" style="text-align:left">前往 ' + esc(to ? to.name : '？') + '</div>' + bar(pct) + '</div>';
    }
    if (f.mission) {
      const m = f.mission;
      if (m.type === 'survey' || m.type === 'building' || m.type === 'colonizing') {
        const pct = m.progress / m.days * 100;
        h += '<div class="section"><div class="section-title">任务：' + missionText(m) + '</div>' + bar(pct) + '</div>';
      } else {
        h += '<div class="section"><div class="section-title">任务</div><div class="small" style="text-align:left">' + missionText(m) + '</div></div>';
      }
    }
    // 编成
    h += '<div class="section"><div class="section-title">编成</div>';
    const byCls = {};
    f.ships.forEach(function (s) { byCls[s.cls] = (byCls[s.cls] || 0) + 1; });
    Object.keys(byCls).forEach(function (cls) {
      const def = SM.SHIPS[cls];
      const ships = f.ships.filter(function (s) { return s.cls === cls; });
      const avgHull = ships.reduce(function (a, s) { return a + s.hull / s.hullMax; }, 0) / ships.length;
      h += '<div class="build-row"><span class="ic">' + def.icon + '</span><div style="flex:1"><div class="nm">' + def.name + ' ×' + byCls[cls] + '</div>' +
        '<div class="progress"><i style="width:' + (avgHull * 100) + '%;background:linear-gradient(90deg,#3fae6b,#7bf1a8)"></i></div></div>' +
        '<div class="right"><span class="count-pill">' + Math.round(avgHull * 100) + '%</span></div></div>';
    });
    h += '</div>';
    if (mine) {
      h += '<div class="section"><div class="section-title">指令</div><div class="btn-row">';
      if (f.kind === 'science' || f.kind === 'construction') {
        h += '<button class="btn" data-action="toggle-auto" data-fleet="' + f.id + '">' + (f.auto ? '⏹ 关闭自动' : '▶ 开启自动') + '</button>';
      }
      if (f.kind === 'combat') {
        h += '<button class="btn primary" data-action="open-war-room" data-fleet="' + f.id + '">🎯 选择攻击目标</button>';
        const sibling = g.state.fleets.find(function (o) {
          return o.owner === f.owner && o.id !== f.id && o.kind === 'combat' && o.systemId === f.systemId && !o.travel;
        });
        if (sibling) h += '<button class="btn" data-action="merge-fleet" data-fleet="' + f.id + '" data-other="' + sibling.id + '">🔗 合并舰队</button>';
      }
      const cap = p.capital ? g.colony(p.capital) : null;
      if (cap) h += '<button class="btn" data-action="return-home" data-fleet="' + f.id + '" data-system="' + cap.systemId + '">🏠 返回首都</button>';
      h += '</div><div class="small" style="text-align:left;margin-top:8px">' +
        (f.kind === 'combat' ? '点「选择攻击目标」进入战争指挥；也可以直接右键敌方星系 = 派舰队攻击。' : '右键点击星图上的星系即可移动。') + '</div></div>';
    } else if (owner) {
      h += '<div class="section"><div class="section-title">情报</div><div class="small" style="text-align:left">' +
        (g.isAtWar(p.id, owner.id) ? '该舰队属于交战国，进入其所在星系将自动开战。' : '该舰队属于外国势力。') + '</div></div>';
    }
    h += '</div>';
    return h;
  };

  /* ------------------------------------------------------------------ */
  /* 右栏                                                                */
  /* ------------------------------------------------------------------ */
  UI.renderRight = function (force) {
    if (!UI.game) return;
    const box = $('#right-panel');
    const old = box.querySelector('.tab-body');
    const scroll = old ? old.scrollTop : 0;
    const p = UI.player();
    let body = '';
    if (UI.tab === 'overview') body = UI.tabOverview();
    else if (UI.tab === 'territory') body = UI.tabTerritory();
    else if (UI.tab === 'diplo') body = UI.tabDiplo();
    else body = UI.tabLog();
    box.innerHTML =
      '<div class="panel-head" style="padding-bottom:11px">' +
      '<div class="panel-kicker">' + esc(p.name) + '</div>' +
      '<div class="panel-title" style="font-size:15px">' + ['帝国概览', '殖民地与舰队', '星际外交', '银河日志'][['overview', 'territory', 'diplo', 'log'].indexOf(UI.tab)] + '</div>' +
      '</div>' +
      '<div class="tabs">' +
      ['overview:概览', 'territory:殖民地', 'diplo:外交', 'log:日志'].map(function (t) {
        const id = t.split(':')[0];
        return '<button class="tab' + (UI.tab === id ? ' active' : '') + '" data-tab="' + id + '">' + t.split(':')[1] + '</button>';
      }).join('') +
      '</div>' +
      '<div class="tab-body">' + body + '</div>';
    const nb = box.querySelector('.tab-body');
    if (nb) nb.scrollTop = scroll;
  };

  UI.tabOverview = function () {
    const g = UI.game, p = UI.player();
    let h = '';
    // 舰长任务：始终把下一步放在最显眼的位置
    const qs = UI.quests();
    const qDone = qs.filter(function (q) { return q.done; }).length;
    const next = qs.find(function (q) { return !q.done; });
    h += '<div class="quest-card">' +
      '<div class="quest-kicker">舰长任务 · ' + qDone + '/' + qs.length + '</div>' +
      '<div class="quest-title">' + (next ? esc(next.title) : '全部任务完成') + '</div>' +
      '<div class="quest-desc">' + (next ? esc(next.desc) : '你已经掌握了基本循环。继续扩张、研究传统，向 2250 年的银河首强前进。') + '</div>' +
      (next ? '<button class="btn primary small" data-action="' + next.action + '">' + esc(next.actionLabel) + '</button>' : '') +
      '<div class="quest-foot"><span class="quest-dots">' + qs.map(function (q) {
        return '<i class="' + (q.done ? 'done' : '') + '"></i>';
      }).join('') + '</span>' +
      '<button class="linklike" data-action="open-quests">全部任务</button></div></div>';
    h += '<div class="btn-row" style="margin-bottom:10px">' +
      '<button class="btn" data-action="open-colonies">🏙 殖民地（' + g.empireColonyCount(p) + '）</button>' +
      '<button class="btn" data-action="open-war-room">🎯 战争指挥</button></div>';
    // 研究
    h += '<div class="section"><div class="section-title">研究</div>';
    SM.RESEARCH_ORDER.forEach(function (cat) {
      const r = p.research[cat];
      const tech = r.current ? SM.ALL_TECHS[r.current] : null;
      h += '<div class="research-row">';
      h += '<div class="research-head"><span style="color:' + catColor(cat) + '">' + catIcon(cat) + '</span><span class="research-name">' + SM.RESEARCH[cat].name + '</span>';
      if (tech) {
        const pct = Math.min(100, r.progress / tech.cost * 100);
        h += '<span class="research-pct">' + Math.floor(pct) + '%</span></div>';
        h += '<div class="research-sub"><span>' + esc(tech.name) + '</span><span>' + fmt(r.progress) + '/' + tech.cost + '</span></div>' + bar(pct);
        h += '<button class="btn small research-choose" data-action="open-tech" data-cat="' + cat + '">更换研究</button>';
      } else {
        h += '<span class="research-pct">空闲</span></div>';
        h += '<div class="research-sub"><span>尚未选择研究项目</span><span>' + signed(p.income[cat] || 0) + '/月</span></div>';
        h += '<button class="btn small research-choose pulse" data-action="open-tech" data-cat="' + cat + '">选择科技</button>';
      }
      h += '</div>';
    });
    h += '</div>';
    // 传统
    const trads = p.traditions.length;
    h += '<div class="section"><div class="section-title">传统</div>' +
      '<div class="build-row"><span class="ic">☯</span><div><div class="nm">已采纳 ' + trads + ' / ' + SM.TRADITIONS.length + ' 项传统</div>' +
      '<div class="sub">凝聚力收入 ' + signed(p.income.unity || 0) + '/月</div></div>' +
      '<div class="right"><button class="btn small" data-action="open-traditions">查看</button></div></div></div>';
    // 警报
    const warn = UI.warnings();
    if (warn.length) {
      h += '<div class="section"><div class="section-title">警报</div>';
      warn.forEach(function (w) {
        h += '<div class="obj"><span class="mark" style="border-color:' + (w.bad ? 'rgba(255,107,107,.45)' : 'var(--line-strong)') + '">' + w.icon + '</span><span>' + esc(w.text) + '</span></div>';
      });
      h += '</div>';
    }
    // 战争
    const wars = g.warsFor(p.id);
    if (wars.length) {
      h += '<div class="section"><div class="section-title">战争</div>';
      wars.forEach(function (w) {
        const enemy = g.empire(w.a === p.id ? w.b : w.a);
        const ep = enemy ? g.empirePower(enemy) : 0;
        const mp = g.empirePower(p);
        const occupied = enemy ? g.state.colonies.filter(function (c) { return c.owner === enemy.id && c.occupiedBy === p.id; }).length : 0;
        h += '<div class="diplo-row" data-action="open-war-room"><div class="diplo-top">' +
          '<span class="color-dot" style="background:' + (enemy ? enemy.color : '#f00') + ';color:' + (enemy ? enemy.color : '#f00') + '"></span>' +
          '<span class="diplo-name">对 ' + esc(enemy ? enemy.name : '？') + ' 的战争</span>' +
          '<span class="diplo-rel" style="color:var(--red)">疲劳 ' + Math.round(w.ex[p.id] || 0) + '</span></div>' +
          '<div class="diplo-sub"><span>对方战力 ' + ep + ' / 你 ' + mp + '</span><span>已占领 ' + occupied + ' 座</span><span>点击进入战争指挥</span></div></div>';
      });
      h += '</div>';
    }
    return h;
  };

  UI.tabTerritory = function () {
    const g = UI.game, p = UI.player();
    let h = '<div class="btn-row" style="margin-bottom:10px">' +
      '<button class="btn primary" data-action="open-colonies">🏙 殖民地总览</button>' +
      '<button class="btn" data-action="open-war-room">🎯 战争指挥</button>' +
      '<button class="btn" data-action="open-shipyard">⚓ 船坞</button></div>';
    h += '<div class="section"><div class="section-title">殖民地（' + g.empireColonyCount(p) + '）</div>';
    const colonies = p.colonies.map(function (id) { return g.colony(id); }).filter(Boolean)
      .sort(function (a, b) {
        const ac = a.id === p.capital ? 1 : 0;
        const bc = b.id === p.capital ? 1 : 0;
        if (ac !== bc) return bc - ac;
        return b.pops - a.pops;
      });
    if (!colonies.length) h += '<div class="empty">没有殖民地。</div>';
    colonies.forEach(function (c) {
      const sys = g.system(c.systemId);
      const occEmp = c.occupiedBy ? g.empire(c.occupiedBy) : null;
      const occ = occEmp ? tag(occEmp.id === p.id ? '已占领' : '被 ' + occEmp.name + ' 占领', occEmp.id === p.id ? 'green' : 'red') : '';
      const cap = c.id === p.capital ? '<span class="tag gold">★ 首都</span>' : '';
      const active = UI.selected && (UI.selected.type === 'planet' && UI.selected.id === c.planetId) ? ' active' : '';
      const dispColor = occEmp ? occEmp.color : p.color;
      const rowStyle = ' style="border-left:3px solid ' + dispColor + ';background:linear-gradient(90deg,' + SM.hexToRgba(dispColor, 0.10) + ',rgba(0,0,0,0) 68%)"';
      h += '<div class="list-item' + active + '"' + rowStyle + ' data-action="select-colony" data-colony="' + c.id + '">' +
        '<span class="planet-dot" style="background:' + (SM.PLANET_TYPES[(g.planet(c.planetId) || {}).type] || {}).color + '"></span>' +
        '<div class="li-main"><div class="li-name">' + esc(c.name) + ' ' + cap + ' ' + occ + '</div>' +
        '<div class="li-sub">' + esc(sys ? sys.name : '') + ' · 👥 ' + c.pops + ' · 🏠 ' + g.colonyHousing(c) +
        (c.queue.length ? ' · 🏗 ' + c.queue.length : '') + '</div></div>' +
        '<div class="li-right" style="display:flex;align-items:center;gap:6px">' +
        (c.owner === p.id ? '<span>Lv.' + c.starbase.level + '</span><button class="btn small" data-action="select-colony" data-colony="' + c.id + '">管理</button>' : '') +
        '</div></div>';
    });
    h += '</div>';
    // 舰队
    const kinds = [['combat', '作战舰队'], ['science', '科研船'], ['construction', '工程船'], ['colony', '殖民船']];
    kinds.forEach(function (k) {
      const fleets = g.state.fleets.filter(function (f) { return f.owner === p.id && f.kind === k[0]; });
      if (!fleets.length) return;
      h += '<div class="section"><div class="section-title">' + k[1] + '（' + fleets.length + '）</div>';
      fleets.forEach(function (f) {
        const sys = g.system(f.systemId);
        const active = UI.selected && UI.selected.type === 'fleet' && UI.selected.id === f.id ? ' active' : '';
        h += '<div class="list-item' + active + '" data-action="select-fleet" data-fleet="' + f.id + '">' +
          '<span class="color-dot" style="background:' + p.color + ';color:' + p.color + '"></span>' +
          '<div class="li-main"><div class="li-name">' + esc(f.name) + '</div>' +
          '<div class="li-sub">' + esc(sys ? sys.name : '') + ' · ' + f.ships.length + ' 艘' +
          (f.kind === 'combat' ? ' · 战力 ' + g.fleetPower(f) : '') +
          (f.auto ? ' · 自动' : '') + '</div></div>' +
          '<div class="li-right">' + (f.travel ? '🚀' : f.mission ? '⏳' : '') + '</div></div>';
      });
      h += '</div>';
    });
    return h;
  };

  UI.tabDiplo = function () {
    const g = UI.game, p = UI.player();
    let h = '<div class="empty" style="margin-bottom:8px">外交关系会随时间回归中立。赠礼可以改善关系；宣战需要 30 影响力。</div>';
    g.state.empires.forEach(function (e) {
      if (e.id === p.id || !e.alive) return;
      const contacted = !!p.contacts[e.id];
      const war = g.isAtWar(p.id, e.id);
      const truce = g.truceUntil(p.id, e.id) > g.state.day;
      const rel = g.relation(p.id, e.id);
      h += '<div class="diplo-row" data-action="open-diplomacy">' +
        '<div class="diplo-top"><span class="color-dot" style="background:' + e.color + ';color:' + e.color + '"></span>' +
        '<span class="diplo-name">' + esc(e.name) + '</span>' +
        '<span class="diplo-rel" style="color:' + (war ? 'var(--red)' : rel >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
        (war ? '战争' : !contacted ? '未接触' : (rel >= 0 ? '+' : '') + Math.round(rel)) + '</span></div>' +
        '<div class="diplo-sub"><span>' + esc(e.species) + '</span><span>' + g.empireColonyCount(e) + ' 殖民地</span><span>战力 ' + g.empirePower(e) + '</span>' +
        (truce ? '<span>停战中</span>' : '') + '</div></div>';
    });
    return h;
  };

  UI.tabLog = function () {
    const g = UI.game;
    const log = g.state.log.slice(-70).reverse();
    if (!log.length) return '<div class="empty">还没有值得记录的事。</div>';
    let h = '';
    log.forEach(function (l) {
      h += '<div class="log-entry"><span class="ic">' + (l.icon || '•') + '</span><span class="txt">' + esc(l.text) + '</span>' +
        '<span class="day">' + monthOf(l.day) + '</span></div>';
    });
    return h;
  };

  /* ------------------------------------------------------------------ */
  /* 动作                                                                */
  /* ------------------------------------------------------------------ */
  UI.handleAction = function (ds, ev) {
    const g = UI.game;
    if (!g) return;
    const a = ds.action;
    if (a === 'select-planet') {
      if (UI.modalOpen && UI.modalKind === 'colonyTargets') UI.closeModal();
      UI.selectPlanet(ds.planet);
      return;
    }
    if (a === 'select-colony') { UI.selectColony(ds.colony); return; }
    if (a === 'select-fleet') { UI.selectFleet(ds.fleet); return; }
    if (a === 'focus-system') { UI.centerOnSystem(ds.system, Math.max(UI.camera.zoom, 0.9)); return; }
    if (a === 'goto-capital') { UI.selectCapital(); return; }
    if (a === 'back-system') { UI.selectSystem(ds.system || UI.selected.systemId); return; }
    if (a === 'open-tech') { UI.openTechModal(ds.cat); return; }
    if (a === 'open-traditions') { UI.openTraditions(); return; }
    if (a === 'open-diplomacy') { UI.openDiplomacy(); return; }
    if (a === 'open-help') { UI.openHelp(); return; }
    if (a === 'open-shipyard') { UI.openShipyard(ds.colony); return; }
    if (a === 'open-colonies') { UI.openColonyManager(); return; }
    if (a === 'open-war-room') { UI.openWarRoom(ds.fleet); return; }
    if (a === 'war-select') { UI.warFleetId = ds.fleet; UI.openWarRoom(ds.fleet); return; }
    if (a === 'war-attack') { UI.warAttackSystem(ds.system); return; }
    if (a === 'mgr-select') { UI.openColonyManager(ds.colony, true); return; }
    if (a === 'mgr-open' || a === 'mgr-locate') {
      const mc = g.colony(ds.colony);
      if (mc) {
        UI.closeModal();
        UI.selectPlanet(mc.planetId);
        UI.centerOnSystem(mc.systemId, Math.max(UI.camera.zoom, 0.9));
      }
      return;
    }
    if (a === 'mgr-yard') { UI.closeModal(); UI.openShipyard(ds.colony); return; }
    if (a === 'colony-prev') { UI.cycleColony(-1); return; }
    if (a === 'colony-next') { UI.cycleColony(1); return; }
    if (a === 'select-science') { UI.selectSupportFleet('science'); return; }
    if (a === 'select-construction') { UI.selectSupportFleet('construction'); return; }
    if (a === 'open-colony-targets') { UI.openColonyTargets(); return; }
    if (a === 'open-quests') { UI.openQuests(); return; }
    if (a === 'open-war-help') { UI.openWarHelp(); return; }
    if (a === 'build-suggest') {
      const res = ds.type === 'district' ? g.buildDistrict(ds.colony, ds.key) : g.buildBuilding(ds.colony, ds.key);
      UI.actionToast(res, res.ok ? '开始建造：' + (ds.type === 'district' ? SM.DISTRICTS[ds.key].name : SM.BUILDINGS[ds.key].name) : null);
      UI.refreshPanels();
      if (res.ok && UI.modalOpen && UI.modalKind === 'colonies') UI.openColonyManager(ds.colony, true);
      return;
    }
    if (a === 'build-district') {
      const res = g.buildDistrict(ds.colony, ds.key);
      UI.actionToast(res, res.ok ? '开始建造区划' : null);
      UI.refreshPanels();
      return;
    }
    if (a === 'cancel-build') {
      const res = g.cancelBuild(ds.colony, parseInt(ds.index, 10));
      UI.actionToast(res, res.ok ? '已取消建造，返还 ' + res.refund + ' 矿物' : null);
      UI.refreshPanels();
      if (res.ok && UI.modalOpen && UI.modalKind === 'colonies') UI.openColonyManager(ds.colony, true);
      return;
    }
    if (a === 'build-building') {
      const res = g.buildBuilding(ds.colony, ds.key);
      UI.actionToast(res, res.ok ? '开始建造建筑' : null);
      UI.refreshPanels();
      return;
    }
    if (a === 'upgrade-starbase') {
      const res = g.upgradeStarbase(ds.colony);
      UI.actionToast(res, res.ok ? '星际基地开始升级' : null);
      UI.refreshPanels();
      return;
    }
    if (a === 'colonize') {
      const res = g.orderColonize(ds.planet);
      UI.actionToast(res, res.ok ? '殖民船开始建造，建成后自动前往目标' : null);
      UI.refreshPanels();
      if (res.ok && UI.modalOpen && UI.modalKind === 'colonyTargets') UI.openColonyTargets();
      return;
    }
    if (a === 'build-station') {
      const res = g.orderBuildStation(ds.system, ds.type);
      UI.actionToast(res, res.ok ? '工程船已出发' : null);
      UI.refreshPanels();
      return;
    }
    if (a === 'survey') {
      const f = g.fleet(ds.fleet);
      const p = UI.player();
      if (f && f.owner === p.id) {
        f.auto = false;
        const ok = g.startSurvey(f, p);
        UI.toast({ type: 'info', icon: '🔭', text: ok ? '开始调查' : '无法调查' });
        UI.selectFleet(f.id);
      }
      return;
    }
    if (a === 'toggle-auto') {
      const f = g.fleet(ds.fleet);
      if (f) { f.auto = !f.auto; UI.toast({ type: 'info', icon: '🛰', text: f.auto ? '自动模式已开启' : '自动模式已关闭' }); UI.selectFleet(f.id); }
      return;
    }
    if (a === 'merge-fleet') {
      const res = g.mergeFleets(ds.fleet, ds.other);
      UI.actionToast(res, res.ok ? '舰队已合并' : null);
      UI.selectFleet(ds.fleet);
      return;
    }
    if (a === 'return-home') {
      const f = g.fleet(ds.fleet);
      if (f) { g.moveFleet(f, ds.system); UI.selectFleet(f.id); }
      return;
    }
    if (a === 'cancel-mission') {
      const f = g.fleet(ds.fleet);
      if (f) { f.mission = null; UI.toast({ type: 'info', icon: '⏹', text: '任务已取消' }); UI.selectFleet(f.id); }
      return;
    }
  };

  UI.actionToast = function (res, okText) {
    if (res.ok) {
      if (okText) UI.toast({ type: 'info', icon: '✅', text: okText });
    } else {
      UI.toast({ type: 'info', icon: '⚠', text: res.reason || '无法执行' });
    }
  };

  UI.refreshPanels = function () {
    UI.panelDirty = false;
    UI.renderTopbar();
    UI.renderLeft();
    UI.renderRight();
    UI.renderBottom();
    UI.renderMapLegend();
    UI.checkQuestProgress();
  };

  /* ------------------------------------------------------------------ */
  /* 通知 / 提示                                                        */
  /* ------------------------------------------------------------------ */
  UI.clearToasts = function () {
    const box = $('#toasts');
    if (box) box.innerHTML = '';
  };

  UI.toast = function (n) {
    const box = $('#toasts');
    if (!box) return;
    if (box.children.length >= 4) box.removeChild(box.firstChild);
    const div = document.createElement('div');
    div.className = 'toast ' + (n.type || '');
    div.innerHTML = '<span class="ic">' + (n.icon || '•') + '</span><span class="txt">' + esc(n.text) + '</span>' +
      '<span class="tday">' + (n.day !== undefined ? monthOf(n.day) : '') + '</span>';
    div.onclick = function () {
      if (n.planetId && UI.game.planet(n.planetId)) {
        UI.selectPlanet(n.planetId);
        const psys = UI.game.planetSystem(n.planetId);
        if (psys) UI.centerOnSystem(psys.id, Math.max(UI.camera.zoom, 0.85));
      } else if (n.systemId && UI.game.system(n.systemId)) {
        UI.selectSystem(n.systemId);
        UI.centerOnSystem(n.systemId, Math.max(UI.camera.zoom, 0.8));
      }
      if (n.type === 'event' && UI.game.state.pendingEvent) UI.openEventModal();
      if (n.type === 'tech') {
        const cat = SM.RESEARCH_ORDER.find(function (c) { return !UI.player().research[c].current; });
        if (cat) UI.openTechModal(cat);
      }
      div.classList.add('leaving');
      setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 250);
    };
    box.appendChild(div);
    setTimeout(function () {
      if (!div.parentNode) return;
      div.classList.add('leaving');
      setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 260);
    }, 7000);
  };

  UI.showTooltip = function (html, x, y) {
    const tip = $('#tooltip');
    if (!tip) return;
    tip.innerHTML = html;
    tip.hidden = false;
    UI.moveTooltip(x, y);
  };
  UI.moveTooltip = function (x, y) {
    const tip = $('#tooltip');
    if (!tip || tip.hidden) return;
    const w = 280;
    let left = x + 16;
    let top = y + 16;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + 160 > window.innerHeight - 8) top = window.innerHeight - 170;
    tip.style.left = Math.max(8, left) + 'px';
    tip.style.top = Math.max(8, top) + 'px';
  };
  UI.hideTooltip = function () {
    const tip = $('#tooltip');
    if (tip) tip.hidden = true;
  };

  /* ------------------------------------------------------------------ */
  /* 弹窗基础                                                            */
  /* ------------------------------------------------------------------ */
  UI.openModal = function (opts) {
    if (UI.modalOpen) { UI.modalQueue.push(opts); return; }
    UI.renderModal(opts);
  };

  UI.renderModal = function (opts) {
    const root = $('#modal-root');
    const replacing = UI.modalOpen && !!root.querySelector('.modal');
    if (!replacing && !UI.keepSpeedBefore) UI.speedBeforeModal = UI.speed;
    UI.keepSpeedBefore = false;
    const oldBody = root.querySelector('.modal-body');
    const oldScroll = oldBody ? oldBody.scrollTop : 0;
    UI.modalOpen = true;
    UI.modalKind = opts.kind || 'generic';
    UI.modalClosable = opts.closable !== false;
    if (UI.game) UI.setSpeed(0);
    const actions = (opts.actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.cls || '') + '" data-mact="' + i + '"' + (a.disabled ? ' disabled' : '') + '>' + esc(a.label) + '</button>';
    }).join('');
    const headHTML =
      '<div class="modal-head">' +
      '<div class="modal-kicker">' + esc(opts.kicker || '') + '</div>' +
      '<div class="modal-title">' + (opts.title || '') +
      (UI.modalClosable ? '<button class="modal-close" data-mclose="1" title="关闭">×</button>' : '') +
      '</div>' +
      (opts.sub ? '<div class="modal-sub">' + opts.sub + '</div>' : '') +
      '</div>';
    const bodyHTML = '<div class="modal-body">' + (opts.body || '') + '</div>';
    const actionsHTML = actions ? '<div class="modal-actions">' + actions + '</div>' : '';
    const modalClass = 'modal ' + (opts.width || '') + (replacing ? ' no-anim' : '');
    let modal;
    if (replacing) {
      modal = root.querySelector('.modal');
      modal.className = modalClass;
      modal.innerHTML = headHTML + bodyHTML + actionsHTML;
      if (opts.keepScroll) {
        const nb = modal.querySelector('.modal-body');
        if (nb) nb.scrollTop = oldScroll;
      }
    } else {
      root.innerHTML = '<div class="modal-backdrop"></div><div class="' + modalClass + '">' +
        headHTML + bodyHTML + actionsHTML + '</div>';
      modal = root.querySelector('.modal');
      root.classList.add('show');
    }
    modal.querySelectorAll('[data-mact]').forEach(function (btn) {
      const a = opts.actions[parseInt(btn.dataset.mact, 10)];
      btn.onclick = function () {
        if (a.onClick) a.onClick();
        if (a.close !== false) UI.closeModal();
      };
    });
    const closeBtn = modal.querySelector('[data-mclose]');
    if (closeBtn) closeBtn.onclick = function () { UI.closeModal(); };
    if (opts.bind) opts.bind(modal);
    UI.modalOpts = opts;
  };

  UI.closeModal = function (force) {
    const root = $('#modal-root');
    if (!root || (!UI.modalOpen && !force)) return;
    root.classList.remove('show');
    root.innerHTML = '';
    UI.modalOpen = false;
    UI.modalKind = null;
    UI.modalClosable = false;
    UI.modalOpts = null;
    UI.panelDirty = true;
    const queued = UI.modalQueue.length > 0;
    if (force) {
      UI.speedBeforeModal = 0;
      UI.keepSpeedBefore = false;
    } else if (!queued && UI.speed === 0 && UI.speedBeforeModal > 0) {
      UI.setSpeed(UI.speedBeforeModal);
      UI.speedBeforeModal = 0;
    }
    if (queued) {
      UI.keepSpeedBefore = true;
      const next = UI.modalQueue.shift();
      setTimeout(function () { UI.renderModal(next); }, 40);
    } else if (!force) {
      UI.speedBeforeModal = 0;
    }
  };

  /* ------------------------------------------------------------------ */
  /* 具体弹窗                                                            */
  /* ------------------------------------------------------------------ */
  UI.openTechModal = function (cat, replace) {
    const g = UI.game, p = UI.player();
    cat = cat || SM.RESEARCH_ORDER.find(function (c) { return !p.research[c].current; }) || 'physics';
    const r = p.research[cat];
    const tabs = SM.RESEARCH_ORDER.map(function (c) {
      return '<button data-tcat="' + c + '" class="' + (c === cat ? 'active' : '') + '">' + catIcon(c) + ' ' + SM.RESEARCH[c].name + '</button>';
    }).join('');
    let body = '<div class="tech-cat-tabs">' + tabs + '</div>';
    if (r.current) {
      const cur = SM.ALL_TECHS[r.current];
      body += '<div class="event-text" style="font-size:12px">当前研究：<b>' + esc(cur.name) + '</b>' +
        '<span class="muted">（' + fmt(r.progress) + ' / ' + cur.cost + '）</span></div>' +
        '<div class="progress" style="margin-top:8px"><i style="width:' + Math.min(100, r.progress / cur.cost * 100) + '%"></i></div>' +
        '<div class="small" style="text-align:left;margin-top:6px;color:#8fa3c8">月收入 ' + fmt(p.income[cat] || 0) +
        ' · 切换研究项目会损失 50% 的当前进度。</div>';
    }
    const opts = r.options.map(function (id) { return SM.ALL_TECHS[id]; }).filter(Boolean);
    if (!opts.length) {
      body += '<div class="empty">暂时没有可研究的项目。研究更多前置科技来解锁新的选项。</div>';
    } else {
      body += '<div class="tech-grid" style="margin-top:14px">' + opts.map(function (t) {
        const eff = SM.techDesc(t);
        const isCurrent = r.current === t.id;
        return '<div class="tech-card">' +
          '<div class="tech-icon">' + t.icon + '</div>' +
          '<div class="tech-tier">Tier ' + t.tier + (t.repeatable ? ' · 循环' : '') + '</div>' +
          '<div class="tech-name">' + esc(t.name) + '</div>' +
          '<div class="tech-desc">' + esc(t.desc) + '</div>' +
          '<ul class="tech-effects">' + eff.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>' +
          '<div class="tech-cost">' + t.cost + ' 研究点 · 约 ' + Math.max(1, Math.ceil(t.cost / Math.max(1, p.income[cat] || 1))) + ' 个月</div>' +
          '<button class="btn primary" data-ttech="' + t.id + '"' + (isCurrent ? ' disabled' : '') + '>' +
          (isCurrent ? '研究中' : r.current ? '切换到此项目' : '开始研究') + '</button>' +
          '</div>';
      }).join('') + '</div>';
    }
    const optsModal = {
      kind: 'tech',
      kicker: '研究部门',
      title: '选择研究项目',
      sub: '研究速度：每项研究只占用一个领域。完成后会自动提示下一次选择。',
      body: body,
      width: 'wide',
      closable: true,
      bind: function (el) {
        el.querySelectorAll('[data-tcat]').forEach(function (b) {
          b.onclick = function () { UI.openTechModal(b.dataset.tcat, true); };
        });
        el.querySelectorAll('[data-ttech]').forEach(function (b) {
          b.onclick = function () {
            const res = g.selectResearch(p, cat, b.dataset.ttech);
            if (!res.ok) { UI.toast({ type: 'info', icon: '⚠', text: res.reason }); return; }
            UI.questFlags.research = UI.questFlags.research || {};
            UI.questFlags.research[cat] = true;
            UI.toast({ type: 'info', icon: '🔬', text: (res.switched ? '已切换研究：' : '开始研究：') + SM.ALL_TECHS[b.dataset.ttech].name });
            UI.closeModal();
            UI.refreshPanels();
          };
        });
      }
    };
    if (replace && UI.modalOpen) UI.renderModal(optsModal);
    else UI.openModal(optsModal);
  };

  UI.openTraditions = function () {
    const g = UI.game, p = UI.player();
    const body = '<div class="trad-grid">' + SM.TRADITIONS.map(function (t) {
      const done = p.traditions.indexOf(t.id) >= 0;
      const reqOk = !t.req || t.req.every(function (r) { return p.traditions.indexOf(r) >= 0; });
      const cost = g.traditionCost(p, t);
      const can = !done && reqOk && p.resources.unity >= cost;
      return '<div class="trad-card' + (done ? ' done' : '') + (reqOk ? '' : ' locked') + '">' +
        '<div class="trad-tree">' + esc(t.tree) + ' 传统</div>' +
        '<div class="trad-name">' + t.icon + ' ' + esc(t.name) + '</div>' +
        '<div class="trad-desc">' + esc(t.desc) + '</div>' +
        '<div class="trad-cost">' + (done ? '已采纳' : cost + ' ☯') + '</div>' +
        '<button class="btn small wide" data-trad="' + t.id + '"' + (can ? '' : ' disabled') + '>' + (done ? '已采纳' : '采纳') + '</button>' +
        '</div>';
    }).join('') + '</div>';
    const optsModal = {
      kind: 'traditions',
      kicker: '国家理念',
      title: '传统',
      sub: '消耗凝聚力采纳传统，获得永久加成。当前凝聚力：' + fmt(p.resources.unity) + ' · 月收入 ' + signed(p.income.unity || 0),
      body: body,
      width: 'wide',
      closable: true,
      actions: [{ label: '关闭', cls: 'ghost' }],
      bind: function (el) {
        el.querySelectorAll('[data-trad]').forEach(function (b) {
          b.onclick = function () {
            const res = g.buyTradition(p, b.dataset.trad);
            if (!res.ok) { UI.toast({ type: 'info', icon: '⚠', text: res.reason }); return; }
            UI.openTraditions();
          };
        });
      }
    };
    if (UI.modalOpen && UI.modalKind === 'traditions') UI.renderModal(optsModal);
    else UI.openModal(optsModal);
  };

  UI.openDiplomacy = function () {
    const g = UI.game, p = UI.player();
    UI.questFlags.openedDiplomacy = true;
    if (p.stats) p.stats.openedDiplomacy = true;
    let body = '<div class="hint-card" style="margin:0 0 12px"><div class="hint-title">外交怎么用</div><div class="hint-text">' +
      '关系 <b>大于 0</b> 更安全，<b>低于 -20</b> 就进入危险区。赠礼 100 能量币可以改善关系；宣战消耗 30 影响力。<br>' +
      '战争流程：舰队进入敌方星系 → 摧毁星际基地 → 轨道轰炸 → 占领行星。<b>停战按现状划界</b>：谁占着就归谁，停战后 5 年不能开战。' +
      '打不过就先停战，保住首都。</div></div>';
    const others = g.state.empires.filter(function (e) { return e.id !== p.id && e.alive; });
    others.forEach(function (e) {
      const contacted = !!p.contacts[e.id];
      const war = g.isAtWar(p.id, e.id);
      const truce = g.truceUntil(p.id, e.id);
      const rel = g.relation(p.id, e.id);
      const threat = rel <= -20 ? ' · <span style="color:#ff9b9b">敌意</span>' : rel <= -5 ? ' · <span style="color:#ffb86b">紧张（可能收到最后通牒）</span>' : rel < 0 ? ' · <span style="color:#ffb86b">冷淡</span>' : '';
      const status = war ? '<span class="badge war">战争</span>' : truce > g.state.day ? '<span class="badge">停战中</span>' : contacted ? '<span class="badge">和平</span>' : '<span class="badge">未接触</span>';
      body += '<div class="diplo-modal-row">' +
        '<div class="dm-color" style="background:' + e.color + '"></div>' +
        '<div class="dm-main"><div class="dm-name">' + esc(e.name) + ' ' + status + '</div>' +
        '<div class="dm-sub">' + esc(e.species) + ' · ' + (SM.AI_PERSONALITIES[e.personality] || {}).name + ' · ' + g.empireColonyCount(e) + ' 殖民地 · 战力 ' + g.empirePower(e) + '</div>' +
        '<div class="dm-sub">关系：<b style="color:' + (rel >= 0 ? 'var(--green)' : 'var(--red)') + '">' + (rel >= 0 ? '+' : '') + Math.round(rel) + '</b>' + threat +
        (truce > g.state.day ? ' · 停战剩余 ' + Math.ceil((truce - g.state.day) / 360) + ' 年' : '') + '</div>';
      if (war) {
        const w = g.warBetween(p.id, e.id);
        const occupied = g.state.colonies.filter(function (c) { return c.owner === e.id && c.occupiedBy === p.id; }).length;
        body += '<div class="dm-sub">战争疲劳：你 <b>' + Math.round((w.ex[p.id] || 0)) + '</b> / 对方 <b>' + Math.round((w.ex[e.id] || 0)) +
          '</b> · 你已占领 <b>' + occupied + '</b> 座敌方殖民地</div>';
      }
      body += '</div><div class="dm-actions">';
      if (contacted) {
        body += '<button class="btn small" data-dgift="' + e.id + '"' + (p.resources.energy < 100 || war ? ' disabled' : '') + '>🎁 赠礼 100⚡</button>';
        if (war) {
          body += '<button class="btn small" data-dpeace="' + e.id + '">🕊 停战</button>';
          body += '<button class="btn small danger" data-dsurrender="' + e.id + '">🏴 要求投降</button>';
        } else if (truce <= g.state.day) {
          body += '<button class="btn small danger" data-dwar="' + e.id + '">宣战</button>';
        }
      } else {
        body += '<span class="small">需要先建立通讯（舰队相遇或领土接近）</span>';
      }
      body += '</div></div>';
    });
    if (!body) body = '<div class="empty">银河中暂时没有其他文明。</div>';
    const opts = {
      kind: 'diplomacy',
      kicker: '外交部',
      title: '星际外交',
      sub: '关系范围 -100 到 +100。宣战消耗 30 影响力，停战后有 5 年停战期。',
      body: body,
      width: 'wide',
      actions: [
        { label: '战争指南', close: false, onClick: function () { UI.closeModal(); UI.openWarHelp(); } },
        { label: '关闭' }
      ],
      bind: function (el) {
        el.querySelectorAll('[data-dgift]').forEach(function (b) {
          b.onclick = function () {
            const res = g.sendGift(p.id, b.dataset.dgift, 100);
            if (!res.ok) UI.toast({ type: 'info', icon: '⚠', text: res.reason });
            else UI.toast({ type: 'info', icon: '🎁', text: '关系改善 +' + res.delta });
            UI.openDiplomacy();
          };
        });
        el.querySelectorAll('[data-dwar]').forEach(function (b) {
          b.onclick = function () { UI.confirmWar(b.dataset.dwar); };
        });
        el.querySelectorAll('[data-dpeace]').forEach(function (b) {
          b.onclick = function () {
            const res = g.offerPeace(p.id, b.dataset.dpeace, 'white');
            UI.toast({ type: 'info', icon: res.ok ? '🕊' : '⚠', text: res.ok ? '对方接受了停战。' : res.reason });
            if (res.ok) UI.closeModal(); else UI.openDiplomacy();
          };
        });
        el.querySelectorAll('[data-dsurrender]').forEach(function (b) {
          b.onclick = function () {
            const res = g.offerPeace(p.id, b.dataset.dsurrender, 'surrender');
            UI.toast({ type: 'info', icon: res.ok ? '🏴' : '⚠', text: res.ok ? '对方投降，占领区已并入帝国。' : res.reason });
            if (res.ok) UI.closeModal(); else UI.openDiplomacy();
          };
        });
      }
    };
    if (UI.modalOpen && (UI.modalKind === 'diplomacy' || UI.modalKind === 'confirm')) UI.renderModal(opts);
    else UI.openModal(opts);
  };

  UI.confirmWar = function (targetId) {
    const g = UI.game, p = UI.player();
    const e = g.empire(targetId);
    if (!e) return;
    UI.renderModal({
      kind: 'confirm',
      kicker: '战争决议',
      title: '向 ' + esc(e.name) + ' 宣战？',
      sub: '宣战将消耗 30 影响力，并可能招致其他帝国的敌意。',
      body: '<div class="event-text">战争目标：占领敌方殖民地，并在停战时按现状划分边界。<br><br>' +
        '敌方殖民地：<b>' + g.empireColonyCount(e) + '</b> · 舰队力量：<b>' + g.empirePower(e) + '</b> · 关系：' + Math.round(g.relation(p.id, e.id)) + '</div>',
      width: 'narrow',
      actions: [
        { label: '取消', close: false, onClick: function () { UI.openDiplomacy(); } },
        {
          label: '宣战', cls: 'danger', close: false, onClick: function () {
            const res = g.declareWar(p.id, e.id);
            UI.toast({ type: 'war', icon: '🚨', text: res.ok ? '已向 ' + e.name + ' 宣战！' : res.reason });
            if (res.ok) UI.closeModal(); else UI.openDiplomacy();
          }
        }
      ]
    });
  };

  UI.openColonyTargets = function () {
    const g = UI.game, p = UI.player();
    const owned = g.ownedSystems(p.id);
    const ownedIds = owned.map(function (s) { return s.id; });
    const cost = g.colonyShipCost(p);
    const targets = [];
    g.state.systems.forEach(function (sys) {
      if (!sys.surveyed[p.id] || sys.colonyId) return;
      sys.planets.forEach(function (pl) {
        if (!pl.habitable || pl.colonyId) return;
        const check = g.canColonizeCheck(pl, p);
        let dist = 99;
        ownedIds.forEach(function (oid) {
          const d = SM.Galaxy.jumpsBetween(g.state.systems, oid, sys.id);
          if (d < dist) dist = d;
        });
        targets.push({ planet: pl, sys: sys, check: check, dist: dist });
      });
    });
    targets.sort(function (a, b) {
      if (a.check.ok !== b.check.ok) return a.check.ok ? -1 : 1;
      return a.dist - b.dist || b.planet.size - a.planet.size;
    });
    let body = '<div class="small" style="text-align:left;margin-bottom:10px">殖民费用：<b style="color:var(--gold)">' + cost.alloys + ' 合金</b> + <b style="color:var(--cyan)">' + cost.influence +
      ' 影响力</b>。殖民船在首都建造，完成后自动前往目标。目标需已调查，且在领土 ' + SM.COLONY_RANGE + ' 跳以内。' +
      '当前殖民船：' + g.state.fleets.filter(function (f) { return f.owner === p.id && f.kind === 'colony'; }).length + ' 艘。</div>';
    if (!targets.length) {
      body += '<div class="empty" style="padding:18px 0">还没有已发现的宜居行星。<br>让科研船调查更多星系，调查结果会自动显示在这里。<br>如果科研船已经调查完附近星系，去更远的星系看看。</div>' +
        '<div class="btn-row" style="justify-content:center"><button class="btn primary" data-action="select-science">🔭 查看科研船</button>' +
        '<button class="btn" data-action="open-tech">🔬 选择科技</button></div>';
    } else {
      body += '<div class="list">';
      targets.forEach(function (t) {
        const pl = t.planet, sys = t.sys;
        const ok = t.check.ok && p.resources.alloys >= cost.alloys && p.resources.influence >= cost.influence;
        let reason = t.check.reason || '';
        if (!reason && p.resources.alloys < cost.alloys) reason = '合金不足';
        if (!reason && p.resources.influence < cost.influence) reason = '影响力不足';
        const type = SM.PLANET_TYPES[pl.type];
        body += '<div class="list-item colony-target">' +
          '<span class="planet-dot" style="background:' + (type ? type.color : '#888') + '"></span>' +
          '<div class="li-main"><div class="li-name">' + esc(pl.name) + ' <span class="tag gold">' + (type ? type.name : '宜居') + '</span></div>' +
          '<div class="li-sub">' + esc(sys.name) + ' 星系 · 大小 ' + pl.size + ' · 距领土 ' + (t.dist < 99 ? t.dist : '?') + ' 跳' +
          (reason ? ' · <span style="color:#ffb86b">' + esc(reason) + '</span>' : '') + '</div></div>' +
          '<div class="li-right" style="display:flex;gap:6px;align-items:center">' +
          '<button class="btn small" data-action="select-planet" data-planet="' + pl.id + '">查看</button>' +
          '<button class="btn small primary" data-action="colonize" data-planet="' + pl.id + '"' + (ok ? '' : ' disabled title="' + esc(reason) + '"') + '>殖民</button></div></div>';
      });
      body += '</div>';
    }
    const opts = {
      kind: 'colonyTargets',
      kicker: '扩张',
      title: '🌱 殖民目标',
      sub: '已调查的宜居世界 · ' + targets.filter(function (t) { return t.check.ok; }).length + ' 个可殖民',
      body: body,
      width: 'wide',
      actions: [
        { label: '查看科研船', close: false, onClick: function () { UI.closeModal(); UI.selectSupportFleet('science'); } },
        { label: '关闭' }
      ]
    };
    if (UI.modalOpen && UI.modalKind === 'colonyTargets') UI.renderModal(opts);
    else UI.openModal(opts);
  };

  UI.openQuests = function () {
    const qs = UI.quests();
    const done = qs.filter(function (q) { return q.done; }).length;
    let body = '<div class="small" style="text-align:left;margin-bottom:10px">按顺序完成这些目标，就能掌握《微光银河》的核心循环。带按钮的步骤可以直接跳转。</div>';
    qs.forEach(function (q, i) {
      body += '<div class="quest-line' + (q.done ? ' done' : '') + '">' +
        '<span class="qmark">' + (q.done ? '✓' : (i + 1)) + '</span>' +
        '<div class="qbody"><div class="qname">' + esc(q.title) + ' <span class="qhint">' + esc(q.hint) + '</span></div>' +
        '<div class="qdesc">' + esc(q.desc) + '</div></div>' +
        (!q.done ? '<button class="btn small" data-quest-action="' + q.action + '">' + esc(q.actionLabel) + '</button>' : '') +
        '</div>';
    });
    UI.openModal({
      kind: 'quests',
      kicker: '教程与目标',
      title: '舰长任务',
      sub: done + ' / ' + qs.length + ' 已完成',
      body: body,
      width: 'wide',
      actions: [{ label: '关闭' }],
      bind: function (el) {
        el.querySelectorAll('[data-quest-action]').forEach(function (b) {
          b.onclick = function () {
            const act = b.dataset.questAction;
            UI.closeModal();
            UI.handleAction({ action: act });
          };
        });
      }
    });
  };

  UI.openWarHelp = function () {
    UI.openModal({
      kind: 'warHelp',
      kicker: '战争指南',
      title: '🎯 怎么打，怎么防',
      sub: '战争不是自动进行的；舰队、星际基地和行星防御缺一不可。',
      width: 'wide',
      body:
        '<div class="help-grid" style="grid-template-columns:1fr 1fr">' +
        '<div><h4>进攻</h4><p>1. 在帝国船坞建造作战舰船，舰队会自动编组。<br>' +
        '2. 选中舰队 → 点「🎯 选择攻击目标」进入战争指挥，选敌方殖民地后点「派舰队」；也可以直接右键敌方星系。<br>' +
        '3. 进入星系后先打掉敌方星际基地。<br>' +
        '4. 基地被摧毁后，舰队会自动轨道轰炸；行星防御降到 0 即占领。<br>' +
        '5. 战争疲劳到 100，或双方外交停战，战争结束。停战按现状划界：谁占着就归谁。</p></div>' +
        '<div><h4>防守</h4><p>1. 敌方舰队进入你的星系时，屏幕上方会弹出警报并暂停。<br>' +
        '2. 把舰队放在首都或前线殖民地；右键移动，不要分散。<br>' +
        '3. 星际基地和行星防御会消耗敌军，但挡不住大舰队。<br>' +
        '4. 打不过就在外交面板提出停战；必要时先放弃偏远星系，保住首都。<br>' +
        '5. 关系越差越容易被宣战；赠礼可以临时降温。</p></div></div>' +
        '<div class="hint-card" style="margin-top:12px"><div class="hint-title">关键数值</div><div class="hint-text">' +
        '舰船维护消耗能量币；合金是造舰瓶颈；舰队力量在舰队面板和外交面板都能看到。' +
        '行星必须先用舰队轨道轰炸，光靠舰队不会自动占领。</div></div>',
      actions: [
        { label: '🎯 战争指挥', close: false, onClick: function () { UI.closeModal(); UI.openWarRoom(); } },
        { label: '打开帝国船坞', close: false, onClick: function () { UI.closeModal(); UI.openShipyard(); } },
        { label: '打开外交', close: false, onClick: function () { UI.closeModal(); UI.openDiplomacy(); } },
        { label: '关闭' }
      ]
    });
  };

  UI.openUltimatumModal = function () {
    const g = UI.game, p = UI.player();
    const u = g.state.pendingUltimatum;
    if (!u) return;
    const a = g.empire(u.from);
    if (!a) { g.state.pendingUltimatum = null; return; }
    const enough = p.resources.energy >= u.demand;
    const ratio = g.empirePower(a) / Math.max(1, g.empirePower(p));
    UI.openModal({
      kind: 'ultimatum',
      kicker: '最后通牒',
      title: '⚠ ' + esc(a.name) + ' 要求赔款',
      sub: '这不是随机事件：拒绝就会开战。',
      width: 'wide',
      closable: false,
      body: '<div class="event-text" style="text-align:left;line-height:1.8">' +
        '「' + esc(a.name) + '」的使节把一份文件放在桌上：<b>' + u.demand + ' 能量币</b>，换取和平。<br>' +
        '他们已经在边境集结舰队。你的当前能量币：<b style="color:' + (enough ? 'var(--green)' : '#ff9b9b') + '">' + fmt(p.resources.energy) + '</b>。<br><br>' +
        '关系 <b>' + Math.round(g.relation(a.id, p.id)) + '</b> · 对方舰队力量 <b>' + g.empirePower(a) + '</b> · 你的舰队力量 <b>' + g.empirePower(p) + '</b>' +
        (ratio > 1.3 ? ' —— 对方明显强于你。' : '') + '</div>' +
        '<div class="hint-card" style="margin-top:12px"><div class="hint-title">两种选择</div><div class="hint-text">' +
        '<b>支付：</b>损失 ' + u.demand + ' 能量币，关系 +15，并获得 2 年停战期。<br>' +
        '<b>拒绝：</b>立即开战。开战后先打开帝国船坞造舰，再把舰队集中在首都；打不过可以在外交面板停战。</div></div>',
      actions: [
        {
          label: enough ? '支付 ' + u.demand + ' 能量币' : '能量币不足',
          cls: enough ? 'primary' : '', close: false, disabled: !enough,
          onClick: function () {
            const res = g.resolveUltimatum(true);
            if (!res.ok) { UI.toast({ type: 'info', icon: '⚠', text: res.reason }); return; }
            UI.closeModal();
            UI.refreshPanels();
            UI.toast({ type: 'diplo', icon: '🕊', text: '赔款已支付，战争暂时避免。' });
          }
        },
        {
          label: '拒绝，准备战争', cls: 'danger', close: false,
          onClick: function () {
            g.resolveUltimatum(false);
            UI.closeModal();
            UI.refreshPanels();
          }
        }
      ]
    });
  };

  UI.openWarBriefing = function (attackerId) {
    const g = UI.game, p = UI.player();
    const a = g.empire(attackerId);
    if (!a || !g.isAtWar(p.id, a.id)) return;
    const myPower = g.empirePower(p), theirPower = g.empirePower(a);
    const myShips = g.combatFleets(p).reduce(function (n, f) { return n + f.ships.length; }, 0);
    UI.openModal({
      kind: 'war',
      kicker: '战争爆发',
      title: '🚨 ' + esc(a.name) + ' 向你宣战',
      sub: '先别慌：舰队、星际基地和行星防御都能拖住他们。',
      width: 'wide',
      actions: [
        { label: '🎯 战争指挥', close: false, onClick: function () { UI.closeModal(); UI.openWarRoom(); } },
        { label: '打开帝国船坞', close: false, onClick: function () { UI.closeModal(); UI.openShipyard(); } },
        { label: '打开外交', close: false, onClick: function () { UI.closeModal(); UI.openDiplomacy(); } },
        { label: '知道了' }
      ],
      body: '<div class="event-text" style="text-align:left;line-height:1.8">' +
        '原因：关系已降至 <b>' + Math.round(g.relation(p.id, a.id)) + '</b>，' +
        (theirPower > myPower * 1.2 ? '对方判断你比他们弱。' : '双方实力接近，但外交已经破裂。') + '<br>' +
        '对方舰队力量 <b style="color:#ff9b9b">' + theirPower + '</b> · 你的舰队力量 <b style="color:var(--cyan)">' + myPower + '</b> · 你的作战舰船 <b>' + myShips + '</b> 艘。<br><br>' +
        '<b>现在做什么：</b></div>' +
        '<div class="help-grid" style="grid-template-columns:1fr 1fr;margin-top:8px">' +
        '<div><h4>① 立刻造舰</h4><p>打开帝国船坞，把合金花在护卫舰/驱逐舰上。舰船会出现在对应殖民地。</p></div>' +
        '<div><h4>② 集中舰队</h4><p>选中舰队，右键首都或前线殖民地。分散的舰队会被各个击破。</p></div>' +
        '<div><h4>③ 守首都</h4><p>首都的星际基地和行星防御最高。丢了首都，其他殖民地也很难守住。</p></div>' +
        '<div><h4>④ 打不过就停战</h4><p>外交面板可以停战。停战按现状划界：敌方占着的殖民地会归他们，所以别轻易放弃。</p></div></div>'
    });
  };

  UI.openFirstContact = function (otherId) {
    const g = UI.game, p = UI.player();
    const e = g.empire(otherId);
    if (!e || !e.alive) return;
    const pers = SM.AI_PERSONALITIES[e.personality] || null;
    UI.openModal({
      kind: 'firstContact',
      kicker: '首次接触',
      title: '📡 ' + esc(e.name),
      sub: '一个新的星际文明进入了你的通讯范围。',
      width: 'wide',
      actions: [
        { label: '打开外交', close: false, onClick: function () { UI.closeModal(); UI.openDiplomacy(); } },
        { label: '知道了' }
      ],
      body: '<div class="event-text" style="text-align:left;line-height:1.8">' +
        '物种：<b>' + esc(e.species) + '</b>' + (pers ? ' · 倾向：<b>' + esc(pers.name) + '</b>' : '') + '<br>' +
        '殖民地：<b>' + g.empireColonyCount(e) + '</b> · 舰队力量：<b>' + g.empirePower(e) + '</b> · 关系：<b>' + Math.round(g.relation(p.id, e.id)) + '</b><br><br>' +
        '打开外交面板可以赠礼改善关系、宣战、停战。关系越差、你越弱，就越容易被宣战。' +
        '如果不想打，送 100 能量币通常能让关系回暖；如果准备打，先造舰队再宣战。</div>' +
        '<div class="hint-card" style="margin-top:12px"><div class="hint-title">记住</div><div class="hint-text">' +
        '战争不是自动发生的。宣战需要 30 影响力；被打之前，你通常会收到最后通牒或战争简报。</div></div>'
    });
  };

  UI.openHabitablePrompt = function (planetId) {
    const g = UI.game, p = UI.player();
    const planet = g.planet(planetId);
    if (!planet) return;
    const sys = g.planetSystem(planetId);
    const check = g.canColonizeCheck(planet, p);
    const cost = g.colonyShipCost(p);
    const canPay = check.ok && p.resources.alloys >= cost.alloys && p.resources.influence >= cost.influence;
    const payReason = !check.ok ? check.reason :
      p.resources.alloys < cost.alloys ? '合金不足（需要 ' + cost.alloys + '）' :
      p.resources.influence < cost.influence ? '影响力不足（需要 ' + cost.influence + '）' : '';
    UI.openModal({
      kind: 'habitable',
      kicker: '发现宜居世界',
      title: '🌱 ' + esc(planet.name),
      sub: (sys ? esc(sys.name) + ' 星系 · ' : '') + '大小 ' + planet.size + ' · ' + pname(planet),
      width: 'wide',
      actions: [
        {
          label: canPay ? '派遣殖民船' : '条件不足', close: false, disabled: !canPay,
          onClick: function () {
            const res = g.orderColonize(planet.id);
            if (!res.ok) { UI.toast({ type: 'info', icon: '⚠', text: res.reason }); return; }
            UI.closeModal();
            UI.refreshPanels();
            UI.toast({ type: 'colony', icon: '🌱', text: '殖民船开始建造，建成后自动前往 ' + planet.name });
          }
        },
        { label: '查看行星', close: false, onClick: function () { UI.closeModal(); UI.selectPlanet(planet.id); } },
        { label: '打开殖民目标', close: false, onClick: function () { UI.closeModal(); UI.openColonyTargets(); } },
        { label: '稍后' }
      ],
      body: '<div class="event-text" style="text-align:left;line-height:1.8">' +
        '调查发现了一颗可以居住的行星。殖民后它会提供人口、岗位和资源，并扩大你的领土。<br><br>' +
        '殖民费用：<b style="color:var(--gold)">' + cost.alloys + ' 合金</b> + <b style="color:var(--cyan)">' + cost.influence + ' 影响力</b>。' +
        '殖民船会在首都建造，完成后自动前往目标。<br>' +
        (payReason ? '<span style="color:#ffb86b">当前无法派遣：' + esc(payReason) + '</span>' : '') + '</div>' +
        '<div class="hint-card" style="margin-top:12px"><div class="hint-title">为什么殖民</div><div class="hint-text">' +
        '新殖民地会增加人口上限、建筑位和资源产出。殖民目标需要已调查，且在领土 ' + SM.COLONY_RANGE + ' 跳以内。' +
        '打开「殖民目标」可以看到所有候选世界。</div></div>'
    });
  };

  UI.openColonyManager = function (colonyId, keepScroll) {
    const g = UI.game, p = UI.player();
    const colonies = p.colonies.map(function (id) { return g.colony(id); })
      .filter(function (c) { return c && c.owner === p.id; });
    if (!colonies.length) {
      UI.toast({ type: 'info', icon: '⚠', text: '目前没有殖民地。' });
      return;
    }
    let selected = colonyId ? g.colony(colonyId) : null;
    if (!selected || selected.owner !== p.id) {
      selected = (UI.lastManagerColony ? g.colony(UI.lastManagerColony) : null);
      if (!selected || selected.owner !== p.id) selected = g.colony(p.capital) || colonies[0];
    }
    if (!selected) return;
    UI.lastManagerColony = selected.id;
    const sorted = colonies.slice().sort(function (a, b) {
      const ac = a.id === p.capital ? 1 : 0;
      const bc = b.id === p.capital ? 1 : 0;
      if (ac !== bc) return bc - ac;
      return b.pops - a.pops;
    });
    const isCap = selected.id === p.capital;
    let body = '<div class="mgr-layout"><div class="mgr-list"><div class="yard-list-title">我的殖民地</div>';
    sorted.forEach(function (c) {
      const sys = g.system(c.systemId);
      const occ = !!c.occupiedBy;
      body += '<button class="yard-colony mgr-colony' + (c.id === selected.id ? ' active' : '') + '" data-action="mgr-select" data-colony="' + c.id + '">' +
        '<span class="yname">' + (c.id === p.capital ? '<span class="star">★</span> ' : '') + esc(c.name) +
        (c.shipQueue.length ? '<span class="yqueue">⏳' + c.shipQueue.length + '</span>' : '') + '</span>' +
        '<span class="ysub">' + (sys ? esc(sys.name) + ' 星系 · ' : '') + c.pops + '/' + g.colonyHousing(c) + ' 人口' +
        (occ ? ' · <span style="color:#ff9b9b">被占领</span>' : '') + '</span></button>';
    });
    body += '</div><div class="mgr-content">';
    const selSys = g.system(selected.systemId);
    const housing = g.colonyHousing(selected);
    const jobs = g.colonyJobs(selected);
    const totalJobs = Object.keys(jobs).reduce(function (a, k) { return a + jobs[k]; }, 0);
    const assigned = Object.keys(selected.assigned || {}).reduce(function (a, k) { return a + selected.assigned[k]; }, 0);
    const slots = g.colonyBuildingSlots(selected);
    const usedSlots = g.colonyUsedBuildingSlots(selected);
    body += '<div class="yard-head"><div><div class="title">' + esc(selected.name) +
      (isCap ? ' <span class="tag gold">★ 首都</span>' : '') +
      (selected.occupiedBy ? ' <span class="tag red">被占领</span>' : '') + '</div>' +
      '<div class="sub">' + (selSys ? esc(selSys.name) + ' 星系 · ' : '') + '人口 ' + selected.pops + ' / 住房 ' + housing +
      ' · 星基 Lv.' + selected.starbase.level + '</div></div>' +
      '<div class="btn-row"><button class="btn small" data-action="mgr-locate" data-colony="' + selected.id + '">🎯 定位</button></div></div>';
    body += '<div class="kv-grid">' +
      kv('人口', selected.pops + ' / ' + housing, '') +
      kv('岗位', assigned + ' / ' + totalJobs, '') +
      kv('失业', selected.unemployed || 0, '') +
      kv('建筑位', usedSlots + ' / ' + slots, '') +
      kv('防御', Math.round(selected.defense) + ' / ' + selected.defenseMax, '') +
      kv('船坞队列', selected.shipQueue.length + ' / 8', '') + '</div>';
    if (!selected.occupiedBy) {
      const sug = UI.buildSuggestion(selected, p);
      let sugCost = 0, sugCan = false, sugReason = '';
      if (sug.type === 'district') {
        sugCost = g.districtCost(p, sug.key);
        sugCan = p.resources.minerals >= sugCost && selected.queue.length < 6;
        if (p.resources.minerals < sugCost) sugReason = '矿物不足';
        if (selected.queue.length >= 6) sugReason = '建造队列已满';
      } else if (sug.type === 'building') {
        sugCost = g.buildingCost(p, sug.key);
        const free = usedSlots + selected.queue.filter(function (q) { return q.type === 'building'; }).length < slots;
        sugCan = free && p.resources.minerals >= sugCost;
        if (!free) sugReason = '建筑位不足';
        else if (p.resources.minerals < sugCost) sugReason = '矿物不足';
      }
      body += '<div class="hint-card" style="margin:9px 0"><div class="hint-title">建造建议</div><div class="hint-row">' +
        '<div class="hint-text">' + esc(sug.text) + (sug.type ? '<br><span class="dim">' + sugCost + '⛏ · ' +
          (sug.type === 'district' ? g.buildDays(p, SM.DISTRICTS[sug.key].time) : g.buildDays(p, SM.BUILDINGS[sug.key].time)) + ' 天</span>' : '') + '</div>' +
        (sug.type ? '<button class="btn small primary" data-action="build-suggest" data-colony="' + selected.id + '" data-type="' + sug.type + '" data-key="' + sug.key + '" title="' + esc(sugReason) + '"' + (sugCan ? '' : ' disabled') + '>建造</button>' : '') +
        '</div></div>';
    }
    if (selected.shipQueue.length) {
      body += '<div class="mgr-subsection"><div class="section-title">船坞队列</div>';
      selected.shipQueue.slice(0, 4).forEach(function (q) {
        body += '<div class="mgr-mini-row"><span>' + (SM.SHIPS[q.cls] ? SM.SHIPS[q.cls].icon + ' ' : '') + esc(q.name) + '</span>' +
          '<span class="num">' + Math.max(0, Math.ceil(q.daysLeft)) + ' 天</span></div>';
      });
      body += '</div>';
    }
    if (selected.queue.length) {
      body += '<div class="mgr-subsection"><div class="section-title">建造队列</div>';
      selected.queue.forEach(function (q, qi) {
        const pct = (1 - q.daysLeft / q.days) * 100;
        body += '<div class="mgr-mini-row"><span>🏗 ' + esc(q.name) + '</span><div class="bar" style="flex:1"><i style="width:' + pct + '%"></i></div>' +
          '<span class="num">' + Math.max(0, Math.ceil(q.daysLeft)) + '天</span>' +
          '<button class="btn small" data-action="cancel-build" data-colony="' + selected.id + '" data-index="' + qi + '" title="取消并返还一半矿物">×</button></div>';
      });
      body += '</div>';
    }
    body += '<div class="mgr-columns"><div><div class="section-title">区划</div>';
    SM.DISTRICT_ORDER.forEach(function (key) {
      const def = SM.DISTRICTS[key];
      const built = selected.districts[key] || 0;
      if (!built) return;
      body += '<div class="mgr-mini-row"><span>' + def.icon + ' ' + esc(def.name) + '</span><span class="num">' + built + ' / ' + (g.colonyMaxDistricts(selected)[key] || 0) + '</span></div>';
    });
    body += '</div><div><div class="section-title">建筑</div>';
    const counts = {};
    selected.buildings.forEach(function (b) { counts[b] = (counts[b] || 0) + 1; });
    Object.keys(counts).forEach(function (b) {
      const def = SM.BUILDINGS[b];
      if (!def) return;
      body += '<div class="mgr-mini-row"><span>' + def.icon + ' ' + esc(def.name) + '</span><span class="num">×' + counts[b] + '</span></div>';
    });
    body += '</div></div>';
    body += '</div></div>';
    const openPanel = function () {
      const c = g.colony(selected.id);
      if (!c) return;
      UI.closeModal();
      UI.selectPlanet(c.planetId);
      UI.centerOnSystem(c.systemId, Math.max(UI.camera.zoom, 0.9));
    };
    const opts = {
      kind: 'colonies',
      kicker: '帝国资产',
      title: '🏙 殖民地总览',
      sub: '共 ' + colonies.length + ' 座殖民地 · 点击左侧切换，首都置顶',
      body: body,
      width: 'wide',
      keepScroll: !!keepScroll,
      actions: [
        { label: '打开完整建造界面', cls: 'primary', close: false, onClick: openPanel },
        { label: '⚓ 船坞', close: false, onClick: function () { UI.closeModal(); UI.openShipyard(selected.id); } },
        { label: '关闭' }
      ]
    };
    if (UI.modalOpen && UI.modalKind === 'colonies') UI.renderModal(opts);
    else UI.openModal(opts);
  };

  UI.warTargets = function (enemyId) {
    const g = UI.game;
    return g.state.colonies.filter(function (c) {
      return c.owner === enemyId && c.occupiedBy !== g.player().id;
    });
  };

  UI.warSelectedFleet = function () {
    const g = UI.game, p = UI.player();
    let f = null;
    if (UI.warFleetId) {
      const wf = g.fleet(UI.warFleetId);
      if (wf && wf.owner === p.id && wf.kind === 'combat' && wf.ships.length) f = wf;
    }
    if (!f && UI.selected && UI.selected.type === 'fleet') {
      const sf = g.fleet(UI.selected.id);
      if (sf && sf.owner === p.id && sf.kind === 'combat' && sf.ships.length) f = sf;
    }
    if (!f) f = g.combatFleets(p).filter(function (x) { return x.ships.length; })[0] || null;
    return f;
  };

  UI.warAttackSystem = function (systemId) {
    const g = UI.game, p = UI.player();
    const f = UI.warSelectedFleet();
    if (!f) {
      UI.toast({ type: 'war', icon: '⚠', text: '没有可用的作战舰队，先打开帝国船坞造舰。' });
      UI.closeModal();
      UI.openShipyard(p.capital);
      return;
    }
    const target = g.system(systemId);
    const res = g.moveFleet(f, systemId, true);
    if (!res.ok) {
      UI.toast({ type: 'war', icon: '⚠', text: res.reason });
      return;
    }
    UI.closeModal();
    UI.selectFleet(f.id);
    UI.centerOnSystem(systemId, Math.max(UI.camera.zoom, 1.0));
    UI.warFleetId = f.id;
    UI.toast({ type: 'war', icon: '➤', text: f.name + ' 前往 ' + (target ? target.name : '目标') + '。舰队会自动战斗、轰炸并占领。' });
    if (UI.speed === 0) UI.setSpeed(1);
  };

  UI.warDefendCapital = function () {
    const g = UI.game, p = UI.player();
    const f = UI.warSelectedFleet();
    if (!f) {
      UI.toast({ type: 'war', icon: '⚠', text: '没有可用的作战舰队。' });
      return;
    }
    const cap = p.capital ? g.colony(p.capital) : null;
    if (!cap) return;
    const res = g.moveFleet(f, cap.systemId, true);
    if (!res.ok) { UI.toast({ type: 'war', icon: '⚠', text: res.reason }); return; }
    UI.closeModal();
    UI.selectFleet(f.id);
    UI.centerOnSystem(cap.systemId, Math.max(UI.camera.zoom, 0.9));
    UI.warFleetId = f.id;
    UI.toast({ type: 'war', icon: '🛡', text: f.name + ' 返回首都防守。' });
    if (UI.speed === 0) UI.setSpeed(1);
  };

  UI.openWarRoom = function (fleetId) {
    const g = UI.game, p = UI.player();
    const fleets = g.combatFleets(p).filter(function (f) { return f.ships.length; });
    let fleet = null;
    if (fleetId) {
      const chosen = g.fleet(fleetId);
      if (chosen && chosen.owner === p.id && chosen.kind === 'combat' && chosen.ships.length) {
        fleet = chosen;
        UI.warFleetId = chosen.id;
      }
    }
    if (!fleet) fleet = UI.warSelectedFleet();
    UI.warFleetId = fleet ? fleet.id : null;
    const wars = g.warsFor(p.id);
    let body = '';

    if (!wars.length) {
      body += '<div class="hint-card" style="margin:0 0 12px"><div class="hint-title">当前没有战争</div><div class="hint-text">' +
        '战争分三步：在「外交」里宣战（消耗 30 影响力）→ 打开「战争指挥」→ 选一支舰队，点敌方殖民地的「派舰队」。<br>' +
        '舰队到达后会先打敌方星际基地，再自动轨道轰炸；行星防御降到 0 就会占领。打不过可以在外交面板停战，停战按现状划界。</div></div>';
      const contacts = g.state.empires.filter(function (e) { return e.id !== p.id && e.alive && p.contacts[e.id]; });
      body += '<div class="section"><div class="section-title">可接触的帝国</div>';
      if (!contacts.length) {
        body += '<div class="empty">还没有接触其他帝国。科研船和舰队靠近他们的领土后会建立通讯。</div>';
      } else {
        contacts.forEach(function (e) {
          const rel = g.relation(p.id, e.id);
          body += '<div class="war-target"><div class="wt-main"><div class="wt-name">' + esc(e.name) +
            (g.isAtWar(p.id, e.id) ? ' <span class="tag red">战争</span>' : '') + '</div>' +
            '<div class="wt-meta">关系 ' + (rel >= 0 ? '+' : '') + Math.round(rel) + ' · 战力 ' + g.empirePower(e) +
            ' · ' + g.empireColonyCount(e) + ' 殖民地</div></div>' +
            '<button class="btn small" data-action="open-diplomacy">外交</button></div>';
        });
      }
      body += '</div>';
      if (!fleets.length) {
        body += '<div class="hint-card"><div class="hint-title">先准备舰队</div><div class="hint-text">宣战前至少造几艘护卫舰。没有舰队，战争只会挨打。</div>' +
          '<button class="btn small primary" data-action="open-shipyard">⚓ 打开帝国船坞</button></div>';
      } else {
        body += '<div class="section"><div class="section-title">你的舰队</div>';
        fleets.forEach(function (f) {
          const sys = g.system(f.systemId);
          body += '<div class="war-target"><div class="wt-main"><div class="wt-name">' + esc(f.name) + '</div>' +
            '<div class="wt-meta">战力 ' + g.fleetPower(f) + ' · ' + (sys ? esc(sys.name) : '航行中') + ' · ' + f.ships.length + ' 艘</div></div></div>';
        });
        body += '</div>';
      }
      UI.openModal({
        kind: 'warroom',
        kicker: '战争指挥',
        title: '🎯 战争指挥',
        sub: '先宣战，再选目标。所有作战舰船都会在抵达后自动战斗。',
        body: body,
        width: 'wide',
        actions: [
          { label: '打开外交', close: false, onClick: function () { UI.closeModal(); UI.openDiplomacy(); } },
          { label: '战争指南', close: false, onClick: function () { UI.closeModal(); UI.openWarHelp(); } },
          { label: '关闭' }
        ]
      });
      return;
    }

    body += '<div class="hint-card" style="margin:0 0 10px"><div class="hint-title">怎么下命令</div><div class="hint-text">' +
      '先选一支舰队，再点敌方殖民地的「派舰队」。舰队到达后会自动摧毁星际基地、轨道轰炸并占领行星。' +
      '右键敌方星系也可以直接派当前舰队过去。</div></div>';

    // 我的舰队
    body += '<div class="section"><div class="section-title">我的舰队</div><div class="war-fleet-list">';
    if (!fleets.length) {
      body += '<div class="empty">没有作战舰队。</div>' +
        '<button class="btn primary" data-action="open-shipyard">⚓ 去帝国船坞造舰</button>';
    } else {
      fleets.forEach(function (f) {
        const sys = g.system(f.systemId);
        body += '<button class="war-fleet' + (fleet && f.id === fleet.id ? ' active' : '') + '" data-action="war-select" data-fleet="' + f.id + '">' +
          '<span class="wf-name">' + esc(f.name) + '</span>' +
          '<span class="wf-meta">战力 ' + g.fleetPower(f) + ' · ' + (sys ? esc(sys.name) : '航行中') + ' · ' + f.ships.length + ' 艘</span></button>';
      });
    }
    body += '</div></div>';

    let enemyMax = 0;
    wars.forEach(function (w) {
      const enemy = g.empire(w.a === p.id ? w.b : w.a);
      if (!enemy) return;
      g.state.fleets.forEach(function (ef) {
        if (ef.owner === enemy.id && ef.kind === 'combat') enemyMax = Math.max(enemyMax, g.fleetPower(ef));
      });
    });
    if (fleet && enemyMax > g.fleetPower(fleet) * 1.15) {
      body += '<div class="small" style="text-align:left;color:#ffb86b;margin:2px 0 8px">⚠ 敌方最大舰队战力 ' + enemyMax +
        '，高于你所选舰队的 ' + g.fleetPower(fleet) + '。可以先补舰、集火较弱目标，或留在首都防守。</div>';
    }

    wars.forEach(function (w) {
      const enemy = g.empire(w.a === p.id ? w.b : w.a);
      if (!enemy) return;
      const enemyColonies = g.state.colonies.filter(function (c) { return c.owner === enemy.id; });
      const occupied = enemyColonies.filter(function (c) { return c.occupiedBy === p.id; }).length;
      const total = Math.max(1, enemyColonies.length);
      const pct = occupied / total * 100;
      body += '<div class="war-enemy"><div class="war-enemy-head">' +
        '<span class="color-dot" style="background:' + enemy.color + ';color:' + enemy.color + '"></span>' +
        '<span class="war-enemy-name">对 ' + esc(enemy.name) + ' 的战争</span>' +
        '<span class="war-enemy-meta">占领 ' + occupied + ' / ' + total + ' · 疲劳 ' + Math.round(w.ex[p.id] || 0) + '</span></div>' +
        '<div class="progress red"><i style="width:' + pct + '%"></i></div>';

      // 敌方殖民地
      const targets = UI.warTargets(enemy.id).slice();
      targets.sort(function (a, b) {
        return (a.defense + a.starbase.level * 250) - (b.defense + b.starbase.level * 250);
      });
      body += '<div class="section-title" style="margin-top:10px">敌方殖民地 · 选择目标</div>';
      if (!targets.length) {
        body += '<div class="empty" style="padding:4px 0">敌方殖民地已被全部占领或不存在。</div>';
      } else {
        targets.slice(0, 8).forEach(function (c, i) {
          const sys = g.system(c.systemId);
          if (!sys) return;
          const ef = g.state.fleets.filter(function (x) {
            return x.owner === enemy.id && x.kind === 'combat' && x.systemId === sys.id;
          });
          const ep = ef.reduce(function (a, x) { return a + g.fleetPower(x); }, 0);
          const dist = fleet ? SM.Galaxy.jumpsBetween(g.state.systems, fleet.systemId, sys.id) : Infinity;
          body += '<div class="war-target' + (i === 0 ? ' recommended' : '') + '">' +
            '<div class="wt-main"><div class="wt-name">' + esc(c.name) +
            (c.id === enemy.capital ? ' <span class="tag gold">★ 首都</span>' : '') +
            (i === 0 ? ' <span class="tag cyan">推荐</span>' : '') + '</div>' +
            '<div class="wt-meta">' + esc(sys.name) + ' 星系 · 防御 ' + Math.round(c.defense) + ' · 星基 Lv.' + c.starbase.level +
            ' · 敌方舰队 ' + ep + ' · 距离 ' + (isFinite(dist) ? dist + ' 跳' : '?') + '</div></div>' +
            '<button class="btn small primary" data-action="war-attack" data-system="' + sys.id + '"' + (fleet ? '' : ' disabled') + '>➤ 派舰队</button></div>';
        });
      }

      // 敌方舰队
      const efleets = g.state.fleets.filter(function (f) {
        return f.owner === enemy.id && f.kind === 'combat' && f.ships.length;
      });
      if (efleets.length) {
        body += '<div class="section-title" style="margin-top:10px">敌方舰队 · 可迎击</div>';
        efleets.slice(0, 5).forEach(function (ef) {
          const sysId = ef.travel ? ef.travel.to : ef.systemId;
          const sys = g.system(sysId);
          body += '<div class="war-target"><div class="wt-main"><div class="wt-name">' + esc(ef.name) + '</div>' +
            '<div class="wt-meta">战力 ' + g.fleetPower(ef) + ' · ' + (sys ? esc(sys.name) : '航行中') + ' · ' + ef.ships.length + ' 艘</div></div>' +
            '<button class="btn small" data-action="war-attack" data-system="' + sysId + '"' + (fleet ? '' : ' disabled') + '>迎击</button></div>';
        });
      }
      body += '</div>';
    });

    const opts = {
      kind: 'warroom',
      kicker: '战争指挥',
      title: '🎯 战争指挥',
      sub: '选舰队 → 选目标 → 派舰队。舰队到达后自动战斗、轰炸、占领。',
      body: body,
      width: 'wide',
      keepScroll: true,
      actions: [
        { label: '🛡 防守首都', close: false, onClick: function () { UI.warDefendCapital(); } },
        { label: '🛑 停战', close: false, onClick: function () { UI.closeModal(); UI.openDiplomacy(); } },
        { label: '⚓ 船坞', close: false, onClick: function () { UI.closeModal(); UI.openShipyard(); } },
        { label: '关闭' }
      ]
    };
    if (UI.modalOpen && UI.modalKind === 'warroom') UI.renderModal(opts);
    else UI.openModal(opts);
  };

  UI.openShipyard = function (colonyId, keepScroll) {
    const g = UI.game, p = UI.player();
    const owned = p.colonies.map(function (id) { return g.colony(id); })
      .filter(function (c) { return c && !c.occupiedBy; });
    if (!owned.length) {
      UI.toast({ type: 'info', icon: '⚠', text: '没有可用的船坞殖民地。' });
      return;
    }
    let selected = colonyId ? g.colony(colonyId) : null;
    if (!selected || selected.owner !== p.id || selected.occupiedBy) {
      selected = (UI.lastYardColony ? g.colony(UI.lastYardColony) : null);
      if (!selected || selected.owner !== p.id || selected.occupiedBy) {
        selected = g.colony(p.capital) || owned[0];
      }
    }
    if (!selected) return;
    UI.lastYardColony = selected.id;
    const colonies = owned.slice().sort(function (a, b) {
      const ac = a.id === p.capital ? 1 : 0;
      const bc = b.id === p.capital ? 1 : 0;
      if (ac !== bc) return bc - ac;
      if (b.shipQueue.length !== a.shipQueue.length) return b.shipQueue.length - a.shipQueue.length;
      return b.pops - a.pops;
    });
    const isCap = selected.id === p.capital;
    const totalQueue = owned.reduce(function (a, c) { return a + c.shipQueue.length; }, 0);
    const totalShips = g.state.fleets.reduce(function (a, f) {
      return a + (f.owner === p.id ? f.ships.length : 0);
    }, 0);
    const upkeep = g.fleetUpkeep(p.id);

    let body = '<div class="small" style="text-align:left;margin-bottom:10px">每个殖民地拥有独立船坞队列。舰船完成后会出现在对应星系；作战舰船会自动编入空闲舰队或组建新舰队。关闭船坞后，时间会恢复推进（若此前正在运行）。<br>' +
      '<b>科研船</b>负责调查星系，<b>工程船</b>负责建太空站；两者通常各 1–2 艘就够，不需要一直造。殖民船从「殖民目标」派遣。</div>';
    body += '<div class="yard-layout"><div class="yard-list"><div class="yard-list-title">船坞殖民地</div>';
    colonies.forEach(function (c) {
      const cap = c.id === p.capital;
      const sys = g.system(c.systemId);
      body += '<button class="yard-colony' + (c.id === selected.id ? ' active' : '') + '" data-yard-colony="' + c.id + '">' +
        '<span class="yname">' + (cap ? '<span class="star">★</span>' : '') + esc(c.name) +
        (c.shipQueue.length ? '<span class="yqueue">⏳ ' + c.shipQueue.length + '</span>' : '') + '</span>' +
        '<span class="ysub">' + (cap ? '首都 · ' : '') + (sys ? esc(sys.name) + ' 星系 · ' : '') + c.pops + ' 人口</span>' +
        '</button>';
    });
    body += '</div><div class="yard-content">';
    const selSys = g.system(selected.systemId);
    body += '<div class="yard-head"><div><div class="title">' + esc(selected.name) +
      (isCap ? ' <span class="tag gold">首都</span>' : '') + '</div>' +
      '<div class="sub">' + (selSys ? esc(selSys.name) + ' 星系 · ' : '') + '船坞队列 ' + selected.shipQueue.length + '/8</div></div>' +
      '<button class="btn small" data-yard-goto="' + selected.id + '">查看殖民地</button></div>';
    body += '<div class="yard-queue"><div class="yard-queue-title">建造队列</div>';
    if (!selected.shipQueue.length) {
      body += '<div class="empty" style="padding:0">船坞空闲，可以下新订单。</div>';
    } else {
      selected.shipQueue.forEach(function (q) {
        const pct = (1 - q.daysLeft / q.days) * 100;
        body += '<div class="yard-queue-row"><span>' + (SM.SHIPS[q.cls] ? SM.SHIPS[q.cls].icon : '⚙') + ' ' + esc(q.name) + '</span>' +
          '<span class="qbar"><i style="width:' + Math.max(0, Math.min(100, pct)) + '%"></i></span>' +
          '<span class="qtime">' + Math.max(0, Math.ceil(q.daysLeft)) + ' 天</span></div>';
      });
    }
    body += '</div>';
    body += '<div class="ship-grid yard-ships">';
    SM.SHIP_ORDER.forEach(function (cls) {
      const def = SM.SHIPS[cls];
      const unlocked = g.hasShipClass(p, cls);
      const cost = g.shipCost(p, cls);
      body += '<div class="ship-card' + (unlocked ? '' : ' locked') + '">' +
        '<div class="ship-head"><span class="ic">' + def.icon + '</span><b>' + def.name + '</b>' +
        (unlocked ? '' : '<span class="tag">未解锁</span>') + '</div>' +
        '<div class="ship-stats">' +
        '<span>船体 <b>' + def.hull + '</b></span><span>护盾 <b>' + def.shield + '</b></span>' +
        '<span>伤害 <b>' + def.damage + '</b></span><span>闪避 <b>' + Math.round(def.evasion * 100) + '%</b></span>' +
        '</div>' +
        '<div class="ship-cost">' + cost + ' 合金 · ' + def.days + ' 天 · 维护 ' + def.upkeep + '⚡/月</div>' +
        '<div class="btn-row" style="margin-top:6px">' +
        '<button class="btn small" data-yard-ship="' + cls + '" data-count="1"' + (unlocked && p.resources.alloys >= cost ? '' : ' disabled') + '>建造 ×1</button>' +
        '<button class="btn small" data-yard-ship="' + cls + '" data-count="3"' + (unlocked && p.resources.alloys >= cost * 3 ? '' : ' disabled') + '>×3</button>' +
        '</div></div>';
    });
    ['science', 'construction'].forEach(function (cls) {
      const def = SM.SHIPS[cls];
      const cost = g.shipCost(p, cls);
      const count = g.state.fleets.filter(function (f) { return f.owner === p.id && f.kind === cls; }).length;
      const enough = count >= 2;
      body += '<div class="ship-card">' +
        '<div class="ship-head"><span class="ic">' + def.icon + '</span><b>' + def.name + '</b>' +
        (enough ? '<span class="tag">已有 ' + count + ' 艘</span>' : '') + '</div>' +
        '<div class="ship-desc">' + esc(def.desc) + '</div>' +
        '<div class="ship-stats"><span>船体 <b>' + def.hull + '</b></span><span>航速 <b>' + def.speed + '</b></span></div>' +
        '<div class="ship-cost">' + cost + ' 合金 · ' + def.days + ' 天</div>' +
        '<button class="btn small" data-yard-ship="' + cls + '" data-count="1"' + (p.resources.alloys >= cost ? '' : ' disabled') + '>' +
        (enough ? '仍要建造' : '建造') + '</button>' +
        '</div>';
    });
    body += '</div></div></div>';
    const opts = {
      kind: 'shipyard',
      kicker: '造船与编成',
      title: '⚓ 帝国船坞',
      sub: '合金 ' + fmt(p.resources.alloys) + ' · 现役舰船 ' + totalShips + ' 艘 · 维护 ' + signed(-upkeep) + '⚡/月 · 全部队列 ' + totalQueue,
      body: body,
      width: 'wide',
      keepScroll: !!keepScroll,
      actions: [{ label: '关闭' }],
      bind: function (el) {
        el.querySelectorAll('[data-yard-colony]').forEach(function (b) {
          b.onclick = function () { UI.openShipyard(b.dataset.yardColony, false); };
        });
        el.querySelectorAll('[data-yard-ship]').forEach(function (b) {
          b.onclick = function () {
            const cls = b.dataset.yardShip;
            const count = parseInt(b.dataset.count, 10);
            const res = g.buildShip(selected.id, cls, count);
            if (!res.ok) UI.toast({ type: 'info', icon: '⚠', text: res.reason });
            else UI.toast({ type: 'info', icon: '⚙', text: '已下订单：' + SM.SHIPS[cls].name + ' ×' + count + '（' + selected.name + '）' });
            UI.openShipyard(selected.id, true);
          };
        });
        el.querySelectorAll('[data-yard-goto]').forEach(function (b) {
          b.onclick = function () {
            const cid = b.dataset.yardGoto;
            UI.closeModal();
            UI.selectColony(cid);
          };
        });
      }
    };
    if (UI.modalOpen && UI.modalKind === 'shipyard') UI.renderModal(opts);
    else UI.openModal(opts);
  };

  UI.confirmLoad = function () {
    let raw = null;
    try { raw = localStorage.getItem(SM.SAVE_KEY); } catch (err) { raw = null; }
    if (!raw) {
      UI.toast({ type: 'info', icon: '⚠', text: '没有找到存档（或浏览器禁用了本地存储）。' });
      return;
    }
    UI.openModal({
      kind: 'confirm',
      kicker: '读取存档',
      title: '读取上次保存的银河？',
      sub: '当前未保存的进度将会丢失。',
      width: 'narrow',
      actions: [
        { label: '取消' },
        { label: '读取', cls: 'primary', onClick: function () { if (UI.hooks.load) UI.hooks.load(); } }
      ]
    });
  };

  UI.openHelp = function () {
    UI.openModal({
      kind: 'help',
      kicker: '舰长手册',
      title: '如何在银河中生存',
      sub: '这是一个实时制（可暂停）的 4X 迷你游戏。',
      width: 'wide',
      closable: true,
      body:
        '<div class="help-grid">' +
        '<div><h4>🎯 目标</h4><p>在 2250 年前成为银河最强的帝国，或者消灭所有对手。得分来自人口、殖民地、科技、舰队与传统。</p>' +
        '<h4>🧭 操作</h4><p>左键选择星系/舰队，右键让选中的舰队移动。滚轮缩放，拖拽平移。空格暂停，<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 调速。</p>' +
        '<h4>🔭 探索</h4><p>科研船会自动调查星系（可在舰队面板关闭）。调查后才知道行星类型、资源点与异常现象。工程船会自动在领土内建造太空站。</p></div>' +
        '<div><h4>🌱 扩张</h4><p>在已调查的宜居行星面板点击「殖民」。殖民船在首都建造，完成后自动前往。殖民需要合金与影响力，且目标需在领土 4 跳以内。</p>' +
        '<h4>🏗 经济</h4><p>区划提供住房与岗位，建筑提供高级岗位。人口自动分配岗位；失业与住房不足会拖慢增长。太空站直接产出资源。</p>' +
        '<h4>🎯 战争</h4><p>外交面板宣战。舰队进入敌方星系后先摧毁星际基地，再用轨道轰炸把行星防御打到 0 以占领。停战时占领区归占领者。战争疲劳到 100 会强制停战。</p>' +
        '<p>随时点底栏「⚓ 船坞」打开帝国船坞：左侧选择殖民地，右侧下造船订单，各殖民地队列独立。</p></div>' +
        '</div>' +
        '<p class="small" style="text-align:left;margin-top:14px">提示：自动暂停会在战斗、殖民地建立、科技完成、外交事件时暂停游戏。可在底栏关闭。</p>',
      actions: [
        { label: '关闭', cls: 'primary' }
      ]
    });
  };

  UI.openEventModal = function () {
    const g = UI.game;
    const pe = g.state.pendingEvent;
    if (!pe) return;
    const ev = g.eventById(pe.eventId);
    if (!ev) { g.state.pendingEvent = null; return; }
    const choices = ev.options.map(function (o, i) {
      return '<button class="choice" data-choice="' + i + '"><b>' + esc(o.label) + '</b>' +
        (o.tip ? '<small>' + esc(o.tip) + '</small>' : '') + '</button>';
    }).join('');
    UI.openModal({
      kind: 'event',
      kicker: '星际事件',
      title: ev.icon + ' ' + esc(ev.title),
      body: '<div class="event-art">' + ev.icon + '</div><div class="event-text">' + esc(ev.text) + '</div>' +
        '<div class="choice-list">' + choices + '</div>',
      width: 'narrow',
      closable: false,
      bind: function (el) {
        el.querySelectorAll('[data-choice]').forEach(function (b) {
          b.onclick = function () {
            g.resolveEvent(parseInt(b.dataset.choice, 10));
            UI.closeModal();
            UI.refreshPanels();
          };
        });
      }
    });
  };

  UI.openPeaceModal = function () {
    const g = UI.game;
    const pp = g.state.pendingPeace;
    if (!pp) return;
    const e = g.empire(pp.from);
    UI.openModal({
      kind: 'peace',
      kicker: '外交来电',
      title: '🕊 停战请求',
      sub: e ? esc(e.name) : '',
      body: '<div class="event-text">' + esc(pp.text) + '<br><br>如果接受，双方将以现有边界停战，被占领的殖民地归占领者所有。</div>',
      width: 'narrow',
      closable: false,
      actions: [
        { label: '拒绝', cls: 'danger', onClick: function () { g.rejectPeaceOffer(); UI.toast({ type: 'diplo', icon: '🚫', text: '我们拒绝了停战请求。' }); } },
        { label: '接受停战', cls: 'primary', onClick: function () { g.acceptPeaceOffer(); UI.toast({ type: 'diplo', icon: '🕊', text: '停战协议已签署。' }); UI.refreshPanels(); } }
      ]
    });
  };

  UI.openGameOver = function () {
    const g = UI.game;
    const go = g.state.gameOver;
    if (!go) return;
    const board = g.scoreBoard();
    const year = SM.dateParts(go.day !== undefined ? go.day : g.state.day).year;
    const title = go.type === 'defeat' ? '💀 帝国陨落' : go.type === 'victory' ? '👑 银河霸主' : '🏆 纪元结算';
    const sub = go.type === 'defeat' ? '我们的故事在群星之间结束了。' :
      go.type === 'victory' ? '所有敌对帝国都已被消灭。银河属于你。' :
      year + ' 年。银河的格局已经确定。';
    let body = '<table class="score-table"><thead><tr><th>帝国</th><th>得分</th><th>人口</th><th>殖民地</th><th>科技</th><th>舰队</th></tr></thead><tbody>';
    board.forEach(function (r, i) {
      body += '<tr class="' + (r.isPlayer ? 'me' : '') + '"><td>' + (i + 1) + '. ' + esc(r.name) + '</td>' +
        '<td class="num">' + r.score + '</td><td class="num">' + r.pops + '</td><td class="num">' + r.colonies + '</td>' +
        '<td class="num">' + r.techs + '</td><td class="num">' + r.power + '</td></tr>';
    });
    body += '</tbody></table>';
    const actions = [];
    if (go.type === 'score') {
      actions.push({
        label: '继续游戏', cls: 'primary', onClick: function () {
          g.continueAfterScore();
          UI.lastGameOver = null;
          UI.refreshPanels();
        }
      });
    }
    actions.push({ label: '重新开始', onClick: function () { location.reload(); } });
    UI.openModal({ kind: 'gameover', kicker: '结局', title: title, sub: sub, body: body, width: 'wide', closable: false, actions: actions });
  };

  /* ------------------------------------------------------------------ */
  /* 每帧 / 定时刷新                                                     */
  /* ------------------------------------------------------------------ */
  UI.processNotices = function () {
    if (!UI.game) return;
    const list = UI.game.takeNotices();
    if (list.length) UI.panelDirty = true;
    list.forEach(function (n) {
      UI.toast(n);
      if (n.autoPause && UI.autoPause) UI.setSpeed(0);
      if (n.type === 'tech') {
        UI.techPrompt = n.cat || SM.RESEARCH_ORDER.find(function (c) { return !UI.player().research[c].current; }) || null;
      }
      if (n.warOnPlayer && n.attackerId) UI.warBriefing = n.attackerId;
      if (n.firstContact && n.otherId) UI.firstContactPrompt = n.otherId;
      if (n.firstHabitable && n.planetId) UI.habitablePrompt = n.planetId;
    });
  };

  UI.tick = function (now) {
    if (!UI.game) return;
    if (now - UI.lastNotices > 180) {
      UI.lastNotices = now;
      UI.processNotices();
    }
    if (now - UI.lastTop > 400) {
      UI.lastTop = now;
      UI.renderTopbar();
    }
    if (now - UI.lastPanels > 900) {
      if (!UI.modalOpen && !UI.hoverLeft && !UI.hoverRight && (!UI.drag || !UI.drag.active) &&
        (UI.speed > 0 || UI.panelDirty)) {
        UI.lastPanels = now;
        UI.panelDirty = false;
        UI.renderLeft();
        UI.renderRight();
        UI.renderBottom();
        UI.renderMapLegend();
        UI.checkQuestProgress();
      }
    }
    // 弹窗触发
    if (!UI.modalOpen) {
      const g = UI.game;
      if (g.state.gameOver) UI.openGameOver();
      else if (g.state.pendingEvent) UI.openEventModal();
      else if (g.state.pendingUltimatum) UI.openUltimatumModal();
      else if (g.state.pendingPeace) UI.openPeaceModal();
      else if (UI.warBriefing) {
        const id = UI.warBriefing;
        UI.warBriefing = null;
        UI.openWarBriefing(id);
      } else if (UI.firstContactPrompt) {
        const id = UI.firstContactPrompt;
        UI.firstContactPrompt = null;
        UI.openFirstContact(id);
      } else if (UI.habitablePrompt) {
        const pid = UI.habitablePrompt;
        UI.habitablePrompt = null;
        UI.openHabitablePrompt(pid);
      } else if (UI.techPrompt) {
        const cat = UI.techPrompt;
        UI.techPrompt = null;
        UI.openTechModal(cat);
      }
    }
  };

  UI.renderBottom = function () {
    const p = UI.player();
    if (!p) return;
    const obj = UI.objectives();
    const done = obj.filter(function (o) { return o.done; }).length;
    const label = document.querySelector('#bottombar .hint');
    if (label) {
      const idle = document.querySelector('#bottombar .obj-mini');
      // 保持简洁：仅更新标题
    }
  };

  UI.render = function (now) {
    if (!UI.game || !UI.renderer) return;
    UI.renderer.draw(now);
  };

  /* ------------------------------------------------------------------ */
  /* 渲染器                                                              */
  /* ------------------------------------------------------------------ */
  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.dpr = 1;
      this.stars = [];
      this.nebulae = [];
      this.resize = this.resize.bind(this);
      window.addEventListener('resize', this.resize);
      this.resize();
      for (let i = 0; i < 260; i++) {
        this.stars.push({
          x: Math.random(), y: Math.random(),
          r: Math.random() * 1.4 + 0.25,
          a: Math.random() * 0.55 + 0.15,
          tw: Math.random() * 6.28
        });
      }
      for (let i = 0; i < 5; i++) {
        this.nebulae.push({
          x: (Math.random() - 0.5) * 2600,
          y: (Math.random() - 0.5) * 1500,
          r: 400 + Math.random() * 500,
          c: i % 2 ? '80,120,255' : '150,80,220',
          a: 0.05 + Math.random() * 0.05
        });
      }
      this.nebulae.push(
        { x: -520, y: -320, r: 620, c: '60,140,255', a: 0.085 },
        { x: 640, y: 260, r: 760, c: '140,70,220', a: 0.07 },
        { x: -980, y: 420, r: 640, c: '40,180,200', a: 0.06 },
        { x: 980, y: -420, r: 560, c: '80,120,255', a: 0.06 },
        { x: 0, y: 0, r: 760, c: '150,120,255', a: 0.06 }
      );
    }
    resize() {
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = window.innerWidth;
      this.h = window.innerHeight;
      this.canvas.width = Math.floor(this.w * this.dpr);
      this.canvas.height = Math.floor(this.h * this.dpr);
      this.canvas.style.width = this.w + 'px';
      this.canvas.style.height = this.h + 'px';
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    toScreen(x, y) {
      return UI.worldToScreen(x, y);
    }
    systemPos(sys) { return UI.worldToScreen(sys.x, sys.y); }
    starRadius(sys) {
      const z = UI.camera.zoom;
      return clamp(3.2 + z * 4.4, 2.8, 10);
    }
    fleetScreenPos(f) {
      const g = UI.game;
      if (f.travel) {
        const from = g.system(f.travel.from);
        const to = g.system(f.travel.to);
        if (from && to) {
          const t = f.travel.progress / f.travel.total;
          return UI.worldToScreen(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        }
      }
      const sys = g.system(f.systemId);
      if (!sys) return { x: -999, y: -999 };
      const base = this.systemPos(sys);
      const mates = g.fleetsIn(sys.id).slice().sort(function (a, b) {
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
      const idx = Math.max(0, mates.indexOf(f));
      const ang = -Math.PI / 2 + idx * 2.399;
      const rad = 20 + Math.floor(idx / 6) * 11;
      return { x: base.x + Math.cos(ang) * rad, y: base.y + Math.sin(ang) * rad, sys: base };
    }
    hitTest(mx, my) {
      const g = UI.game;
      if (!g) return null;
      let best = null, bestD = 15;
      g.state.fleets.forEach(function (f) {
        if (!f.ships.length) return;
        const pos = this.fleetScreenPos(f);
        const d = Math.hypot(pos.x - mx, pos.y - my);
        if (d < bestD) { bestD = d; best = { type: 'fleet', id: f.id }; }
      }, this);
      if (best) return best;
      let bestSys = null, bestSysD = 999;
      g.state.systems.forEach(function (sys) {
        const pos = this.systemPos(sys);
        const r = this.starRadius(sys) + 9;
        const d = Math.hypot(pos.x - mx, pos.y - my);
        if (d < Math.max(13, r) && d < bestSysD) { bestSysD = d; bestSys = { type: 'system', id: sys.id }; }
      }, this);
      return bestSys;
    }
    draw(now) {
      const g = UI.ctx = this.ctx;
      const cam = UI.camera;
      const z = cam.zoom;
      const w = this.w, h = this.h;
      const grd = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.78);
      grd.addColorStop(0, '#0a1428');
      grd.addColorStop(0.55, '#060c19');
      grd.addColorStop(1, '#03060d');
      g.fillStyle = grd;
      g.fillRect(0, 0, w, h);

      // 背景星
      const t = now / 1000;
      this.stars.forEach(function (s) {
        const sx = ((s.x * w - cam.x * 0.012) % w + w) % w;
        const sy = ((s.y * h - cam.y * 0.012) % h + h) % h;
        const a = s.a * (0.7 + 0.3 * Math.sin(t * 1.3 + s.tw));
        g.fillStyle = 'rgba(200,225,255,' + a.toFixed(3) + ')';
        g.beginPath();
        g.arc(sx, sy, s.r, 0, Math.PI * 2);
        g.fill();
      });
      // 星云
      this.nebulae.forEach(function (n) {
        const p = UI.worldToScreen(n.x, n.y);
        const rad = n.r * z;
        if (p.x + rad < 0 || p.x - rad > w || p.y + rad < 0 || p.y - rad > h) return;
        const ng = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(10, rad));
        ng.addColorStop(0, 'rgba(' + n.c + ',' + n.a + ')');
        ng.addColorStop(1, 'rgba(' + n.c + ',0)');
        g.fillStyle = ng;
        g.fillRect(p.x - rad, p.y - rad, rad * 2, rad * 2);
      });
      // 银心
      const core = UI.worldToScreen(0, 0);
      const cg = g.createRadialGradient(core.x, core.y, 0, core.x, core.y, 520 * z);
      cg.addColorStop(0, 'rgba(130,110,255,0.20)');
      cg.addColorStop(0.4, 'rgba(90,80,210,0.07)');
      cg.addColorStop(1, 'rgba(60,60,180,0)');
      g.fillStyle = cg;
      g.fillRect(core.x - 520 * z, core.y - 520 * z, 1040 * z, 1040 * z);

      const systems = UI.game.state.systems;
      const player = UI.player();
      const playerCap = player.capital ? UI.game.colony(player.capital) : null;
      const capSysId = playerCap ? playerCap.systemId : null;
      const byId = {};
      systems.forEach(function (s) { byId[s.id] = s; });

      // 航道：同国航道用国家色；跨国航道在中点分成两国颜色，边界一眼可见
      if (UI.showLanes) {
        systems.forEach(function (sys, i) {
          const a = this.systemPos(sys);
          sys.lanes.forEach(function (li) {
            if (li <= i) return;
            const other = systems[li];
            const b = this.systemPos(other);
            const oa = sys.owner ? UI.game.empire(sys.owner) : null;
            const ob = other.owner ? UI.game.empire(other.owner) : null;
            const selectedLane = UI.selected && (UI.selected.systemId === sys.id || UI.selected.systemId === other.id);
            if (selectedLane) {
              g.strokeStyle = 'rgba(140,220,255,0.55)';
              g.lineWidth = Math.max(1, z * 1.6);
              g.beginPath();
              g.moveTo(a.x, a.y);
              g.lineTo(b.x, b.y);
              g.stroke();
              return;
            }
            if (oa && ob && oa.id === ob.id) {
              g.strokeStyle = SM.hexToRgba(oa.color, 0.48);
              g.lineWidth = Math.max(1, z * 1.35);
              g.beginPath();
              g.moveTo(a.x, a.y);
              g.lineTo(b.x, b.y);
              g.stroke();
            } else if (oa || ob) {
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              g.lineWidth = Math.max(1.2, z * 1.6);
              if (oa) {
                g.strokeStyle = SM.hexToRgba(oa.color, 0.56);
                g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mid.x, mid.y); g.stroke();
              } else {
                g.strokeStyle = 'rgba(120,170,255,0.20)';
                g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mid.x, mid.y); g.stroke();
              }
              if (ob) {
                g.strokeStyle = SM.hexToRgba(ob.color, 0.56);
                g.beginPath(); g.moveTo(mid.x, mid.y); g.lineTo(b.x, b.y); g.stroke();
              } else {
                g.strokeStyle = 'rgba(120,170,255,0.20)';
                g.beginPath(); g.moveTo(mid.x, mid.y); g.lineTo(b.x, b.y); g.stroke();
              }
            } else {
              g.strokeStyle = 'rgba(120,170,255,0.22)';
              g.lineWidth = Math.max(0.7, z * 1.1);
              g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke();
            }
          }, this);
        }, this);
      }

      // 领土底色：用更大的半透明色块 + 柔和外缘，让“谁占哪块”先于星体颜色被看到
      if (UI.showBorders) {
        systems.forEach(function (sys) {
          if (!sys.owner) return;
          const oe = UI.game.empire(sys.owner);
          if (!oe) return;
          const p = this.systemPos(sys);
          const rad = (88 + 25) * z;
          if (p.x + rad < 0 || p.x - rad > w || p.y + rad < 0 || p.y - rad > h) return;
          const solid = z < 0.6 ? 0.16 : 0.10;
          g.fillStyle = SM.hexToRgba(oe.color, solid);
          g.beginPath();
          g.arc(p.x, p.y, rad * 0.92, 0, Math.PI * 2);
          g.fill();
          const tg = g.createRadialGradient(p.x, p.y, rad * 0.55, p.x, p.y, rad * 1.35);
          tg.addColorStop(0, SM.hexToRgba(oe.color, 0.0));
          tg.addColorStop(0.5, SM.hexToRgba(oe.color, 0.035));
          tg.addColorStop(1, SM.hexToRgba(oe.color, 0));
          g.fillStyle = tg;
          g.fillRect(p.x - rad * 1.35, p.y - rad * 1.35, rad * 2.7, rad * 2.7);
        }, this);
      }

      // 星系
      const hoverSys = UI.hover && UI.hover.type === 'system' ? UI.hover.id : null;
      systems.forEach(function (sys) {
        const pos = this.systemPos(sys);
        const r = this.starRadius(sys);
        if (pos.x + 80 < 0 || pos.x - 80 > w || pos.y + 80 < 0 || pos.y - 80 > h) return;
        const known = !!sys.surveyed[player.id];
        const star = SM.STAR_TYPES[sys.star];
        const color = known ? star.color : '#596b8c';
        const alpha = known ? 1 : 0.5;
        // 光晕：低缩放时收敛，避免星体颜色盖过领土颜色
        const lowZoom = z < 0.55;
        const glowR = lowZoom ? r * 4.0 + 8 : r * 5.6 + 10;
        const ownerBoost = sys.owner ? 1 : (lowZoom ? 0.45 : 0.8);
        const gr = g.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, glowR);
        gr.addColorStop(0, SM.hexToRgba(color, (lowZoom ? 0.32 : 0.65) * alpha * ownerBoost));
        gr.addColorStop(0.3, SM.hexToRgba(color, (lowZoom ? 0.08 : 0.20) * alpha * ownerBoost));
        gr.addColorStop(1, SM.hexToRgba(color, 0));
        g.fillStyle = gr;
        g.fillRect(pos.x - glowR, pos.y - glowR, glowR * 2, glowR * 2);
        // 星体
        g.fillStyle = color;
        g.globalAlpha = alpha;
        g.beginPath();
        g.arc(pos.x, pos.y, r, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
        if (sys.star !== 'blackhole') {
          g.fillStyle = 'rgba(255,255,255,' + (0.55 * alpha) + ')';
          g.beginPath();
          g.arc(pos.x, pos.y, r * 0.42, 0, Math.PI * 2);
          g.fill();
        }
        if (sys.star === 'blackhole') {
          g.fillStyle = '#03050b';
          g.beginPath();
          g.arc(pos.x, pos.y, r * 0.8, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = SM.hexToRgba(color, 0.8);
          g.lineWidth = 1;
          g.beginPath();
          g.arc(pos.x, pos.y, r + 3, 0, Math.PI * 2);
          g.stroke();
        }
        // 领土环
        if (sys.owner) {
          const oe = UI.game.empire(sys.owner);
          if (oe) {
            g.strokeStyle = SM.hexToRgba(oe.color, 0.95);
            g.lineWidth = 2;
            g.beginPath();
            g.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
            g.stroke();
            if (sys.colonyId) {
              g.strokeStyle = SM.hexToRgba(oe.color, 0.45);
              g.lineWidth = 1.3;
              g.beginPath();
              g.arc(pos.x, pos.y, r + 10, 0, Math.PI * 2);
              g.stroke();
            }
          }
        }
        // 首都标识
        if (sys.id === capSysId) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 520);
          const cg2 = g.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, (r + 18) * 3.2);
          cg2.addColorStop(0, 'rgba(255,209,102,' + (0.16 + pulse * 0.10) + ')');
          cg2.addColorStop(1, 'rgba(255,209,102,0)');
          g.fillStyle = cg2;
          g.fillRect(pos.x - (r + 18) * 3.2, pos.y - (r + 18) * 3.2, (r + 18) * 6.4, (r + 18) * 6.4);
          g.save();
          g.strokeStyle = 'rgba(255,209,102,' + (0.55 + pulse * 0.35) + ')';
          g.lineWidth = 1.7;
          g.setLineDash([4, 4]);
          g.beginPath();
          g.arc(pos.x, pos.y, r + 15, 0, Math.PI * 2);
          g.stroke();
          g.setLineDash([]);
          g.restore();
        }
        // 殖民地标识（所有己方殖民地都可见；敌方需已调查或处于战争）
        const colony = sys.colonyId ? UI.game.colony(sys.colonyId) : null;
        const colonyOwner = colony ? UI.game.empire(colony.owner) : null;
        const occupier = colony && colony.occupiedBy ? UI.game.empire(colony.occupiedBy) : null;
        const occupiedByEnemy = !!(occupier && player && occupier.id !== player.id);
        const occupiedByPlayer = !!(occupier && player && occupier.id === player.id);
        const colonyWar = !!(colony && player && colony.owner !== player.id && UI.game.isAtWar(player.id, colony.owner));
        if (colony && (colony.owner === player.id || known || colonyWar || occupiedByEnemy || occupiedByPlayer)) {
          const bx = pos.x + Math.cos(-0.7) * (r + 13);
          const by = pos.y + Math.sin(-0.7) * (r + 13);
          if (colonyWar || occupiedByEnemy) {
            g.save();
            g.strokeStyle = 'rgba(255,107,107,' + (0.65 + 0.25 * Math.sin(now / 380)) + ')';
            g.lineWidth = 1.6;
            g.setLineDash([4, 4]);
            g.beginPath();
            g.arc(pos.x, pos.y, r + 19, 0, Math.PI * 2);
            g.stroke();
            g.setLineDash([]);
            g.restore();
          } else if (occupiedByPlayer) {
            g.save();
            g.strokeStyle = SM.hexToRgba(player.color, 0.85);
            g.lineWidth = 1.6;
            g.setLineDash([3, 3]);
            g.beginPath();
            g.arc(pos.x, pos.y, r + 19, 0, Math.PI * 2);
            g.stroke();
            g.setLineDash([]);
            g.restore();
          }
          g.save();
          g.translate(bx, by);
          g.rotate(Math.PI / 4);
          g.fillStyle = (occupier || colonyOwner) ? (occupier || colonyOwner).color : '#ffffff';
          g.fillRect(-3.2, -3.2, 6.4, 6.4);
          g.strokeStyle = occupiedByEnemy ? '#ff6b6b' : (colony.owner === player.id ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.55)');
          g.lineWidth = 1.2;
          g.strokeRect(-3.2, -3.2, 6.4, 6.4);
          g.restore();
          if (occupiedByEnemy) {
            g.strokeStyle = '#ff6b6b';
            g.lineWidth = 1.4;
            g.beginPath();
            g.moveTo(bx - 4.5, by - 4.5);
            g.lineTo(bx + 4.5, by + 4.5);
            g.moveTo(bx + 4.5, by - 4.5);
            g.lineTo(bx - 4.5, by + 4.5);
            g.stroke();
          }
        } else if (known && sys.hostiles) {
          g.fillStyle = '#ff6b6b';
          g.beginPath();
          const hx = pos.x - Math.cos(0.7) * (r + 10);
          const hy = pos.y - Math.sin(0.7) * (r + 10);
          g.moveTo(hx, hy - 4);
          g.lineTo(hx + 4, hy + 3);
          g.lineTo(hx - 4, hy + 3);
          g.closePath();
          g.fill();
        }
        // 太空站
        if (known) {
          ['mining', 'research'].forEach(function (type, i) {
            const st = sys.stations[type];
            if (!st || !st.built) return;
            const ang = 2.5 + i * 0.7;
            const ox = pos.x + Math.cos(ang) * (r + 13);
            const oy = pos.y + Math.sin(ang) * (r + 13);
            g.fillStyle = type === 'mining' ? '#ffd166' : '#7cf5ff';
            g.fillRect(ox - 1.6, oy - 1.6, 3.2, 3.2);
          });
        }
        // 战斗标记
        if (sys.battle) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 180);
          g.strokeStyle = 'rgba(255,107,107,' + (0.35 + pulse * 0.4) + ')';
          g.lineWidth = 2;
          g.beginPath();
          g.arc(pos.x, pos.y, r + 13 + pulse * 4, 0, Math.PI * 2);
          g.stroke();
          g.fillStyle = '#ffb3b3';
          g.font = 'bold ' + Math.max(10, Math.min(14, z * 16)) + 'px "Microsoft YaHei", sans-serif';
          g.textAlign = 'center';
          g.fillText('战斗', pos.x, pos.y - r - 14);
        }
        // 选中 / 悬停环
        if (hoverSys === sys.id) {
          g.strokeStyle = 'rgba(220,240,255,0.5)';
          g.lineWidth = 1.2;
          g.beginPath();
          g.arc(pos.x, pos.y, r + 12, 0, Math.PI * 2);
          g.stroke();
        }
        if (UI.selected && (UI.selected.systemId === sys.id)) {
          g.save();
          g.translate(pos.x, pos.y);
          g.rotate(now / 2600);
          g.strokeStyle = 'rgba(120,235,255,0.9)';
          g.lineWidth = 1.5;
          g.setLineDash([6, 6]);
          g.beginPath();
          g.arc(0, 0, r + 16, 0, Math.PI * 2);
          g.stroke();
          g.setLineDash([]);
          g.restore();
        }
      }, this);

      // 舰队
      const hoverFleet = UI.hover && UI.hover.type === 'fleet' ? UI.hover.id : null;
      UI.game.state.fleets.forEach(function (f) {
        if (!f.ships.length) return;
        const pos = this.fleetScreenPos(f);
        if (pos.x < -40 || pos.x > w + 40 || pos.y < -40 || pos.y > h + 40) return;
        const oe = f.owner ? UI.game.empire(f.owner) : null;
        const isPlayer = f.owner === player.id;
        const color = oe ? oe.color : '#c77dff';
        let enemy = false;
        if (oe && f.owner !== player.id && UI.game.isAtWar(player.id, f.owner)) enemy = true;
        const size = (isPlayer ? 5.4 : 4.4) + (f.kind === 'combat' ? 0.8 : 0);
        let ang = -Math.PI / 2;
        if (f.travel) {
          const to = UI.game.system(f.travel.to);
          const from = UI.game.system(f.travel.from);
          if (to && from) ang = Math.atan2(to.y - from.y, to.x - from.x);
        } else if (pos.sys) {
          ang = Math.atan2(pos.y - pos.sys.y, pos.x - pos.sys.x);
        }
        g.save();
        g.translate(pos.x, pos.y);
        g.rotate(ang + Math.PI / 2);
        g.fillStyle = color;
        g.strokeStyle = enemy ? '#ff6b6b' : isPlayer ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.45)';
        g.lineWidth = enemy || isPlayer ? 1.3 : 0.8;
        if (f.kind === 'combat') {
          g.beginPath();
          g.moveTo(0, -size);
          g.lineTo(size * 0.8, size * 0.8);
          g.lineTo(0, size * 0.38);
          g.lineTo(-size * 0.8, size * 0.8);
          g.closePath();
          g.fill();
          g.stroke();
        } else {
          g.beginPath();
          g.rect(-size * 0.6, -size * 0.6, size * 1.2, size * 1.2);
          g.fill();
          g.stroke();
        }
        g.restore();
        if (hoverFleet === f.id) {
          g.strokeStyle = 'rgba(230,245,255,0.8)';
          g.lineWidth = 1.4;
          g.beginPath();
          g.arc(pos.x, pos.y, size + 5, 0, Math.PI * 2);
          g.stroke();
        }
        if (UI.selected && UI.selected.type === 'fleet' && UI.selected.id === f.id) {
          g.strokeStyle = 'rgba(120,235,255,0.95)';
          g.lineWidth = 1.5;
          g.beginPath();
          g.arc(pos.x, pos.y, size + 7, 0, Math.PI * 2);
          g.stroke();
        }
        if ((z > 0.48 || (UI.selected && UI.selected.type === 'fleet' && UI.selected.id === f.id)) && f.ships.length > 1) {
          g.fillStyle = 'rgba(220,235,255,0.85)';
          g.font = '9px "Microsoft YaHei", sans-serif';
          g.textAlign = 'center';
          g.fillText(String(f.ships.length), pos.x, pos.y + size + 8);
        }
      }, this);

      // 路线预览 / 选中航线
      if (UI.selected && UI.selected.type === 'fleet') {
        const f = UI.game.fleet(UI.selected.id);
        if (f && f.owner === player.id) {
          this.drawRoute(f);
          if (UI.hover && UI.hover.type === 'system' && UI.hover.id !== f.systemId) {
            this.drawPreview(f, UI.hover.id);
          }
        }
      }

      // 系统名称
      systems.forEach(function (sys) {
        const pos = this.systemPos(sys);
        const r = this.starRadius(sys);
        const known = !!sys.surveyed[player.id];
        const isCap = sys.id === capSysId;
        const important = isCap || sys.colonyId || sys.capitalOf || (UI.selected && UI.selected.systemId === sys.id) ||
          (UI.hover && UI.hover.type === 'system' && UI.hover.id === sys.id) ||
          (UI.selected && UI.selected.type === 'fleet' && UI.game.fleet(UI.selected.id) && UI.game.fleet(UI.selected.id).systemId === sys.id);
        if (z < 0.4 && !important) return;
        if (pos.x < -40 || pos.x > w + 40 || pos.y < -40 || pos.y > h + 40) return;
        const fs = z > 1.3 ? 12 : z > 0.8 ? 11 : 10;
        g.font = (important ? '600 ' : '') + fs + 'px "Microsoft YaHei", "Segoe UI", sans-serif';
        g.textAlign = 'center';
        g.fillStyle = known ? (important ? 'rgba(240,249,255,0.98)' : 'rgba(214,230,250,0.86)') : 'rgba(140,160,196,0.6)';
        g.shadowColor = 'rgba(0,0,0,0.95)';
        g.shadowBlur = 5;
        g.fillText(sys.name, pos.x, pos.y - r - 10);
        if (isCap) {
          g.font = 'bold 9px "Microsoft YaHei", "Segoe UI", sans-serif';
          g.fillStyle = '#ffd166';
          g.fillText('★ 首都', pos.x, pos.y - r - 24);
        }
        const capColony = sys.colonyId ? UI.game.colony(sys.colonyId) : null;
        if (capColony && z >= 0.3) {
          const capOccupier = capColony.occupiedBy ? UI.game.empire(capColony.occupiedBy) : null;
          const occupiedByEnemy = !!(capOccupier && capOccupier.id !== player.id);
          const occupiedByPlayer = !!(capOccupier && capOccupier.id === player.id);
          const warring = capColony.owner !== player.id && UI.game.isAtWar(player.id, capColony.owner);
          if (known || capColony.owner === player.id || warring || capOccupier) {
            g.font = '9px "Microsoft YaHei", "Segoe UI", sans-serif';
            g.fillStyle = occupiedByEnemy ? '#ff9b9b' : (occupiedByPlayer ? '#a8ffd2' : (warring ? '#ff9b9b' : (capColony.owner === player.id ? '#c9f6ff' : 'rgba(220,235,255,0.72)')));
            const suffix = occupiedByEnemy ? '（被占领）' : occupiedByPlayer ? '（已占领）' : '';
            g.fillText(capColony.name + suffix, pos.x, pos.y + r + 17);
          }
        }
        g.shadowBlur = 0;
      }, this);

      // 选中系统的行星轨迹装饰
    }
    drawRoute(f) {
      const g = this.ctx;
      const nodes = [];
      if (f.travel) {
        const to = UI.game.system(f.travel.to);
        if (to) nodes.push(to);
      }
      f.path.forEach(function (id) {
        const s = UI.game.system(id);
        if (s) nodes.push(s);
      });
      if (!nodes.length) return;
      const start = this.fleetScreenPos(f);
      const pts = [start].concat(nodes.map(function (s) { return UI.worldToScreen(s.x, s.y); }, this));
      g.save();
      g.strokeStyle = 'rgba(120,235,255,0.55)';
      g.lineWidth = 1.3;
      g.setLineDash([5, 5]);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
      g.setLineDash([]);
      const target = nodes[nodes.length - 1];
      const tp = UI.worldToScreen(target.x, target.y);
      g.strokeStyle = 'rgba(120,235,255,0.8)';
      g.lineWidth = 1.4;
      g.beginPath();
      g.arc(tp.x, tp.y, 15, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    drawPreview(f, targetId) {
      const g = this.ctx;
      const from = f.travel ? f.travel.to : f.systemId;
      const path = SM.Galaxy.path(UI.game.state.systems, from, targetId);
      if (!path || path.length < 2) return;
      const start = this.fleetScreenPos(f);
      const pts = [start].concat(path.slice(1).map(function (id) {
        const s = UI.game.system(id);
        return s ? UI.worldToScreen(s.x, s.y) : null;
      }).filter(Boolean));
      if (pts.length < 2) return;
      g.save();
      g.strokeStyle = 'rgba(255,209,102,0.6)';
      g.lineWidth = 1.1;
      g.setLineDash([3, 6]);
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
      g.stroke();
      g.setLineDash([]);
      const tp = pts[pts.length - 1];
      g.strokeStyle = 'rgba(255,209,102,0.85)';
      g.lineWidth = 1.2;
      g.beginPath();
      g.arc(tp.x, tp.y, 10, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
