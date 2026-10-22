/* =========================================================================
   永冬 · Frostfall —— 模拟核心（纯逻辑，无 DOM，可被 Node 无头加载）
   ========================================================================= */
(function (root) {
  'use strict';
  const FW = root.FW;
  const CFG = FW.CFG;

  const N = CFG.SECTORS;
  const R = CFG.RINGS;

  const KEY = (r, s) => r + ':' + s;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  FW.mulberry32 = mulberry32;

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  FW.clamp = clamp;

  /* 发电机每档耗煤（每小时） */
  const COAL_BURN = [0, 3, 5.5, 9, 14];
  FW.COAL_BURN = COAL_BURN;

  const DIFF = {
    easy: { res: 1.35, ill: 0.7, label: '简单' },
    normal: { res: 1.0, ill: 1.0, label: '普通' },
    hard: { res: 0.78, ill: 1.25, label: '严苛' }
  };
  FW.DIFF = DIFF;

  /* ============================== 构造 ============================== */
  function Game(opts) {
    opts = opts || {};
    const diff = DIFF[opts.difficulty] || DIFF.normal;
    const S = this.state = {
      seed: opts.seed || 20260217,
      diff: opts.difficulty || 'normal',
      diffRes: diff.res,
      day: 1, hour: 6, t: 6,
      res: {
        wood: Math.round(CFG.START.wood * diff.res),
        steel: Math.round(CFG.START.steel * diff.res),
        coal: Math.round(CFG.START.coal * diff.res),
        raw: CFG.START.raw,
        meal: Math.round(CFG.START.meal * diff.res)
      },
      pop: CFG.START.pop, sick: 0, dead: 0, sickFloat: 0, hungerDays: 0,
      hope: CFG.START.hope, discontent: CFG.START.discontent,
      gen: { on: true, level: CFG.START.genLevel, overdrive: false, stress: 0, broken: 0, autoOff: false },
      rp: 0,
      weather: FW.weatherForDay(1),
      storm: false,
      tiles: {}, buildings: [],
      techs: {}, mods: {},
      log: [], queue: [], usedEvents: {}, effects: [],
      paused: true, speed: 0, gameOver: null, victory: false,
      genCap: CFG.GEN_MAX_BASE,
      totalBuilt: 0, totalDeaths: 0, peakPop: CFG.START.pop,
      dirtyConn: true
    };
    this.recalcMods();
    this.genMap();
    this.seedCity();
    this.rebuildConn();
    this.assignWorkers();
    this.log('第 1 天 · 永冬降临。发电机是这座城市唯一的心脏。', 'big');
    this.log('提示：沿道路向外扩张，把工人送进锯木厂与猎人小屋。', 'hint');
  }
  FW.Game = Game;

  Game.prototype.recalcMods = function () {
    const M = { range: 2, genMax: CFG.GEN_MAX_BASE, heater: 0, insul: 0, wood: 1, coal: 1, steel: 1, hunt: 1, medic: 1, cool: 1, cook: 1 };
    const T = this.state.techs;
    const has = (id) => !!T[id];
    if (has('pipe1')) M.range += 1;
    if (has('pipe2')) M.range += 1;
    if (has('heater')) M.heater += 5;
    if (has('insul')) M.insul += 6;
    if (has('gen2')) M.genMax += 1;
    if (has('gen3')) M.genMax += 1;
    if (has('cool')) M.cool = 0.5;
    if (has('wood2')) M.wood += 0.6;
    if (has('coal2')) M.coal += 0.5;
    if (has('steel2')) M.steel += 0.5;
    if (has('medic2')) M.medic += 0.6;
    if (has('food2')) { M.hunt += 0.45; M.cook += 0.25; }
    this.state.mods = M;
    this.state.genCap = M.genMax;
    if (this.state.gen.level > M.genMax) this.state.gen.level = M.genMax;
    return M;
  };

  /* ============================== 地图 ============================== */
  Game.prototype.genMap = function () {
    const S = this.state;
    const rnd = mulberry32(S.seed);
    const tiles = S.tiles = {};
    for (let r = 1; r <= R; r++) {
      for (let s = 0; s < N; s++) tiles[KEY(r, s)] = { r, s, feat: null, kind: null, bld: null };
    }
    const pool = [];
    for (let r = 3; r <= R; r++) for (let s = 0; s < N; s++) pool.push(tiles[KEY(r, s)]);

    function take(list, count, ringMax) {
      const cand = list.filter((t) => !t.feat && t.r <= ringMax);
      for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const x = cand[i]; cand[i] = cand[j]; cand[j] = x; }
      let n = 0;
      for (const t of cand) { if (n >= count) break; t.feat = arguments[3]; n++; }
    }
    take(pool, 6, 5, 'coal');
    take(pool, 6, 5, 'steel');
    take(pool, 20, R, 'forest');
  };

  Game.prototype.seedCity = function () {
    const S = this.state;
    // 十字道路
    for (let r = 1; r <= 2; r++) for (const s of [0, 4, 8, 12]) this.placeRaw('road', r, s);
    // 四顶帐篷
    for (const s of [2, 6, 10, 14]) this.placeRaw('tent', 1, s);
  };

  Game.prototype.placeRaw = function (type, r, s) {
    const S = this.state;
    const t = S.tiles[KEY(r, s)];
    if (!t) return null;
    const b = { type, r, s, workers: 0, enabled: true, up: 0 };
    t.kind = type; t.bld = b; t.feat = null;
    S.buildings.push(b);
    S.dirtyConn = true;
    return b;
  };

  Game.prototype.tile = function (r, s) {
    return this.state.tiles[KEY(r, s)] || null;
  };

  Game.prototype.neighbors = function (r, s) {
    const out = [];
    const add = (rr, ss) => { const t = this.tile(rr, ss); if (t) out.push(t); };
    add(r, (s + 1) % N);
    add(r, (s - 1 + N) % N);
    add(r + 1, s);
    add(r - 1, s);
    return out;
  };

  /* ============================ 连通 / 供热 ============================ */
  Game.prototype.rebuildConn = function () {
    const S = this.state;
    const seen = new Set();
    const stack = [];
    for (let s = 0; s < N; s++) {
      const t = S.tiles[KEY(1, s)];
      if (t.kind) { seen.add(KEY(t.r, t.s)); stack.push(t); }
    }
    while (stack.length) {
      const t = stack.pop();
      for (const n of this.neighbors(t.r, t.s)) {
        if (!n.kind) continue;
        const k = KEY(n.r, n.s);
        if (seen.has(k)) continue;
        seen.add(k); stack.push(n);
      }
    }
    S.conn = seen;
    S.dirtyConn = false;
    return seen;
  };

  Game.prototype.conn = function () {
    if (this.state.dirtyConn) this.rebuildConn();
    return this.state.conn;
  };

  /* 地块是否接入城市管网：
     - 第 1 环紧贴发电机，永远算连通
     - 其它地块需要与某个"已连通建筑"相邻（道路也算建筑） */
  Game.prototype.isConnected = function (t) {
    if (!t) return false;
    if (t.r <= 1) return true;
    const c = this.conn();
    if (t.kind && c.has(KEY(t.r, t.s))) return true;
    for (const n of this.neighbors(t.r, t.s)) {
      if (n.kind && c.has(KEY(n.r, n.s))) return true;
    }
    return false;
  };

  Game.prototype.range = function () { return this.state.mods.range; };

  Game.prototype.hubs = function () {
    return this.state.buildings.filter((b) => b.type === 'hub' && b.enabled && this.isConnected(this.tile(b.r, b.s)));
  };

  Game.prototype.inHubRange = function (hub, t) {
    const dr = Math.abs(hub.r - t.r);
    if (dr > 1) return false;
    let ds = Math.abs(hub.s - t.s);
    if (ds > N / 2) ds = N - ds;
    return ds <= 1;
  };

  Game.prototype.isHeated = function (t) {
    if (!t || !t.kind) return false;
    if (!this.isConnected(t)) return false;
    if (t.r <= this.range()) return !this.state.gen.broken && this.state.gen.on && this.state.gen.level > 0;
    if (this.state.gen.on && !this.state.gen.broken && this.state.gen.level > 0) {
      for (const h of this.hubs()) if (this.inHubRange(h, t)) return true;
    }
    return false;
  };

  Game.prototype.effLevel = function () {
    const g = this.state.gen;
    if (!g.on || g.broken > 0 || g.level <= 0) return 0;
    return g.level + (g.overdrive ? 1 : 0);
  };

  Game.prototype.heatBonus = function (t) {
    if (!this.isHeated(t)) return 0;
    const M = this.state.mods;
    let b = this.effLevel() * 15 + M.heater + M.insul;
    if (t.kind === 'house') b += 4;
    return b;
  };

  Game.prototype.tempOf = function (t) {
    if (!t || !t.kind) return this.state.weather.temp;
    return this.state.weather.temp + this.heatBonus(t);
  };

  /* ============================== 生产 ============================== */
  Game.prototype.staff = function (b) {
    const def = FW.BLD[b.type];
    if (!def || !def.slots) return 0;
    if (!b.enabled) return 0;
    return b.workers / def.slots;
  };

  Game.prototype.coldMul = function (t) {
    const tmp = this.tempOf(t);
    if (tmp >= -10) return 1;
    if (tmp >= -25) return 0.82;
    return 0.6;
  };

  Game.prototype.prodMul = function () {
    const S = this.state;
    let m = 1;
    for (const e of S.effects) if (S.t < e.until) m *= e.mul;
    return m;
  };

  Game.prototype.rateOf = function (b, res) {
    const def = FW.BLD[b.type];
    if (!def || !def.produce || !def.produce[res]) return 0;
    const staff = this.staff(b);
    if (staff <= 0) return 0;
    let m = 1;
    if (res === 'wood') m *= this.state.mods.wood;
    if (res === 'coal') m *= this.state.mods.coal;
    if (res === 'steel') m *= this.state.mods.steel;
    if (res === 'raw') m *= this.state.mods.hunt;
    return def.produce[res] * staff * this.coldMul(this.tile(b.r, b.s)) * m * this.prodMul();
  };

  Game.prototype.rpRate = function () {
    let rp = 0;
    for (const b of this.state.buildings) {
      if (b.type !== 'workshop') continue;
      const s = this.staff(b);
      if (s > 0) rp += FW.BLD.workshop.rp * s * this.coldMul(this.tile(b.r, b.s)) * this.prodMul();
    }
    return rp;
  };

  Game.prototype.treatRate = function () {
    let v = 0;
    for (const b of this.state.buildings) {
      if (b.type !== 'medical') continue;
      const s = this.staff(b);
      if (s > 0) v += FW.BLD.medical.treat * s * this.state.mods.medic;
    }
    return v;
  };

  /* ============================== 派工 ============================== */
  Game.prototype.assignWorkers = function () {
    const S = this.state;
    const avail = Math.max(0, Math.floor(S.pop - S.sick));
    let left = avail;
    const list = S.buildings.filter((b) => FW.BLD[b.type].slots);
    for (const b of list) b.workers = 0;
    list.sort((a, b) => (FW.BLD[a.type].prio || 50) - (FW.BLD[b.type].prio || 50));
    for (const b of list) {
      const def = FW.BLD[b.type];
      if (!b.enabled) continue;
      const n = Math.min(def.slots, left);
      b.workers = n;
      left -= n;
    }
    S.freeWorkers = left;
    S.workAvail = avail;
  };

  /* ============================== 建造 ============================== */
  Game.prototype.hasTech = function (id) { return !!this.state.techs[id]; };

  Game.prototype.canBuild = function (type, r, s) {
    const S = this.state;
    const def = FW.BLD[type];
    if (!def) return { ok: false, why: '未知建筑' };
    const t = this.tile(r, s);
    if (!t) return { ok: false, why: '越界' };
    if (t.kind) return { ok: false, why: '地块已被占用' };
    if (def.tech && !this.hasTech(def.tech)) return { ok: false, why: '尚未研究' };
    if (def.need && t.feat !== def.need) {
      return { ok: false, why: def.need === 'forest' ? '必须建在树林上' : def.need === 'coal' ? '必须建在煤脉上' : '必须建在铁矿上' };
    }
    if (!def.need && t.feat) {
      return { ok: false, why: '地貌被占用：' + featName(t.feat) };
    }
    if (type !== 'road' && !this.isConnected(t)) return { ok: false, why: '未接入城市管网' };
    if (!type.length) return { ok: false, why: '?' };
    if (!this.canAfford(def.cost)) return { ok: false, why: '资源不足' };
    return { ok: true };
  };

  function featName(f) { return f === 'forest' ? '树林' : f === 'coal' ? '煤脉' : '铁矿'; }
  FW.featName = featName;

  Game.prototype.canAfford = function (cost) {
    if (!cost) return true;
    const res = this.state.res;
    for (const k in cost) if (res[k] < cost[k]) return false;
    return true;
  };

  Game.prototype.pay = function (cost) {
    const res = this.state.res;
    for (const k in cost) res[k] = Math.max(0, res[k] - cost[k]);
  };

  Game.prototype.build = function (type, r, s) {
    const c = this.canBuild(type, r, s);
    if (!c.ok) return c;
    if (type !== 'road') this.pay(FW.BLD[type].cost);
    const b = this.placeRaw(type, r, s);
    this.state.totalBuilt++;
    this.afterChange();
    const def = FW.BLD[type];
    if (type !== 'road') this.log('建成 ' + def.name + '（第 ' + (r) + ' 环）', 'ok');
    return { ok: true, bld: b };
  };

  Game.prototype.afterChange = function () {
    this.state.stamp = (this.state.stamp || 0) + 1;
    this.rebuildConn();
    this.assignWorkers();
  };

  Game.prototype.demolish = function (r, s) {
    const S = this.state;
    const t = this.tile(r, s);
    if (!t || !t.kind) return { ok: false, why: '空地' };
    if (t.kind === 'road') { t.kind = null; t.bld = null; this.afterChange(); return { ok: true }; }
    const def = FW.BLD[t.kind];
    // 返还一半木材
    S.res.wood += Math.floor((def.cost.wood || 0) * 0.5);
    S.buildings = S.buildings.filter((b) => b !== t.bld);
    this.log('拆除了 ' + def.name, 'warn');
    t.kind = null; t.bld = null;
    this.afterChange();
    return { ok: true };
  };

  Game.prototype.upgrade = function (r, s) {
    const S = this.state;
    const t = this.tile(r, s);
    if (!t || t.kind !== 'tent') return { ok: false, why: '只有帐篷可以升级' };
    if (!this.hasTech('house')) return { ok: false, why: '需要研究「房屋」' };
    const cost = { wood: 14, steel: 12 };
    if (!this.canAfford(cost)) return { ok: false, why: '资源不足' };
    this.pay(cost);
    t.kind = 'house'; t.bld.type = 'house';
    this.afterChange();
    this.log('帐篷升级为房屋', 'ok');
    return { ok: true };
  };

  /* 自动铺路：从已连通区域到目标地块的最短空地块路径 */
  Game.prototype.pathRoads = function (tr, ts) {
    const S = this.state;
    const target = KEY(tr, ts);
    const prev = {};
    const q = [];
    const seen = new Set();
    // 起点：所有已连通地块的邻居（空地块）
    const walkable = (t) => {
      const k = KEY(t.r, t.s);
      return !t.kind && (!t.feat || k === target);
    };
    for (const k of this.conn()) {
      const t = S.tiles[k];
      if (!t) continue;
      for (const n of this.neighbors(t.r, t.s)) {
        const nk = KEY(n.r, n.s);
        if (!walkable(n) || seen.has(nk)) continue;
        seen.add(nk); prev[nk] = k; q.push(n);
      }
    }
    let curKey = null;
    if (seen.has(target)) curKey = target;
    while (q.length && !curKey) {
      const t = q.shift();
      const tk = KEY(t.r, t.s);
      if (tk === target) { curKey = tk; break; }
      for (const n of this.neighbors(t.r, t.s)) {
        const nk = KEY(n.r, n.s);
        if (!walkable(n) || seen.has(nk)) continue;
        seen.add(nk); prev[nk] = tk; q.push(n);
      }
    }
    if (!curKey) return null;
    const path = [];
    let k = curKey;
    while (k && prev[k] !== undefined) {
      const parts = k.split(':');
      path.push({ r: Number(parts[0]), s: Number(parts[1]) });
      k = prev[k];
    }
    path.reverse();
    path.pop();   // 目标地块本身不铺路：它只是要"接通"
    return path;
  };

  Game.prototype.autoRoad = function (tr, ts) {
    const path = this.pathRoads(tr, ts);
    if (!path) return { ok: false, why: '无法找到通路' };
    let n = 0;
    for (const p of path) {
      const t = this.tile(p.r, p.s);
      if (t && !t.kind && !t.feat) { this.placeRaw('road', p.r, p.s); n++; }
    }
    this.afterChange();
    if (n) this.log('铺设了 ' + n + ' 段道路', 'ok');
    return { ok: true, n };
  };

  /* ============================== 科技 ============================== */
  Game.prototype.canResearch = function (id) {
    const tech = FW.TECHS[id];
    if (!tech) return { ok: false, why: '未知科技' };
    if (this.hasTech(id)) return { ok: false, why: '已研究' };
    if (tech.req) for (const q of tech.req) if (!this.hasTech(q)) return { ok: false, why: '需要前置：' + FW.TECHS[q].name };
    if (this.state.rp < tech.cost) return { ok: false, why: '研究点不足' };
    return { ok: true };
  };

  Game.prototype.research = function (id) {
    const c = this.canResearch(id);
    if (!c.ok) return c;
    this.state.rp -= FW.TECHS[id].cost;
    this.state.techs[id] = true;
    this.recalcMods();
    this.log('研究完成：' + FW.TECHS[id].name, 'tech');
    this.afterChange();
    return { ok: true };
  };

  /* ============================== 发电机 ============================== */
  Game.prototype.setGenLevel = function (n) {
    const g = this.state.gen;
    g.level = clamp(n, 0, this.state.genCap);
    return g.level;
  };
  Game.prototype.setOverdrive = function (on) {
    const g = this.state.gen;
    if (on && g.broken > 0) return false;
    g.overdrive = !!on;
    return g.overdrive;
  };

  /* ============================== 主循环 ============================== */
  Game.prototype.advance = function (dtHours) {
    const S = this.state;
    if (S.gameOver) return;
    S.acc = (S.acc || 0) + dtHours;
    let guard = 0;
    while (S.acc >= 1 && !S.gameOver && guard++ < 400) {
      S.acc -= 1;
      this.stepHour();
    }
  };

  Game.prototype.stepHour = function () {
    const S = this.state;
    S.t += 1;
    S.hour += 1;
    if (S.hour >= 24) {
      S.hour = 0;
      S.day += 1;
      this.onNewDay();
      if (S.gameOver) return;
    }
    this.updateWeather();
    this.assignWorkers();
    this.stepProduction();
    this.stepCoal();
    this.stepIllness();
    this.stepMood();
    this.stepTrend();
    this.checkEnd();
  };

  Game.prototype.stepTrend = function () {
    const S = this.state;
    const hist = S._hist || (S._hist = []);
    hist.push(Object.assign({}, S.res));
    if (hist.length > 25) hist.shift();
    const span = hist.length - 1;
    const tr = S.trend || (S.trend = {});
    for (const k in S.res) tr[k] = span > 0 ? (S.res[k] - hist[0][k]) / span : 0;
  };

  Game.prototype.updateWeather = function () {
    const S = this.state;
    const w = FW.weatherForDay(S.day);
    if (w.label !== S.weather.label) {
      if (w.storm) {
        this.log('⚠ 大风暴来袭！气温将跌至 ' + w.temp + '°C', 'bad');
        S.discontent += 6;
      } else if (S.weather.storm) {
        this.log('风暴过去了。天空依旧阴沉，但风停了。', 'ok');
      } else {
        this.log('天气变化：' + w.label + '（' + w.temp + '°C）', 'warn');
      }
    }
    S.weather = w;
    S.storm = !!w.storm;
  };

  Game.prototype.stepProduction = function () {
    const S = this.state;
    const res = S.res;
    for (const b of S.buildings) {
      const def = FW.BLD[b.type];
      if (!def) continue;
      if (def.produce) {
        for (const k in def.produce) {
          const v = this.rateOf(b, k);
          if (v) res[k] += v;
        }
      }
      if (def.cook) {
        const staff = this.staff(b);
        if (staff > 0) {
          const want = def.cook.per * staff * this.state.mods.cook * this.prodMul() * this.coldMul(this.tile(b.r, b.s));
          const used = Math.min(want, res.raw);
          res.raw -= used;
          res.meal += used * def.cook.ratio;
        }
      }
    }
    S.rp += this.rpRate();
  };

  /* 当前每小时耗煤（含蒸汽枢纽；发电机停机时为 0） */
  Game.prototype.burnRate = function () {
    const S = this.state, g = S.gen;
    if (!g.on || g.level <= 0) return 0;
    let b = COAL_BURN[g.level] * (g.overdrive ? 1.6 : 1);
    b += this.hubs().length * FW.BLD.hub.burn;
    return b;
  };

  Game.prototype.stepCoal = function () {
    const S = this.state;
    const g = S.gen;
    if (g.broken > 0) {
      g.broken -= 1;
      if (g.broken === 0) this.log('发电机修复完毕。', 'ok');
      return;
    }
    if (g.overdrive) {
      g.stress = Math.min(100, g.stress + (100 / 18) * S.mods.cool);
      if (g.stress >= 100) {
        g.overdrive = false;
        g.stress = 0;
        g.broken = 10;
        S.discontent = Math.min(100, S.discontent + 9);
        S.hope = Math.max(0, S.hope - 5);
        this.log('发电机过载炸毁！停机 10 小时。', 'bad');
      }
    } else {
      g.stress = Math.max(0, g.stress - 100 / 40);
    }
    let burn = this.burnRate();
    if (g.autoOff && g.on === false) {
      const need = COAL_BURN[g.level] * (g.overdrive ? 1.6 : 1) + this.hubs().length * FW.BLD.hub.burn;
      if (S.res.coal >= need * 6) {
        g.on = true;
        g.autoOff = false;
        this.log('煤炭回补，发电机重新点火。', 'ok');
        burn = this.burnRate();
      }
    }
    if (burn <= 0) return;
    if (S.res.coal >= burn) {
      S.res.coal -= burn;
    } else {
      S.res.coal = 0;
      if (g.on) {
        g.on = false;
        g.autoOff = true;
        g.overdrive = false;
        S.discontent = Math.min(100, S.discontent + 7);
        this.log('煤炭耗尽，发电机熄火！', 'bad');
      }
    }
  };

  /* 住房温度 & 病人 */
  Game.prototype.housing = function () {
    const S = this.state;
    const homes = [];
    for (const b of S.buildings) {
      const def = FW.BLD[b.type];
      if (def && def.kind === 'home') {
        const t = this.tile(b.r, b.s);
        homes.push({ b, t, cap: def.housing, temp: this.tempOf(t) });
      }
    }
    homes.sort((a, b) => b.temp - a.temp);
    let left = S.pop, cap = 0, cold = 0, illRate = 0, warm = 0, exposure = 0;
    for (const h of homes) {
      cap += h.cap;
      const occ = Math.min(h.cap, left);
      left -= occ;
      if (occ <= 0) continue;
      const r = coldIllness(h.temp);
      illRate += occ * r;
      exposure += occ * exposureRate(h.temp);
      if (h.temp >= 0) warm += occ; else cold += occ;
    }
    const homeless = Math.max(0, left);
    illRate += homeless * 0.007;
    exposure += homeless * exposureRate(S.weather.temp);
    return { homes, cap, homeless, cold, warm, illRate, exposure, avgTemp: homes.length ? homes[0].temp : S.weather.temp };
  };

  function coldIllness(t) {
    if (t >= -5) return 0;
    if (t >= -15) return 0.0012;
    if (t >= -25) return 0.0022;
    return 0.0045;
  }
  FW.coldIllness = coldIllness;

  /* 低于 -20°C 直接冻死（每小时每人） */
  function exposureRate(t) {
    if (t > -20) return 0;
    return 0.0004 + (-t - 20) * 0.00013;
  }
  FW.exposureRate = exposureRate;

  Game.prototype.stepIllness = function () {
    const S = this.state;
    const H = this.housing();
    S.housing = H;
    let rate = H.illRate * DIFF[S.diff].ill;
    // 户外岗位：严寒中的工人
    for (const b of S.buildings) {
      const def = FW.BLD[b.type];
      if (!def || !def.slots || !b.workers) continue;
      const t = this.tile(b.r, b.s);
      const tmp = this.tempOf(t);
      if (tmp < -15) rate += b.workers * 0.0007;
    }
    S.sickFloat += rate;
    S.sick = Math.min(S.pop, S.sick + rate);
    // 治疗
    const treat = this.treatRate() / 24;
    S.sick = Math.max(0, S.sick - treat);
    S.sickFloat = S.sick;
    // 死亡
    const base = S.weather.temp <= -30 ? 0.1 : 0.03;
    const deathRate = (base * (this.hasTech('medic2') ? 0.7 : 1)) / 24;
    const dying = S.sick * deathRate;
    if (dying > 0.0001) {
      S.sick -= dying;
      S.pop -= dying;
      S.dead += dying;
      S.totalDeaths += dying;
      if (Math.random() < dying) {
        S.hope = Math.max(0, S.hope - 1.2);
        S.discontent = Math.min(100, S.discontent + 0.8);
      }
    }
    S.pop = Math.max(0, S.pop);
    S.sick = Math.min(S.sick, S.pop);
    // 冻毙：住房温度低于 -20°C 时直接死人
    const exp = H.exposure * DIFF[S.diff].ill;
    if (exp > 0.00005) {
      const dead = Math.min(S.pop, exp);
      S.pop -= dead;
      S.dead += dead;
      S.totalDeaths += dead;
      S.hope = Math.max(0, S.hope - dead * 0.9);
      S.discontent = Math.min(100, S.discontent + dead * 0.6);
      S.frozenLog = (S.frozenLog || 0) + dead;
      if (!S.frozenWarn) {
        S.frozenWarn = true;
        this.log('有人在帐篷里被冻死了。住房温度低于 -20°C 会直接要命。', 'bad');
      }
    } else if (S.frozenWarn) {
      S.frozenWarn = false;
    }
  };

  Game.prototype.stepMood = function () {
    const S = this.state;
    const H = S.housing || this.housing();
    let hope = 0, dis = 0;
    const warm = H.warm, cold = H.cold, home = H.homeless;
    if (cold > 0) { hope -= 0.0035 * (cold / 10); dis += 0.005 * (cold / 10); }
    if (home > 0) { hope -= 0.01 * (home / 10); dis += 0.03 * (home / 10); }
    if (S.res.meal <= 0) { hope -= 0.01; dis += 0.05; }
    if (!S.gen.on) { dis += 0.03; hope -= 0.01; }
    if (S.sick > S.pop * 0.2) { hope -= 0.008; dis += 0.006; }
    if (S.storm) { hope -= 0.015; dis += 0.015; }
    if (warm > 0 && cold === 0 && home === 0 && S.res.meal > S.pop * 0.5) {
      hope += 0.022; dis -= 0.028;
    }
    if (H.homes.length === 0) { hope -= 0.01; dis += 0.02; }
    S.hope = clamp(S.hope + hope, 0, 100);
    S.discontent = clamp(S.discontent + dis, 0, 100);
    S.moodDelta = { hope, dis };
  };

  /* ============================== 每日 ============================== */
  Game.prototype.onNewDay = function () {
    const S = this.state;
    this.updateWeather();
    // 吃饭
    const need = S.pop * 0.8;
    if (S.res.meal >= need) {
      S.res.meal -= need;
      if (S.hungerDays > 0) this.log('城市的餐食恢复了供应。', 'ok');
      S.hungerDays = 0;
    } else {
      const got = S.res.meal;
      S.res.meal = 0;
      S.hungerDays++;
      S.sick = Math.min(S.pop, S.sick + S.pop * 0.03);
      S.hope = Math.max(0, S.hope - 4);
      S.discontent = Math.min(100, S.discontent + 6);
      this.log('食物短缺！只够 ' + Math.round((got / need) * 100) + '% 的人吃饱。', 'bad');
      if (S.hungerDays >= 2) {
        const dead = Math.round(S.pop * 0.03);
        S.pop = Math.max(0, S.pop - dead);
        S.dead += dead; S.totalDeaths += dead;
        S.hope = Math.max(0, S.hope - 5);
        this.log('饥荒夺走了 ' + dead + ' 条生命。', 'bad');
      }
    }
    // 事件
    this.tryEvents();
    // 胜利判定
    if (S.day >= CFG.VICTORY_DAY && !S.gameOver) {
      S.victory = true;
      S.gameOver = 'victory';
      this.log('—— 我们活下来了。风暴之后，城市还站着。', 'big');
    }
    if (S.day % 1 === 0 && S.day > 1) {
      this.log('—— 第 ' + S.day + ' 天 · ' + S.weather.label + ' ' + S.weather.temp + '°C', 'day');
    }
    S.effects = S.effects.filter((e) => e.until > S.t);
    S.peakPop = Math.max(S.peakPop, S.pop);
  };

  Game.prototype.tryEvents = function () {
    const S = this.state;
    if (S.queue.length) return;
    for (const ev of FW.EVENTS) {
      if (S.usedEvents[ev.id]) continue;
      const tr = ev.trigger || {};
      if (tr.day && S.day === tr.day) {
        if (tr.cond && !tr.cond(S)) continue;
        S.usedEvents[ev.id] = true;
        S.queue.push(ev);
        return;
      }
    }
    if (S.day >= 5 && Math.random() < 0.22) {
      const pool = FW.EVENTS.filter((ev) => !S.usedEvents[ev.id] && ev.trigger && ev.trigger.random);
      const ok = pool.filter((ev) => !ev.trigger.cond || ev.trigger.cond(S));
      if (ok.length) {
        const ev = ok[Math.floor(Math.random() * ok.length)];
        S.usedEvents[ev.id] = true;
        S.queue.push(ev);
      }
    }
  };

  Game.prototype.resolveEvent = function (idx) {
    const S = this.state;
    const ev = S.queue.shift();
    if (!ev) return;
    const ch = ev.choices[idx] || ev.choices[0];
    this.applyFx(ch.fx || {});
    if (ch.after) this.log(ch.after, 'story');
    this.afterChange();
    return ch;
  };

  Game.prototype.applyFx = function (fx) {
    const S = this.state;
    if (fx.res) for (const k in fx.res) S.res[k] = Math.max(0, S.res[k] + fx.res[k]);
    if (fx.cost) for (const k in fx.cost) S.res[k] = Math.max(0, S.res[k] - fx.cost[k]);
    if (fx.pop) S.pop += fx.pop;
    if (fx.sick) S.sick = Math.min(S.pop, S.sick + fx.sick);
    if (fx.sickFix) { S.sick = 0; S.sickFloat = 0; }
    if (fx.hope) S.hope = clamp(S.hope + fx.hope, 0, 100);
    if (fx.discontent) S.discontent = clamp(S.discontent + fx.discontent, 0, 100);
    if (fx.rp) S.rp += fx.rp;
    if (fx.genFix) { S.gen.broken = 0; S.gen.on = true; S.gen.stress = 0; }
    if (fx.genOff) S.gen.broken = Math.max(S.gen.broken, fx.genOff * 24);
    if (fx.slow) S.effects.push({ until: S.t + fx.slow.days * 24, mul: fx.slow.mul });
    if (fx.boost) S.effects.push({ until: S.t + fx.boost.days * 24, mul: fx.boost.mul });
    if (fx.pop) S.pop = Math.max(0, S.pop);
  };

  Game.prototype.checkEnd = function () {
    const S = this.state;
    if (S.gameOver) return;
    if (S.pop < 1) { S.gameOver = 'dead'; this.log('城市里再也没有人了。', 'bad'); return; }
    if (S.hope <= 0) { S.gameOver = 'hope'; this.log('希望彻底熄灭。人们抛下发电机，走进风雪。', 'bad'); return; }
    if (S.discontent >= 100) { S.gameOver = 'riot'; this.log('愤怒的人群推倒了市政厅的门。你被赶出了城市。', 'bad'); return; }
  };

  Game.prototype.log = function (text, kind) {
    const S = this.state;
    S.log.push({ day: S.day, hour: S.hour, text, kind: kind || '' });
    if (S.log.length > 120) S.log.shift();
    S.logStamp = (S.logStamp || 0) + 1;
  };

  /* ============================== 摘要 ============================== */
  Game.prototype.stats = function () {
    const S = this.state;
    const H = S.housing || this.housing();
    const gen = this.effLevel();
    return {
      day: S.day, hour: S.hour, pop: Math.round(S.pop), sick: Math.round(S.sick),
      hope: Math.round(S.hope), discontent: Math.round(S.discontent),
      coal: Math.round(S.res.coal), wood: Math.round(S.res.wood), steel: Math.round(S.res.steel),
      raw: Math.round(S.res.raw), meal: Math.round(S.res.meal),
      temp: S.weather.temp, label: S.weather.label,
      heat: gen * 15 + S.mods.heater + S.mods.insul,
      range: S.mods.range, genLevel: S.gen.level, homes: H.homes.length,
      cap: H.cap, homeless: H.homeless, warm: H.warm, cold: H.cold,
      rp: Math.round(S.rp), buildings: S.buildings.length,
      coalRate: this.burnRate(),
      free: S.freeWorkers
    };
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
