/* =========================================================================
   永冬 · Frostfall —— 界面层
   ========================================================================= */
(function (root) {
  'use strict';
  const FW = root.FW;
  const $ = (id) => document.getElementById(id);

  const IC = {
    road: '路', hub: '汽', tent: '帐', house: '屋', cookhouse: '厨', hunter: '猎',
    sawmill: '木', coalmine: '煤', steelworks: '钢', medical: '医', workshop: '研'
  };
  const GROUPS = ['基建', '居住', '食物', '生产', '民生'];
  const RES_ORDER = ['coal', 'wood', 'steel', 'raw', 'meal'];

  const UI = root.UI = {
    game: null, r: null,
    sideSig: '', buildMode: null,
    toastKeys: {},
    modal: null
  };

  function num(n) { return Math.round(n).toLocaleString('en-US'); }
  function sgn(n, digits) {
    const v = digits ? n.toFixed(digits) : Math.round(n);
    return (n > 0 ? '+' : '') + v;
  }
  function tempColor(t) { return FW.tempBand(t).color; }

  /* ============================== 初始化 ============================== */
  UI.init = function (game, renderer) {
    UI.game = game;
    UI.r = renderer;
    UI.sideSig = '';
    UI.buildMode = null;
    renderer.buildMode = null;
    $('toasts').innerHTML = '';
    buildPalette();
    buildSideShell();
    bindStatic();
    UI.lastModalCheck = 0;
  };

  function bindStatic() {
    if (UI.staticBound) return;
    UI.staticBound = true;
    const sp = $('speedBox');
    sp.onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      setSpeed(Number(b.dataset.speed));
    };
    $('btnTech').onclick = () => openTech();
    $('btnLog').onclick = () => openLog();
    $('btnHelp').onclick = () => openHelp();
    $('btnHome').onclick = () => UI.r.center();
    $('btnZoomIn').onclick = () => UI.r.zoomAt(UI.r.w / 2, UI.r.h / 2, 1.25);
    $('btnZoomOut').onclick = () => UI.r.zoomAt(UI.r.w / 2, UI.r.h / 2, 0.8);

    $('palette').addEventListener('click', (e) => {
      const it = e.target.closest('.pitem');
      if (!it) return;
      const type = it.dataset.type;
      const def = FW.BLD[type];
      if (def.tech && !UI.game.hasTech(def.tech)) { toast('需要先研究「' + FW.TECHS[def.tech].name + '」', 'warn'); return; }
      setBuildMode(UI.buildMode === type ? null : type);
    });
    $('palette').addEventListener('mousemove', (e) => {
      const it = e.target.closest('.pitem');
      if (!it) { hideTip(); return; }
      showTip(e, it.dataset.type);
    });
    $('palette').addEventListener('mouseleave', hideTip);

    $('side').addEventListener('click', onSideClick);
    $('side').addEventListener('mousemove', (e) => {
      const b = e.target.closest('[data-tip]');
      if (!b) { hideTip(); return; }
      showRawTip(e, b.dataset.tip);
    });
    $('side').addEventListener('mouseleave', hideTip);

    $('modalRoot').addEventListener('click', onModalClick);
  }

  UI.setGame = function (game, renderer) { UI.game = game; UI.r = renderer; };
  UI.bindGame = function (game, renderer) { UI.game = game; UI.r = renderer; UI.init(game, renderer); };

  function setSpeed(v) {
    const S = UI.game.state;
    S.speed = v;
    S.paused = v === 0;
    S.lastSpeed = v || S.lastSpeed || 1;
    updateSpeedBtns();
  }
  UI.setSpeed = setSpeed;
  function updateSpeedBtns() {
    const S = UI.game.state;
    for (const b of $('speedBox').children) b.classList.toggle('on', Number(b.dataset.speed) === S.speed);
  }
  UI.updateSpeedBtns = updateSpeedBtns;

  /* ============================== 建造栏 ============================== */
  function buildPalette() {
    const box = $('palette');
    const g = UI.game;
    let html = '';
    for (const grp of GROUPS) {
      const items = FW.BLD_ORDER.filter((t) => FW.BLD[t].group === grp);
      if (!items.length) continue;
      html += '<div class="pgroup-t">' + grp + '</div>';
      for (const type of items) {
        const d = FW.BLD[type];
        const locked = d.tech && !g.hasTech(d.tech);
        html += '<div class="pitem' + (locked ? ' locked' : '') + '" data-type="' + type + '">' +
          '<div class="p-ic">' + IC[type] + '</div>' +
          '<div><div class="p-name">' + d.name + '</div>' +
          '<div class="pcost">' + costHTML(d.cost) + '</div></div>' +
          (locked ? '<div class="p-lock">未解锁</div>' : '') +
          '</div>';
      }
    }
    box.innerHTML = html;
    UI.paletteNodes = {};
    for (const n of box.querySelectorAll('.pitem')) UI.paletteNodes[n.dataset.type] = n;
  }
  UI.buildPalette = buildPalette;

  function costHTML(cost) {
    if (!cost) return '<span style="color:#4f8">免费</span>';
    let s = '';
    for (const k in cost) s += '<span>' + FW.RES[k].short + Math.round(cost[k]) + '</span>';
    return s || '<span style="color:#4f8">免费</span>';
  }

  function setBuildMode(type) {
    UI.buildMode = type;
    UI.r.buildMode = type;
    for (const k in UI.paletteNodes) UI.paletteNodes[k].classList.toggle('on', k === type);
    if (type) {
      banner('建造 · ' + FW.BLD[type].name + '　左键放置，右键 / Esc 取消');
    } else {
      hideBanner();
    }
    UI.sideSig = '';
  }
  UI.setBuildMode = setBuildMode;

  function banner(txt) {
    const b = $('banner');
    b.textContent = txt;
    b.hidden = false;
  }
  function hideBanner() { $('banner').hidden = true; }
  UI.banner = banner;

  /* ============================== 提示 ============================== */
  let tipTimer = 0;
  function showTip(e, type) {
    const d = FW.BLD[type];
    const g = UI.game;
    const locked = d.tech && !g.hasTech(d.tech);
    let extra = '';
    if (d.slots) extra += '<br>岗位 ' + d.slots + ' 人';
    if (d.housing) extra += '<br>床位 ' + d.housing;
    if (d.produce) extra += '<br>产出 ' + Object.keys(d.produce).map((k) => FW.RES[k].short + ' ' + (d.produce[k] * 24).toFixed(0) + '/天').join('，');
    if (locked) extra += '<br><span style="color:#ffb15e">需要科技：' + FW.TECHS[d.tech].name + '</span>';
    const tip = $('tooltip');
    tip.innerHTML = '<b>' + d.name + '</b>' + d.desc + extra;
    tip.hidden = false;
    positionTip(e);
  }
  function showRawTip(e, html) {
    const tip = $('tooltip');
    tip.innerHTML = html;
    tip.hidden = false;
    positionTip(e);
  }
  function positionTip(e) {
    const tip = $('tooltip');
    const pad = 14;
    let x = e.clientX + pad, y = e.clientY + pad;
    const rect = tip.getBoundingClientRect();
    if (x + rect.width > root.innerWidth - 8) x = e.clientX - rect.width - pad;
    if (y + rect.height > root.innerHeight - 8) y = e.clientY - rect.height - pad;
    tip.style.left = x + 'px';
    tip.style.top = y + 'px';
  }
  function hideTip() { $('tooltip').hidden = true; }

  /* ============================== 顶栏 ============================== */
  function buildTopbar() {
    let html = '';
    for (const k of RES_ORDER) {
      const r = FW.RES[k];
      html += '<div class="res-chip" data-res="' + k + '"><i style="color:' + r.color + '">' + r.icon + '</i>' +
        '<span class="v">0</span><span class="r"></span></div>';
    }
    $('resBar').innerHTML = html;
    UI.resNodes = {};
    for (const n of $('resBar').querySelectorAll('.res-chip')) UI.resNodes[n.dataset.res] = n;
  }
  UI.buildTopbar = buildTopbar;

  UI.tick = function () {
    const g = UI.game;
    if (!g) return;
    const S = g.state;
    const st = g.stats();

    // 天气
    $('wTemp').textContent = st.temp;
    $('wTemp').style.color = tempColor(st.temp);
    $('wLabel').textContent = st.label + (S.storm && st.label.indexOf('风暴') < 0 ? ' · 风暴' : '');
    const heat = g.state.mods.heater + g.state.mods.insul;
    $('wHeat').textContent = '供热 +' + (st.genLevel * 15 + heat) + '°C';
    $('wBar').style.width = Math.max(2, Math.min(100, ((st.temp + 80) / 80) * 100)) + '%';

    // 资源
    for (const k of RES_ORDER) {
      const n = UI.resNodes && UI.resNodes[k];
      if (!n) continue;
      n.querySelector('.v').textContent = num(S.res[k]);
      const tr = (S.trend && S.trend[k]) || 0;
      const rn = n.querySelector('.r');
      rn.textContent = Math.abs(tr) >= 0.5 ? sgn(tr, 0) + '/h' : '';
      rn.style.color = tr > 0.4 ? '#7ce0a8' : tr < -0.4 ? '#ff9b9b' : '';
      const burn = g.burnRate();
      const low = (k === 'coal' && S.res.coal < Math.max(10, burn * 4)) || (k === 'meal' && S.res.meal < S.pop * 1.6);
      n.classList.toggle('warn', low);
    }

    // 人口
    $('popNum').textContent = Math.round(S.pop);
    const sick = Math.round(S.sick);
    $('popSick').textContent = '病 ' + sick;
    $('popSick').className = sick > S.pop * 0.15 ? 'bad' : '';
    $('popFree').textContent = '闲 ' + Math.round(S.freeWorkers || 0);

    // 情绪
    $('hopeBar').style.width = Math.max(0, Math.min(100, S.hope)) + '%';
    $('hopeVal').textContent = Math.round(S.hope);
    $('disBar').style.width = Math.max(0, Math.min(100, S.discontent)) + '%';
    $('disVal').textContent = Math.round(S.discontent);
    $('hopeVal').style.color = S.hope < 25 ? '#ff9b9b' : '';
    $('disVal').style.color = S.discontent > 70 ? '#ff9b9b' : '';

    // 时钟
    $('clockDay').textContent = '第 ' + S.day + ' 天';
    const hh = String(Math.floor(S.hour)).padStart(2, '0');
    $('clockTime').textContent = hh + ':00';
    if (S.day !== UI.lastDay) { UI.lastDay = S.day; updateSpeedBtns(); }
    const nw = nextWeather(S.day);
    $('clockNext').textContent = nw ? '→ 第' + nw.day + '天 ' + nw.temp + '°' : '';

    $('rpBadge').textContent = Math.floor(S.rp);

    // 建造栏可负担状态
    for (const type in UI.paletteNodes || {}) {
      const n = UI.paletteNodes[type];
      const d = FW.BLD[type];
      const locked = d.tech && !g.hasTech(d.tech);
      n.classList.toggle('locked', !!locked);
      n.classList.toggle('poor', !locked && !g.canAfford(d.cost));
      if (locked && !n.querySelector('.p-lock')) {
        const s = document.createElement('div'); s.className = 'p-lock'; s.textContent = '未解锁'; n.appendChild(s);
      } else if (!locked) {
        const s = n.querySelector('.p-lock'); if (s) s.remove();
      }
    }

    updateSide();
    pushToasts();
  };

  function nextWeather(day) {
    for (const seg of FW.WEATHER) if (seg.day > day) return seg;
    return null;
  }

  /* ============================== 右侧面板 ============================== */
  function buildSideShell() {
    $('side').innerHTML = '<div class="card" id="goalCard"></div><div class="card" id="genCard"></div><div id="sideSlot"></div>';
  }

  function goalList(g) {
    const S = g.state;
    const c = (t) => S.buildings.filter((b) => b.type === t).length;
    return [
      { t: '建成煤矿（煤脉上）', done: c('coalmine') > 0 },
      { t: '建成锯木厂（树林上）', done: c('sawmill') > 0 },
      { t: '伙房 + 猎人小屋', done: c('cookhouse') > 0 && c('hunter') > 0 },
      { t: '建成工坊，开始研究', done: c('workshop') > 0 },
      { t: '发电机升到 2 档', done: S.gen.level >= 2 },
      { t: '建成医疗站', done: c('medical') > 0 },
      { t: '熬过第 7 天（-40°C）', done: S.day >= 7 },
      { t: '熬过第 16 天（-55°C）', done: S.day >= 16 },
      { t: '熬过大风暴（第 23 天）', done: S.day >= 23 }
    ];
  }

  function goalsHTML(g) {
    const list = goalList(g);
    const done = list.filter((x) => x.done).length;
    const next = list.filter((x) => !x.done).slice(0, 3);
    let rows = '';
    if (!next.length) rows = '<div class="goal done">✓ 所有目标完成</div>';
    else for (const x of next) rows += '<div class="goal"><i>○</i>' + x.t + '</div>';
    if (done) {
      for (const x of list.filter((y) => y.done).slice(-2)) rows += '<div class="goal done"><i>✓</i>' + x.t + '</div>';
    }
    return '<div class="card-h"><b>目标</b><span>' + done + '/' + list.length + '</span></div>' + rows;
  }

  function sig() {
    const g = UI.game, S = g.state, sel = UI.r.selected;
    return [
      sel ? sel.r + ',' + sel.s : '-',
      S.gen.level, S.genCap, S.gen.on, S.gen.overdrive, S.gen.broken > 0,
      Object.keys(S.techs).length, S.buildings.length, S.mods.range,
      UI.buildMode || '', Math.round(S.freeWorkers || 0), S.day
    ].join('|');
  }

  function updateSide() {
    const s = sig();
    if (s !== UI.sideSig) { UI.sideSig = s; renderSide(); }
    refreshLive();
  }

  function refreshLive() {
    const g = UI.game, S = g.state;
    // 发电机卡片里的活数值
    const st = g.stats();
    setLive('genTemp', '+' + (g.effLevel() * 15) + '°C');
    setLive('genCoal', '-' + st.coalRate.toFixed(1) + '/h');
    setLive('genStressBar', null, 'width', Math.round(S.gen.stress) + '%');
    setLive('genStressTxt', Math.round(S.gen.stress) + '%');
    setLive('genStateTxt', S.gen.broken > 0 ? '损坏' : !S.gen.on ? '停机' : S.gen.overdrive ? '过载中' : '运转');
    const sel = UI.r.selected;
    if (sel && sel.sel) {
      const t = g.tile(sel.r, sel.s);
      if (t && t.bld) {
        const def = FW.BLD[t.bld.type];
        const tmp = g.tempOf(t);
        setLive('selTemp', Math.round(tmp) + '°C', 'color', tempColor(tmp));
        setLive('selTempLbl', FW.tempBand(tmp).label);
        if (def.slots) setLive('selWork', t.bld.workers + '/' + def.slots);
        if (def.kind === 'work' && def.produce) {
          const key = Object.keys(def.produce)[0];
          const rate = g.rateOf(t.bld, key) * 24;
          setLive('selOut', (rate > 0 ? rate.toFixed(0) : '0') + ' /天');
        }
      }
    }
    const ov = $('btnOverdrive');
    if (ov) {
      ov.classList.toggle('on', S.gen.overdrive);
      ov.textContent = S.gen.overdrive ? '停止过载' : '过载';
    }
    const go = $('btnGenOff');
    if (go) {
      go.classList.toggle('on', !S.gen.on);
      go.textContent = S.gen.on ? '停机' : '启动';
    }
    // 概览活数值
    const H = g.housing();
    setLive('ovHome', H.homes.length + ' 座');
    setLive('ovCap', Math.round(H.cap) + ' 床');
    setLive('ovWarm', Math.round(H.warm), 'color', H.warm > 0 ? '#ffb15e' : '');
    setLive('ovCold', Math.round(H.cold), 'color', H.cold > 0 ? '#8fdcff' : '');
    setLive('ovHome2', Math.round(H.homeless), 'color', H.homeless > 0 ? '#ff9b9b' : '');
    setLive('ovRpH', (g.rpRate() * 24).toFixed(0) + ' /天');
  }
  function setLive(id, txt, prop, val) {
    const n = document.getElementById(id);
    if (!n) return;
    if (txt != null && n.textContent !== txt) n.textContent = txt;
    if (prop) n.style[prop] = val;
  }

  function renderSide() {
    const g = UI.game, S = g.state;
    $('goalCard').innerHTML = goalsHTML(g);
    // ---- 发电机 ----
    const lvl = S.gen.level, cap = S.genCap;
    let pips = '';
    for (let i = 1; i <= 4; i++) {
      const lock = i > cap;
      pips += '<div class="pip' + (i <= lvl ? ' on' : '') + (lock ? ' lock' : '') + '" data-act="gen-level" data-lvl="' + i + '">' + i + '</div>';
    }
    const burnArr = FW.COAL_BURN;
    const genHtml =
      '<div class="card-h"><b>发电机</b><span id="genStateTxt">运转</span></div>' +
      '<div class="gen-head"><div>' +
      '<div class="gen-temp" id="genTemp">+' + (g.effLevel() * 15) + '°C</div>' +
      '<div class="hintline">供热增量 · 范围 <b>' + S.mods.range + '</b> 环 · 每档 +15°C</div>' +
      '</div><div style="text-align:right">' +
      '<div class="row" style="padding:0;justify-content:flex-end"><span class="v" id="genCoal">-' + g.stats().coalRate.toFixed(1) + '/h</span></div>' +
      '<div class="hintline">煤炭消耗</div></div></div>' +
      '<div class="gen-lvl">' + pips + '</div>' +
      '<div class="row" style="padding:2px 0 0"><span class="k">过载压力</span><span class="v" id="genStressTxt">0%</span></div>' +
      '<div class="stress"><i id="genStressBar" style="width:0%"></i></div>' +
      '<div class="btn-row">' +
      '<button class="btn warn" id="btnOverdrive" data-act="overdrive">过载</button>' +
      '<button class="btn" id="btnGenOff" data-act="genoff">停机</button>' +
      '</div>' +
      '<div class="hintline">过载：全部建筑 +15°C，煤炭消耗 ×1.6，压力满 100% 会炸炉停机。</div>' +
      (cap < 4 ? '<div class="hintline">档位上限 ' + cap + '：研究「发电机出力」可提升。</div>' : '');
    $('genCard').innerHTML = genHtml;

    // ---- 选中 / 概览 ----
    $('sideSlot').innerHTML = sideSlotHTML();
  }

  function sideSlotHTML() {
    const g = UI.game, S = g.state;
    const sel = UI.r.selected;
    if (!sel) return overviewHTML();
    const t = g.tile(sel.r, sel.s);
    if (!t) return overviewHTML();
    if (t.kind === 'road') {
      return '<div class="card"><div class="card-h"><b>道路</b><span>第 ' + t.r + ' 环</span></div>' +
        '<div class="hintline">道路把建筑接入城市管网。热量沿连通的城市输送。</div>' +
        '<div class="btn-row"><button class="btn danger" data-act="demolish" data-r="' + t.r + '" data-s="' + t.s + '">拆除</button></div></div>';
    }
    if (t.kind) return buildingHTML(g, t);

    // 空地
    const conn = g.isConnected(t);
    const feat = t.feat;
    let head = '<div class="card-h"><b>空地</b><span>第 ' + t.r + ' 环 · ' + t.s + ' 区</span></div>';
    if (feat) head += '<div class="hintline" style="margin-top:-4px">地貌：<b style="color:#9fd7b6">' + FW.featName(feat) + '</b>（只能建对应的采集建筑）</div>';
    if (!conn) {
      head += '<div class="hintline" style="color:#ffb15e">这块地还没有接入城市管网。</div>' +
        '<div class="btn-row"><button class="btn warm" data-act="autoroad" data-r="' + t.r + '" data-s="' + t.s + '">自动接通道路</button></div>';
    }
    const avail = FW.BLD_ORDER.filter((type) => {
      const d = FW.BLD[type];
      if (type === 'road' || d.kind === 'road') return false;
      if (d.tech && !g.hasTech(d.tech)) return false;
      if (d.need) return feat === d.need;
      return !feat;
    });
    let body = '<div class="quick">';
    for (const type of avail) {
      const d = FW.BLD[type];
      const ok = conn && g.canAfford(d.cost);
      body += '<button data-act="build" data-type="' + type + '" data-r="' + t.r + '" data-s="' + t.s + '"' +
        (ok ? '' : ' style="opacity:.45"') + ' title="' + d.desc.replace(/"/g, '') + '">' +
        '<span class="ic">' + IC[type] + '</span>' + d.name +
        '<span class="c">' + (d.cost.wood ? '木' + d.cost.wood : '') + (d.cost.steel ? ' 钢' + d.cost.steel : '') + '</span></button>';
    }
    body += '</div>';
    if (!avail.length) body = '<div class="hintline">这里没有可建的东西。</div>';
    if (!conn) body += '<div class="btn-row"><button class="btn" data-act="build" data-type="road" data-r="' + t.r + '" data-s="' + t.s + '">在这里修一段路</button></div>';
    return '<div class="card">' + head + body + '</div>';
  }

  function buildingHTML(g, t) {
    const b = t.bld, d = FW.BLD[b.type];
    const tmp = g.tempOf(t);
    const conn = g.isConnected(t);
    const heated = g.isHeated(t);
    let rows = '';
    rows += '<div class="row"><span class="k">温度</span><span class="v" id="selTemp" style="color:' + tempColor(tmp) + '">' + Math.round(tmp) + '°C</span></div>';
    const band = FW.tempBand(tmp);
    rows += '<div class="row"><span class="k">体感</span><span class="v" id="selTempLbl" style="color:' + band.color + '">' + band.label + '</span></div>';
    if (d.slots) {
      rows += '<div class="row"><span class="k">职工</span><span class="v" id="selWork">' + b.workers + '/' + d.slots + '</span></div>';
      if (d.produce) {
        const key = Object.keys(d.produce)[0];
        const rate = g.rateOf(b, key) * 24;
        rows += '<div class="row"><span class="k">' + FW.RES[key].name + '产出</span><span class="v" id="selOut">' + (rate > 0 ? rate.toFixed(0) : 0) + ' /天</span></div>';
      }
      if (d.type !== 'road' && d.job === 'lab') rows += '<div class="row"><span class="k">研究点</span><span class="v">' + (g.rpRate() * 24).toFixed(0) + ' /天</span></div>';
      if (d.job === 'medic') rows += '<div class="row"><span class="k">治疗能力</span><span class="v">' + (g.treatRate()).toFixed(2) + ' /时</span></div>';
      if (d.cook) rows += '<div class="row"><span class="k">餐食产出</span><span class="v">' + ((d.cook.per * (b.workers / d.slots)) * d.cook.ratio * 24).toFixed(0) + ' /天</span></div>';
    }
    if (d.housing) rows += '<div class="row"><span class="k">床位</span><span class="v">' + d.housing + '</span></div>';
    if (d.burn) rows += '<div class="row"><span class="k">煤炭消耗</span><span class="v">-' + d.burn + ' /时</span></div>';
    if (b.type === 'hub') rows += '<div class="row"><span class="k">覆盖</span><span class="v">相邻 3 环 × 3 区</span></div>';
    if (!conn) rows += '<div class="row"><span class="k">管网</span><span class="v bad">未接通</span></div>';
    else if (!heated && (d.heat || tmp < -10)) rows += '<div class="row"><span class="k">供暖</span><span class="v bad">无</span></div>';
    else if (heated) rows += '<div class="row"><span class="k">供暖</span><span class="v ok">已接入</span></div>';

    let btns = '';
    if (d.slots) {
      btns += '<button class="btn ' + (b.enabled ? 'on' : '') + '" data-act="toggle" data-r="' + t.r + '" data-s="' + t.s + '">' +
        (b.enabled ? '正在运作' : '已停工') + '</button>';
    }
    if (b.type === 'tent' && g.hasTech('house')) {
      btns += '<button class="btn warm" data-act="upgrade" data-r="' + t.r + '" data-s="' + t.s + '">升级房屋 · 木14 钢12</button>';
    }
    btns += '<button class="btn danger" data-act="demolish" data-r="' + t.r + '" data-s="' + t.s + '">拆除</button>';

    return '<div class="card">' +
      '<div class="card-h"><b>' + d.name + '</b><span>第 ' + t.r + ' 环</span></div>' +
      '<div class="big-title"><span class="ic">' + IC[b.type] + '</span>' + d.name + '</div>' +
      '<div class="hintline" style="margin-bottom:8px">' + d.desc + '</div>' +
      rows + '<div class="btn-row" style="flex-wrap:wrap">' + btns + '</div></div>';
  }

  function overviewHTML() {
    const g = UI.game, S = g.state;
    const H = g.housing();
    const coalDays = g.stats().coalRate > 0 ? S.res.coal / (g.stats().coalRate * 24) : 99;
    return '<div class="card">' +
      '<div class="card-h"><b>城市概览</b><span>第 ' + S.day + ' 天</span></div>' +
      '<div class="kv-grid">' +
      '<div class="kv"><div class="k">住房</div><div class="v" id="ovHome">' + H.homes.length + ' 座</div></div>' +
      '<div class="kv"><div class="k">床位</div><div class="v" id="ovCap">' + Math.round(H.cap) + ' 床</div></div>' +
      '<div class="kv"><div class="k">温暖</div><div class="v" id="ovWarm" style="color:' + (H.warm > 0 ? '#ffb15e' : '') + '">' + Math.round(H.warm) + '</div></div>' +
      '<div class="kv"><div class="k">受冻</div><div class="v" id="ovCold" style="color:' + (H.cold > 0 ? '#8fdcff' : '') + '">' + Math.round(H.cold) + '</div></div>' +
      '<div class="kv"><div class="k">露宿街头</div><div class="v" id="ovHome2" style="color:' + (H.homeless > 0 ? '#ff9b9b' : '') + '">' + Math.round(H.homeless) + '</div></div>' +
      '<div class="kv"><div class="k">煤炭可撑</div><div class="v" style="color:' + (coalDays < 2 ? '#ff9b9b' : coalDays < 4 ? '#ffb15e' : '') + '">' + (coalDays > 60 ? '∞' : coalDays.toFixed(1) + ' 天') + '</div></div>' +
      '</div>' +
      '<div class="hr"></div>' +
      (S.day < 20
        ? '<div class="row"><span class="k">距离大风暴</span><span class="v" style="color:' + (20 - S.day <= 4 ? '#ff9b9b' : '') + '">' + (20 - S.day) + ' 天</span></div>'
        : '<div class="row"><span class="k">大风暴</span><span class="v bad">正在肆虐</span></div>') +
      '<div class="row"><span class="k">研究点产出</span><span class="v" id="ovRpH">' + (g.rpRate() * 24).toFixed(0) + ' /天</span></div>' +
      '<div class="row"><span class="k">建筑总数</span><span class="v">' + S.buildings.length + '</span></div>' +
      '<div class="row"><span class="k">空闲工人</span><span class="v">' + Math.round(S.freeWorkers || 0) + '</span></div>' +
      '<div class="hr"></div>' +
      '<div class="hintline">点地图上的地块查看详情。空地上会列出可建造的建筑。</div>' +
      '</div>';
  }

  /* ============================== 侧栏点击 ============================== */
  function onSideClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const g = UI.game;
    const act = b.dataset.act;
    const r = Number(b.dataset.r), s = Number(b.dataset.s);
    if (act === 'gen-level') {
      const lvl = Number(b.dataset.lvl);
      if (lvl > g.state.genCap) { toast('需要研究「发电机出力」才能升到 ' + lvl + ' 档', 'warn'); return; }
      g.setGenLevel(lvl);
      UI.sideSig = '';
    } else if (act === 'overdrive') {
      const on = !g.state.gen.overdrive;
      if (g.state.gen.broken > 0) { toast('发电机正在抢修', 'warn'); return; }
      g.setOverdrive(on);
      if (on) toast('过载启动，注意压力', 'warn');
      UI.sideSig = '';
    } else if (act === 'genoff') {
      g.state.gen.on = !g.state.gen.on;
      g.state.gen.autoOff = false;
      if (!g.state.gen.on) { g.state.gen.overdrive = false; toast('发电机已停机，城市开始失温', 'bad'); }
      UI.sideSig = '';
    } else if (act === 'build') {
      const type = b.dataset.type;
      const res = g.build(type, r, s);
      if (!res.ok) toast(res.why, 'bad');
      UI.sideSig = '';
      UI.r.selected = { r, s, sel: true };
    } else if (act === 'autoroad') {
      const res = g.autoRoad(r, s);
      if (!res.ok) toast(res.why, 'bad');
      UI.sideSig = '';
    } else if (act === 'demolish') {
      g.demolish(r, s);
      UI.r.selected = null;
      UI.sideSig = '';
    } else if (act === 'toggle') {
      const t = g.tile(r, s);
      if (t && t.bld) { t.bld.enabled = !t.bld.enabled; g.assignWorkers(); toast(FW.BLD[t.bld.type].name + (t.bld.enabled ? ' 复工' : ' 停工'), ''); }
      UI.sideSig = '';
    } else if (act === 'upgrade') {
      const res = g.upgrade(r, s);
      if (!res.ok) toast(res.why, 'bad');
      UI.sideSig = '';
    }
  }

  /* ============================== 地图交互 ============================== */
  UI.onTileClick = function (r, s, shift) {
    const g = UI.game;
    if (UI.buildMode && UI.buildMode !== 'select') {
      const type = UI.buildMode;
      const res = g.build(type, r, s);
      if (!res.ok) {
        toast(res.why, 'bad');
        if (res.why === '未接入城市管网') {
          setBuildMode(null);
          UI.r.selected = { r, s, sel: true };
        }
      }
      UI.sideSig = '';
      return;
    }
    UI.r.selected = { r, s, sel: true };
    UI.sideSig = '';
  };
  UI.onEmptyClick = function () {
    if (UI.buildMode) { setBuildMode(null); return; }
    UI.r.selected = null;
    UI.sideSig = '';
  };

  /* ============================== 弹窗 ============================== */
  function openModal(html, opts) {
    const mr = $('modalRoot');
    mr.innerHTML = '<div class="backdrop">' + html + '</div>';
    mr.classList.add('on');
    UI.modal = (opts && opts.kind) || 'generic';
    const S = UI.game && UI.game.state;
    if (S && UI.preModalSpeed == null) UI.preModalSpeed = S.speed;
    if (S) setSpeed(0);
  }
  function closeModal() {
    const mr = $('modalRoot');
    mr.innerHTML = '';
    mr.classList.remove('on');
    UI.modal = null;
    UI.modalBlocking = false;
    if (UI.preModalSpeed != null) {
      const v = UI.preModalSpeed;
      UI.preModalSpeed = null;
      setSpeed(v);
    }
    if (UI.game && UI.game.state.queue.length) setTimeout(() => UI.showEvent(), 120);
  }
  UI.closeModal = closeModal;
  UI.openModal = openModal;

  function onModalClick(e) {
    const b = e.target.closest('[data-mact]');
    if (!b) {
      if (e.target.classList.contains('backdrop') && !UI.modalBlocking) closeModal();
      return;
    }
    const act = b.dataset.mact;
    if (act === 'close') { closeModal(); return; }
    if (act === 'tech') {
      const id = b.dataset.id;
      const res = UI.game.research(id);
      if (!res.ok) toast(res.why, 'bad');
      else { toast('研究完成：' + FW.TECHS[id].name, 'tech'); buildPalette(); UI.sideSig = ''; }
      openTech();
      return;
    }
    if (act === 'choice') {
      const idx = Number(b.dataset.idx);
      const g = UI.game;
      g.resolveEvent(idx);
      closeModal();
      UI.sideSig = '';
      return;
    }
    if (act === 'restart') {
      closeModal();
      root.FW.restart();
      return;
    }
  }

  UI.showEvent = function () {
    const g = UI.game;
    const ev = g.state.queue[0];
    if (!ev) return;
    let ch = '';
    ev.choices.forEach((c, i) => {
      ch += '<button class="choice" data-mact="choice" data-idx="' + i + '">' +
        '<div class="c-label">' + c.label + '</div>' +
        (c.hint ? '<div class="c-hint">' + c.hint + '</div>' : '') + '</button>';
    });
    openModal('<div class="modal event">' +
      '<div class="ev-ic">' + (ev.icon || '◈') + '</div>' +
      '<h3>' + ev.title + '</h3>' +
      '<p class="ev-text">' + ev.text + '</p>' +
      '<div class="choices">' + ch + '</div></div>', { kind: 'event' });
    UI.modalBlocking = true;
  };

  UI.openTech = openTech;
  function openTech() {
    const g = UI.game, S = g.state;
    let cards = '';
    for (const id of FW.TECH_ORDER) {
      const t = FW.TECHS[id];
      const done = g.hasTech(id);
      const c = g.canResearch(id);
      cards += '<button class="tech' + (done ? ' done' : '') + (c.ok ? '' : ' cant') + '"' +
        (c.ok ? ' data-mact="tech" data-id="' + id + '"' : '') + '>' +
        '<div class="t-name"><span>' + t.name + '</span><span class="t-cost">' + (done ? '✓' : t.cost + ' RP') + '</span></div>' +
        '<div class="t-desc">' + t.desc + '</div>' +
        '<div class="t-tag">' + t.group +
        (t.req ? ' · 前置：' + t.req.map((q) => FW.TECHS[q].name).join('、') : '') +
        (c.ok || done ? '' : ' · ' + (c.why.indexOf('需要前置') === 0 ? '待前置' : c.why)) + '</div></button>';
    }
    const rpDay = g.rpRate() * 24;
    openModal('<div class="modal">' +
      '<button class="ghost small modal-close" data-mact="close">关闭</button>' +
      '<h3>科技</h3><div class="sub">研究点 ' + Math.floor(S.rp) + ' · 工坊每天产出 ' + rpDay.toFixed(0) +
      (rpDay <= 0 ? ' <span style="color:#ff9b9b">— 还没有工坊，研究点不会增长</span>' : '') + '</div>' +
      '<div class="tech-grid">' + cards + '</div></div>', { kind: 'tech' });
    UI.modalBlocking = false;
  }

  function openLog() {
    const S = UI.game.state;
    let items = '';
    for (const l of S.log.slice(-90).reverse()) {
      items += '<div class="log-item ' + (l.kind || '') + '"><span class="d">D' + l.day + '</span><span>' + l.text + '</span></div>';
    }
    openModal('<div class="modal"><button class="ghost small modal-close" data-mact="close">关闭</button>' +
      '<h3>城市日志</h3><div class="sub">第 ' + S.day + ' 天</div><div class="log-list">' + items + '</div></div>', { kind: 'log' });
    UI.modalBlocking = false;
  }

  function openHelp() {
    openModal('<div class="modal help"><button class="ghost small modal-close" data-mact="close">关闭</button>' +
      '<h3>怎么活下去</h3><div class="sub">城市会一圈一圈地长出去，你只有两件事要做：别让他们冻着，别让他们饿着。</div>' +
      '<h4>1 · 管网与供热</h4>' +
      '<ul><li>城市中心是<b>发电机</b>，它只给<b>供热范围</b>（默认 2 环）内的建筑供热，范围可以用科技 +1 环。</li>' +
      '<li>建筑必须<b>接入管网</b>才能算数：第 1 环永远算接通；再往外，每一块地都必须和已有建筑或道路相邻。</li>' +
      '<li>想在外面建东西，先<b>铺路</b>。选中远处的地块，可以点「自动接通道路」。</li>' +
      '<li><b>蒸汽枢纽</b>能自己烧煤，为周围 3×3 的一小片供热，是把城市铺到远处的关键。</li></ul>' +
      '<h4>2 · 温度</h4>' +
      '<ul><li>每个档位 +15°C，过载再 +15°C，科技「楼宇加热器 / 隔热改造」再叠加。</li>' +
      '<li>建筑温度低于 0 就会开始有人生病；低于 -25 会大量减员。病人不干活，还会死。</li></ul>' +
      '<h4>3 · 生产与工人</h4>' +
      '<ul><li>工人<b>自动上岗</b>，优先级：煤矿 → 伙房 → 医疗 → 工坊 → 猎人 → 锯木厂 → 钢铁厂。想调整就停工某座建筑。</li>' +
      '<li>煤矿 / 锯木厂 / 钢铁厂<b>必须建在对应地貌</b>上（煤脉 / 树林 / 铁矿）。</li>' +
      '<li>猎人产出生食，<b>伙房</b>把生食变成餐食。每天全城吃 0.8 份/人。</li>' +
      '<li><b>工坊</b>产出研究点，研究点是唯一的科技来源。</li></ul>' +
      '<h4>4 · 希望与不满</h4>' +
      '<ul><li>希望归零、不满爆表，或者人都死光，都会立刻结束。</li>' +
      '<li>温暖、吃得饱会让希望回升；寒冷、饥饿、露宿街头都会推高不满。</li></ul>' +
      '<h4>5 · 目标</h4>' +
      '<p>第 20 天起会有<b>大风暴</b>，气温跌到 -70°C。熬到<b>第 23 天</b>黎明，你就赢了。</p>' +
      '<h4>快捷键</h4><p><span class="kbd">空格</span> 暂停　<span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span> 速度　' +
      '<span class="kbd">Esc</span> 取消建造/选择　<span class="kbd">右键拖拽</span> 移动视野　<span class="kbd">滚轮</span> 缩放</p>' +
      '</div>', { kind: 'help' });
    UI.modalBlocking = false;
  }
  UI.openHelp = openHelp;

  UI.showEnd = function () {
    const S = UI.game.state;
    const win = S.gameOver === 'victory';
    const titles = { hope: '希望熄灭', riot: '暴动', dead: '全城覆没', victory: '风暴之后' };
    const subs = {
      hope: '没有人再相信明天会好起来。他们收拾行装，走进风雪，再也没有回来。',
      riot: '工人冲进了市政厅。你被扔在发电机旁的雪地上，城市换了主人。',
      dead: '最后一个人在日志里写下「太冷了」，然后也停止了呼吸。',
      victory: '风暴过去的那天早上，太阳第一次照进这座城市的街道。你们活下来了。'
    };
    const stats = [
      ['存活天数', S.day], ['幸存者', Math.round(S.pop)], ['死亡', Math.round(S.dead)],
      ['希望', Math.round(S.hope)], ['不满', Math.round(S.discontent)], ['科技', Object.keys(S.techs).length]
    ];
    let kv = '';
    for (const [k, v] of stats) kv += '<div class="kv"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';
    openModal('<div class="modal end-screen">' +
      '<h3 style="color:' + (win ? '#ffd7a6' : '#ff9b9b') + '">' + (titles[S.gameOver] || '结束') + '</h3>' +
      '<div class="end-sub">' + (subs[S.gameOver] || '') + '</div>' +
      '<div class="end-stats">' + kv + '</div>' +
      '<button class="primary" data-mact="restart">再来一局</button></div>', { kind: 'end' });
    UI.modalBlocking = true;
  };

  /* ============================== 日志 toast ============================== */
  function pushToasts() {
    const S = UI.game.state;
    const stamp = S.logStamp || 0;
    if (UI.lastStamp === undefined) { UI.lastStamp = stamp; return; }
    if (stamp === UI.lastStamp) return;
    const fresh = S.log.slice(Math.max(0, S.log.length - (stamp - UI.lastStamp)));
    UI.lastStamp = stamp;
    for (const l of fresh) {
      if (l.kind === 'hint') continue;
      toast(l.text, l.kind);
    }
  }

  function toast(text, kind) {
    const box = $('toasts');
    const n = document.createElement('div');
    n.className = 'toast ' + (kind || '');
    n.textContent = text;
    box.appendChild(n);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => {
      n.style.transition = 'opacity .5s, transform .5s';
      n.style.opacity = '0';
      n.style.transform = 'translateX(-10px)';
      setTimeout(() => n.remove(), 520);
    }, 5200);
  }
  UI.toast = toast;

  /* 每帧检查是否有事件弹窗 */
  UI.pump = function () {
    const g = UI.game;
    if (!g) return;
    if (g.state.queue.length && !UI.modal) UI.showEvent();
    if (g.state.gameOver && UI.modal !== 'end') UI.showEnd();
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
