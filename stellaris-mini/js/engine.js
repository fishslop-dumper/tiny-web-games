/* =========================================================================
 * 群星：微光银河 —— 游戏引擎
 * 纯逻辑（不碰 DOM），可在 Node 中加载模拟。
 * ========================================================================= */
(function (g) {
  'use strict';
  const SM = g.SM;

  /* ------------------------------------------------------------------ */
  /* 可复现随机数                                                         */
  /* ------------------------------------------------------------------ */
  class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
    next() {
      let t = (this.s += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  }
  SM.RNG = RNG;

  const CATS = SM.RESEARCH_ORDER;

  function zeroIncome() {
    return { energy: 0, minerals: 0, food: 0, alloys: 0, consumer_goods: 0, influence: 0, unity: 0, physics: 0, society: 0, engineering: 0 };
  }

  class Game {
    constructor(opts) {
      this.opts = Object.assign({
        seed: (Math.random() * 1e9) | 0,
        difficulty: 'normal',
        empireName: '大肥鱼帝国',
        color: '#4cc9f0',
        trait: 'industrious',
        species: '肥鱼人',
        aiCount: SM.AI_COUNT
      }, opts || {});
      this.rng = new RNG(this.opts.seed);
      this.notices = [];
      this.noticeSeq = 0;
      this.init();
    }

    /* ---------------------------------------------------------------- */
    /* 初始化                                                            */
    /* ---------------------------------------------------------------- */
    init() {
      const self = this;
      const galaxy = SM.Galaxy.generate(this.rng, SM.GALAXY_SIZE);
      const systems = galaxy.systems;

      // 汇总每个星系中不可居住行星的资源点
      systems.forEach(function (sys) {
        const dep = { energy: 0, minerals: 0, research: 0 };
        sys.planets.forEach(function (p) {
          if (!p.habitable) {
            dep.energy += p.deposits.energy;
            dep.minerals += p.deposits.minerals;
            dep.research += p.deposits.research;
          }
        });
        if (sys.core) {
          dep.energy += 18; dep.minerals += 12; dep.research += 10;
        }
        sys.deposits = dep;
      });

      const state = {
        day: 0,
        difficulty: this.opts.difficulty,
        systems: systems,
        empires: [],
        colonies: [],
        fleets: [],
        wars: [],
        diplo: {},
        truces: {},
        nextId: { colony: 1, fleet: 1, ship: 1, war: 1 },
        fleetNum: {},
        firedEvents: {},
        eventLastFired: {},
        delayedEvents: [],
        lastEventDay: 60,
        log: [],
        notices: [],
        pendingEvent: null,
        pendingPeace: null,
        pendingUltimatum: null,
        gameOver: null,
        scoreShown: false,
        stats: { battles: 0, shipsLost: 0, coloniesFounded: 0, techsResearched: 0, shipsBuilt: 0 },
        monthly: 0
      };
      this.state = state;

      const diff = SM.DIFFICULTY[state.difficulty] || SM.DIFFICULTY.normal;
      const capitals = this.rng.shuffle(galaxy.capitals.slice());
      const personalities = this.rng.shuffle(SM.AI_PERSONALITY_ORDER.slice());

      // 玩家
      const player = this.createEmpire({
        id: 'e0',
        name: this.opts.empireName || '大肥鱼帝国',
        color: this.opts.color || '#4cc9f0',
        species: this.opts.species || '肥鱼人',
        trait: this.opts.trait || 'industrious',
        isPlayer: true,
        capitalSystemId: capitals[0]
      });

      // AI 帝国
      const names = this.rng.shuffle(SM.AI_EMPIRE_NAMES.slice());
      const colors = SM.EMPIRE_COLORS.map(function (c) { return c.color; })
        .filter(function (c) { return c !== player.color; });
      const speciesPool = this.rng.shuffle(SM.SPECIES_NAMES.slice());
      for (let i = 0; i < Math.min(3, capitals.length - 1); i++) {
        const pid = personalities[i % personalities.length];
        const traitKeys = Object.keys(SM.TRAITS).filter(function (t) { return t !== player.trait; });
        const ai = this.createEmpire({
          id: 'e' + (i + 1),
          name: names[i] || ('未命名帝国' + i),
          color: colors[i % colors.length],
          species: speciesPool[i % speciesPool.length],
          trait: this.rng.pick(traitKeys),
          isPlayer: false,
          capitalSystemId: capitals[i + 1],
          personality: pid,
          diff: diff
        });
      }

      // 中立生物
      this.spawnNeutrals();

      // 初始经济
      state.empires.forEach(function (e) {
        self.rebalanceJobs(e);
        self.computeIncome(e);
      });
      // AI 初始科研
      state.empires.forEach(function (e) {
        if (!e.isPlayer) CATS.forEach(function (cat) { self.aiPickResearch(e, cat); });
      });

      this.notice('info', '欢迎来到微光银河。以「' + player.name + '」之名，让群星为你闪耀。', { icon: '🌌' });
      this.notice('info', '提示：先选中科研船，确认「自动调查」已开启；再为殖民地选择研究项目。', { icon: '💡' });
    }

    createEmpire(cfg) {
      const state = this.state;
      const e = {
        id: cfg.id,
        name: cfg.name,
        color: cfg.color,
        species: cfg.species,
        trait: cfg.trait,
        isPlayer: !!cfg.isPlayer,
        alive: true,
        personality: cfg.personality || null,
        diff: cfg.diff || null,
        resources: { energy: 250, minerals: 500, food: 150, alloys: 150, consumer_goods: 120, influence: 45, unity: 0 },
        income: zeroIncome(),
        mods: {},
        techs: {},
        techCounts: {},
        research: { physics: { current: null, options: [], progress: 0 }, society: { current: null, options: [], progress: 0 }, engineering: { current: null, options: [], progress: 0 } },
        traditions: [],
        colonies: [],
        fleets: [],
        contacts: {},
        capital: null,
        firedEvents: {},
        ai: { nextDiploDay: 0, nextWarDay: 0, lastPeaceOffer: -9999, target: null },
        stats: { coloniesFounded: 0, shipsBuilt: 0, techs: 0 }
      };
      e.mods = this.computeMods(e);
      this.state.empires.push(e);

      // 首都
      const sys = this.system(cfg.capitalSystemId);
      if (!sys) throw new Error('capital system missing ' + cfg.capitalSystemId);
      const home = sys.planets.find(function (p) { return p.id === sys.homePlanetId; }) ||
        sys.planets.find(function (p) { return p.habitable; });
      if (home) {
        const colony = this.createColony(home, e, { homeworld: true, pops: 20 });
        e.capital = colony.id;
      }
      sys.capitalOf = e.id;

      // 初始舰队
      const capSys = sys.id;
      const warships = [];
      for (let i = 0; i < 3; i++) warships.push(this.makeShip('corvette', e));
      this.createFleet(e, capSys, warships, { name: this.nextFleetName(e), kind: 'combat' });
      this.createFleet(e, capSys, [this.makeShip('science', e)], { name: '科研船', kind: 'science', auto: true });
      this.createFleet(e, capSys, [this.makeShip('construction', e)], { name: '工程船', kind: 'construction', auto: true });

      CATS.forEach(function (cat) { e.research[cat].options = []; });
      this.drawTechOptions(e, 'physics');
      this.drawTechOptions(e, 'society');
      this.drawTechOptions(e, 'engineering');
      return e;
    }

    spawnNeutrals() {
      const self = this;
      this.state.systems.forEach(function (sys) {
        if (!sys.hostiles || !sys.hostiles.length) return;
        sys.hostiles.forEach(function (h) {
          const ships = [];
          for (let i = 0; i < h.count; i++) {
            const ship = self.makeShip('amoeba', null);
            if (h.guardian) {
              ship.hull = ship.hullMax = 420;
              ship.damage = 22;
              ship.power = 220;
            }
            ships.push(ship);
          }
          self.createFleet(null, sys.id, ships, {
            name: h.guardian ? '远古守卫' : '虚空浮游群',
            kind: 'neutral',
            neutral: true
          });
        });
      });
    }

    /* ---------------------------------------------------------------- */
    /* 查询与工具                                                        */
    /* ---------------------------------------------------------------- */
    system(id) { return this.state.systems.find(function (s) { return s.id === id; }) || null; }
    empire(id) { return this.state.empires.find(function (e) { return e.id === id; }) || null; }
    colony(id) { return this.state.colonies.find(function (c) { return c.id === id; }) || null; }
    fleet(id) { return this.state.fleets.find(function (f) { return f.id === id; }) || null; }
    player() { return this.state.empires[0]; }
    planet(planetId) {
      for (let i = 0; i < this.state.systems.length; i++) {
        const p = this.state.systems[i].planets.find(function (pp) { return pp.id === planetId; });
        if (p) return p;
      }
      return null;
    }
    planetSystem(planetId) {
      for (let i = 0; i < this.state.systems.length; i++) {
        if (this.state.systems[i].planets.some(function (p) { return p.id === planetId; })) return this.state.systems[i];
      }
      return null;
    }
    playerFleet(id) {
      const f = this.fleet(id);
      return f && f.owner === this.player().id ? f : null;
    }
    fleetsIn(systemId) {
      return this.state.fleets.filter(function (f) { return f.systemId === systemId && !f.travel; });
    }
    combatFleets(empire) {
      const self = this;
      const id = typeof empire === 'string' ? empire : (empire && empire.id);
      return this.state.fleets.filter(function (f) {
        return f.owner === id && f.kind === 'combat' && f.ships.length > 0;
      });
    }
    ownedSystems(empireId) {
      return this.state.systems.filter(function (s) { return s.owner === empireId; });
    }
    colonySystem(colony) { return this.system(colony.systemId); }
    colonyHousing(c) {
      let h = 2;
      SM.DISTRICT_ORDER.forEach(function (k) { h += (c.districts[k] || 0) * SM.DISTRICTS[k].housing; });
      return h;
    }
    colonyBuildingSlots(c) { return Math.min(8, 2 + (c.districts.city || 0)); }
    colonyUsedBuildingSlots(c) { return c.buildings.filter(function (b) { return b !== 'capital'; }).length; }
    colonyMaxDistricts(c) {
      const sys = this.system(c.systemId);
      const planet = sys && sys.planets.find(function (p) { return p.id === c.planetId; });
      return planet && planet.maxDistricts ? planet.maxDistricts : { city: 4, generator: 2, mining: 2, agri: 2 };
    }
    colonyJobs(c) {
      const jobs = {};
      SM.DISTRICT_ORDER.forEach(function (k) {
        const n = c.districts[k] || 0;
        const def = SM.DISTRICTS[k];
        Object.keys(def.jobs).forEach(function (j) { jobs[j] = (jobs[j] || 0) + def.jobs[j] * n; });
      });
      c.buildings.forEach(function (bid) {
        const def = SM.BUILDINGS[bid];
        if (!def || !def.jobs) return;
        Object.keys(def.jobs).forEach(function (j) { jobs[j] = (jobs[j] || 0) + def.jobs[j]; });
      });
      return jobs;
    }
    colonyJobTotal(c) {
      const jobs = this.colonyJobs(c);
      return Object.keys(jobs).reduce(function (a, k) { return a + jobs[k]; }, 0);
    }
    empirePops(e) {
      const self = this;
      return e.colonies.reduce(function (a, cid) {
        const c = self.colony(cid);
        return a + (c && !c.occupiedBy ? c.pops : 0);
      }, 0);
    }
    empireColonyCount(e) {
      const self = this;
      return e.colonies.filter(function (cid) {
        const c = self.colony(cid);
        return c && !c.occupiedBy;
      }).length;
    }
    fleetSpeed(f) {
      let speed = 3;
      f.ships.forEach(function (s) { speed = Math.min(speed, SM.SHIPS[s.cls].speed); });
      const e = f.owner ? this.empire(f.owner) : null;
      const mult = e ? (1 + (e.mods.shipSpeedMult || 0)) : 1;
      return Math.max(0.3, speed * mult);
    }
    fleetPower(f) {
      let p = 0;
      f.ships.forEach(function (s) {
        p += s.power * (0.35 + 0.65 * (s.hull / s.hullMax));
      });
      return Math.round(p);
    }
    empirePower(e) {
      const self = this;
      let p = 0;
      this.state.fleets.forEach(function (f) {
        if (f.owner === e.id && f.kind === 'combat') p += self.fleetPower(f);
      });
      e.colonies.forEach(function (cid) {
        const c = self.colony(cid);
        if (c && !c.occupiedBy && c.starbase.hull > 0) p += SM.STARBASE_LEVELS[c.starbase.level].power * 0.5;
      });
      return Math.round(p);
    }
    fleetUpkeep(empireId) {
      const self = this;
      let up = 0;
      this.state.fleets.forEach(function (f) {
        if (f.owner !== empireId) return;
        f.ships.forEach(function (s) { up += SM.SHIPS[s.cls].upkeep || 0; });
      });
      return up;
    }
    housingPressure(c) {
      const h = this.colonyHousing(c);
      return h - c.pops;
    }
    totalColonies() {
      const self = this;
      return this.state.empires.reduce(function (a, e) {
        return a + e.colonies.filter(function (cid) { const c = self.colony(cid); return c && !c.occupiedBy; }).length;
      }, 0);
    }

    /* ---------------------------------------------------------------- */
    /* 修正值 / 科技                                                     */
    /* ---------------------------------------------------------------- */
    computeMods(e) {
      const m = {};
      const add = function (src, factor) {
        if (!src) return;
        factor = factor === undefined ? 1 : factor;
        Object.keys(src).forEach(function (k) {
          if (k === 'mods') { add(src.mods, factor); return; }
          if (typeof src[k] !== 'number') return;
          m[k] = (m[k] || 0) + src[k] * factor;
        });
      };
      const trait = SM.TRAITS[e.trait];
      if (trait) add(trait.effects);
      const self = this;
      Object.keys(e.techs).forEach(function (id) {
        const t = SM.ALL_TECHS[id];
        if (!t) return;
        const n = (e.techCounts && e.techCounts[id]) || 1;
        add(t.effects, n);
      });
      e.traditions.forEach(function (id) {
        const t = SM.TRADITION_BY_ID[id];
        if (t) add(t.effects);
      });
      if (e.mods && e.mods._permanent) add(e.mods._permanent);
      // 永久事件加成
      if (e.permanentMods) add(e.permanentMods);
      const pers = e.personality ? SM.AI_PERSONALITIES[e.personality] : null;
      if (pers) m.researchMult = (m.researchMult || 0) + (pers.research - 1);
      return m;
    }
    hasShipClass(e, cls) {
      const def = SM.SHIPS[cls];
      if (!def.req) return true;
      return !!e.techs[def.req];
    }
    maxStarbaseLevel(e) {
      let lvl = 1;
      Object.keys(e.techs).forEach(function (id) {
        const t = SM.ALL_TECHS[id];
        if (t && t.starbaseLevel) lvl = Math.max(lvl, t.starbaseLevel);
      });
      return lvl;
    }
    techAvailable(e, t) {
      if (e.techs[t.id] && !t.repeatable) return false;
      for (let i = 0; i < t.req.length; i++) if (!e.techs[t.req[i]]) return false;
      if (t.repeatable) {
        let n = 0;
        Object.keys(e.techs).forEach(function (id) {
          const other = SM.ALL_TECHS[id];
          if (other && other.cat === t.cat && !other.repeatable) n++;
        });
        if (n < 9) return false;
      }
      return true;
    }
    drawTechOptions(e, cat) {
      const pool = SM.TECHS[cat].filter(this.techAvailable.bind(this, e));
      const options = [];
      const local = pool.slice();
      for (let n = 0; n < 3 && local.length; n++) {
        let total = 0;
        local.forEach(function (t) { total += Math.max(1, 8 - t.tier); });
        let r = this.rng.next() * total;
        let idx = 0;
        for (let i = 0; i < local.length; i++) {
          r -= Math.max(1, 8 - local[i].tier);
          if (r <= 0) { idx = i; break; }
        }
        options.push(local[idx].id);
        local.splice(idx, 1);
      }
      e.research[cat].options = options;
      return options;
    }
    selectResearch(e, cat, techId) {
      const r = e.research[cat];
      if (!r) return { ok: false, reason: '无效领域' };
      if (r.options.indexOf(techId) < 0) return { ok: false, reason: '该科技不在可选项中' };
      if (r.current === techId) return { ok: true };
      const switching = !!r.current;
      if (switching) r.progress = Math.floor(r.progress * 0.5);
      r.current = techId;
      e.research[cat] = r;
      return { ok: true, switched: switching };
    }
    aiPickResearch(e, cat) {
      const r = e.research[cat];
      if (!r || r.current || !r.options || !r.options.length) return;
      const opts = r.options.slice();
      // 工程学优先舰船，其他随机
      let pick = opts[Math.floor(this.rng.next() * opts.length)];
      if (cat === 'engineering') {
        const ships = opts.filter(function (id) { return SM.ALL_TECHS[id].unlockShip; });
        if (ships.length && this.rng.chance(0.65)) pick = ships[0];
      }
      r.current = pick;
      r.progress = 0;
    }
    advanceResearch(e) {
      const self = this;
      CATS.forEach(function (cat) {
        const r = e.research[cat];
        if (!r.current) return;
        const tech = SM.ALL_TECHS[r.current];
        if (!tech) { r.current = null; return; }
        r.progress += Math.max(0, e.income[cat] || 0);
        if (r.progress >= tech.cost) {
          e.techs[tech.id] = true;
          e.techCounts = e.techCounts || {};
          e.techCounts[tech.id] = (e.techCounts[tech.id] || 0) + 1;
          e.stats.techs++;
          self.state.stats.techsResearched++;
          r.progress = 0;
          r.current = null;
          e.mods = self.computeMods(e);
          self.drawTechOptions(e, cat);
          if (e.isPlayer) {
            self.notice('tech', '研究完成：' + tech.name + '。请选择新的研究项目。', { icon: tech.icon, autoPause: true, cat: cat });
          }
        }
      });
    }
    traditionCost(e, t) {
      return Math.round(t.cost * (1 + 0.6 * e.traditions.length));
    }
    buyTradition(e, id) {
      const t = SM.TRADITION_BY_ID[id];
      if (!t) return { ok: false, reason: '无效的传统' };
      if (e.traditions.indexOf(id) >= 0) return { ok: false, reason: '已采纳' };
      if (t.req) {
        for (let i = 0; i < t.req.length; i++) if (e.traditions.indexOf(t.req[i]) < 0) return { ok: false, reason: '需要先采纳前置传统' };
      }
      const cost = this.traditionCost(e, t);
      if (e.resources.unity < cost) return { ok: false, reason: '凝聚力不足（需要 ' + cost + '）' };
      e.resources.unity -= cost;
      e.traditions.push(id);
      e.mods = this.computeMods(e);
      this.refreshEconomy(e);
      this.notice('info', '采纳传统：' + t.name, { icon: t.icon, empireId: e.id });
      return { ok: true };
    }

    /* ---------------------------------------------------------------- */
    /* 岗位分配与收入                                                    */
    /* ---------------------------------------------------------------- */
    rebalanceJobs(e) {
      const self = this;
      const colonies = e.colonies.map(function (id) { return self.colony(id); })
        .filter(function (c) { return c && !c.occupiedBy; });
      const pools = {};
      SM.JOB_ORDER.forEach(function (j) { pools[j] = []; });
      let totalPops = 0;
      colonies.forEach(function (c) {
        c.assigned = {};
        c.jobSlots = self.colonyJobs(c);
        totalPops += c.pops;
        Object.keys(c.jobSlots).forEach(function (j) {
          if (!pools[j]) pools[j] = [];
          if (c.jobSlots[j] > 0) pools[j].push({ c: c, free: c.jobSlots[j] });
        });
      });

      let remaining = totalPops;
      const assignedTotals = {};
      function assign(job, count) {
        let done = 0;
        const pool = pools[job] || [];
        for (let i = 0; i < pool.length && count > 0 && remaining > 0; i++) {
          const slot = pool[i];
          const taken = Object.keys(slot.c.assigned).reduce(function (a, k) { return a + slot.c.assigned[k]; }, 0);
          const room = slot.c.pops - taken;
          const take = Math.min(slot.free, count, remaining, room);
          if (take <= 0) continue;
          slot.c.assigned[job] = (slot.c.assigned[job] || 0) + take;
          slot.free -= take;
          done += take;
          count -= take;
          remaining -= take;
        }
        assignedTotals[job] = (assignedTotals[job] || 0) + done;
        return done;
      }
      function slotsLeft(job) {
        return (pools[job] || []).reduce(function (a, p) { return a + p.free; }, 0);
      }

      // 1. 行政官
      assign('admin', Infinity);
      // 2. 食物
      const foodNeed = totalPops * SM.BASE.popFoodUpkeep;
      const farmTarget = Math.ceil((foodNeed + 1) / SM.JOBS.farmer.out.food);
      assign('farmer', Math.min(farmTarget, slotsLeft('farmer')));
      // 3. 消费品
      const cgNeed = totalPops * SM.BASE.popCGUpkeep;
      const artTarget = Math.ceil((cgNeed + 1) / SM.JOBS.artisan.out.consumer_goods);
      assign('artisan', Math.min(artTarget, slotsLeft('artisan')));
      // 4. 能源（建筑 + 舰队维护）
      let upkeep = 0;
      colonies.forEach(function (c) {
        c.buildings.forEach(function (b) { upkeep += SM.BUILDINGS[b].upkeep || 0; });
        upkeep += SM.STARBASE_LEVELS[c.starbase.level].upkeep;
      });
      upkeep += this.fleetUpkeep(e.id);
      const techTarget = Math.max(0, Math.ceil((upkeep - SM.BASE.energy) / SM.JOBS.technician.out.energy));
      assign('technician', Math.min(techTarget, slotsLeft('technician')));
      // 5. 其余按优先级填充（带软上限，避免极端分配）
      const researchCap = Math.ceil(totalPops * 0.4);
      const alloyCap = Math.ceil(totalPops * 0.25);
      const fillCaps = {
        researcher: researchCap,
        metallurgist: alloyCap,
        farmer: farmTarget + 1,
        artisan: artTarget + 1
      };
      const fill = ['miner', 'technician', 'researcher', 'metallurgist', 'clerk', 'farmer', 'artisan', 'entertainer', 'bureaucrat', 'soldier'];
      let guard = 0;
      while (remaining > 0 && guard < 500) {
        guard++;
        let moved = false;
        for (let i = 0; i < fill.length && remaining > 0; i++) {
          const job = fill[i];
          if (fillCaps[job] !== undefined && (assignedTotals[job] || 0) >= fillCaps[job]) continue;
          if (slotsLeft(job) > 0 && assign(job, 1)) moved = true;
        }
        if (!moved) break;
      }
      colonies.forEach(function (c) {
        const assigned = Object.keys(c.assigned).reduce(function (a, k) { return a + c.assigned[k]; }, 0);
        c.unemployed = Math.max(0, c.pops - assigned);
        const housing = self.colonyHousing(c);
        c.overcrowded = c.pops > housing;
        c.defenseMax = self.colonyDefenseMax(c);
        if (c.defense > c.defenseMax) c.defense = c.defenseMax;
      });
      e.unemployed = colonies.reduce(function (a, c) { return a + c.unemployed; }, 0);
      e.housingShortage = colonies.some(function (c) { return c.overcrowded; });
      e.totalPops = totalPops;
    }

    computeIncome(e) {
      const self = this;
      const inc = zeroIncome();
      const diff = SM.DIFFICULTY[this.state.difficulty] || SM.DIFFICULTY.normal;
      const aiMult = e.isPlayer ? 1 : diff.aiIncome;
      const m = e.mods;
      const mult = {
        energy: 1 + (m.energyMult || 0),
        minerals: 1 + (m.mineralsMult || 0),
        food: 1 + (m.foodMult || 0),
        alloys: 1 + (m.alloysMult || 0),
        consumer_goods: 1 + (m.cgMult || 0),
        influence: 1 + (m.influenceMult || 0),
        unity: 1 + (m.unityMult || 0),
        research: 1 + (m.researchMult || 0)
      };
      let energy = SM.BASE.energy, minerals = 0, food = 0, alloys = 0, cg = 0;
      let influence = SM.BASE.influence, unity = SM.BASE.unity;
      let phy = 0, soc = 0, eng = 0;
      let popCount = 0, buildingUpkeep = 0;
      const addJob = function (res, v) {
        if (res === 'energy') energy += v;
        else if (res === 'minerals') minerals += v;
        else if (res === 'food') food += v;
        else if (res === 'alloys') alloys += v;
        else if (res === 'consumer_goods') cg += v;
        else if (res === 'influence') influence += v;
        else if (res === 'unity') unity += v;
        else if (res === 'physics') phy += v;
        else if (res === 'society') soc += v;
        else if (res === 'engineering') eng += v;
      };
      e.colonies.forEach(function (cid) {
        const c = self.colony(cid);
        if (!c || c.occupiedBy) return;
        popCount += c.pops;
        c.buildings.forEach(function (bid) {
          const def = SM.BUILDINGS[bid];
          if (def) buildingUpkeep += def.upkeep || 0;
        });
        buildingUpkeep += SM.STARBASE_LEVELS[c.starbase.level].upkeep;
        Object.keys(c.assigned || {}).forEach(function (job) {
          const count = c.assigned[job];
          if (!count) return;
          const out = SM.JOBS[job].out;
          Object.keys(out).forEach(function (res) { addJob(res, out[res] * count); });
        });
      });
      // 空间站
      this.state.systems.forEach(function (sys) {
        if (sys.owner !== e.id) return;
        ['mining', 'research'].forEach(function (type) {
          const st = sys.stations[type];
          if (!st || !st.built || st.owner !== e.id) return;
          if (type === 'mining') {
            energy += sys.deposits.energy;
            minerals += sys.deposits.minerals;
          } else {
            const r = sys.deposits.research;
            phy += r / 3; soc += r / 3; eng += r / 3;
          }
        });
      });
      const fleetUp = this.fleetUpkeep(e.id);
      const totalUpkeep = buildingUpkeep + fleetUp;
      energy = energy * mult.energy * aiMult - totalUpkeep;
      minerals = minerals * mult.minerals * aiMult;
      food = food * mult.food * aiMult - popCount * SM.BASE.popFoodUpkeep;
      cg = cg * mult.consumer_goods * aiMult - popCount * SM.BASE.popCGUpkeep;
      alloys = alloys * mult.alloys * aiMult;
      influence = influence * mult.influence * aiMult;
      unity = unity * mult.unity * aiMult;
      // 失业惩罚
      const unemployed = e.unemployed || 0;
      unity -= unemployed * 0.25;
      phy *= mult.research * aiMult;
      soc *= mult.research * aiMult;
      eng *= mult.research * aiMult;
      // 上月短缺的惩罚：研究员与工匠士气低落
      if (e.shortage && e.shortage.consumer_goods) {
        phy *= 0.8; soc *= 0.8; eng *= 0.8;
        unity *= 0.5;
      }
      if (e.shortage && e.shortage.energy) {
        phy *= 0.8; soc *= 0.8; eng *= 0.8;
      }
      inc.energy = energy; inc.minerals = minerals; inc.food = food;
      inc.alloys = alloys; inc.consumer_goods = cg;
      inc.influence = influence; inc.unity = Math.max(0, unity);
      inc.physics = phy; inc.society = soc; inc.engineering = eng;
      e.income = inc;
      e.upkeep = { energy: totalUpkeep, buildings: buildingUpkeep, fleets: fleetUp };
      e.popCount = popCount;
      return inc;
    }

    refreshEconomy(e) {
      if (!e || !e.alive) return;
      this.rebalanceJobs(e);
      this.computeIncome(e);
    }

    applyIncome(e) {
      const r = e.resources;
      const inc = e.income;
      const keys = ['energy', 'minerals', 'food', 'alloys', 'consumer_goods', 'influence', 'unity'];
      const shortages = {};
      keys.forEach(function (k) {
        const before = r[k] || 0;
        r[k] = Math.max(0, before + inc[k]);
        if (inc[k] < -0.0001) shortages[k] = true;
      });
      // 食物短缺：首都会饿死人
      if (r.food <= 0 && inc.food < 0) {
        const cap = e.capital ? this.colony(e.capital) : null;
        if (cap && cap.pops > 2 && this.rng.chance(0.25)) {
          cap.pops--;
          if (e.isPlayer) this.notice('economy', '食物短缺导致首都出现饥荒，人口 -1。', { icon: '⚠', autoPause: true });
        }
      }
      e.shortage = {
        food: inc.food < -0.01,
        energy: inc.energy < -0.01,
        consumer_goods: inc.consumer_goods < -0.01
      };
    }

    monthlyPopulation(e) {
      const self = this;
      const foodPositive = (e.income.food || 0) > 0;
      e.colonies.forEach(function (cid) {
        const c = self.colony(cid);
        if (!c || c.occupiedBy) return;
        const housing = self.colonyHousing(c);
        let rate = SM.BASE.popGrowthBase * (1 + (e.mods.popGrowthMult || 0));
        if (foodPositive) rate *= 1.1;
        if (e.shortage && e.shortage.food) rate *= 0.5;
        if (e.shortage && e.shortage.energy) rate *= 0.7;
        if (c.pops >= housing) rate *= 0.3;
        if (c.pops >= housing + 3) rate *= 0.2;
        c.buildings.forEach(function (b) { if (SM.BUILDINGS[b].growth) rate += SM.BUILDINGS[b].growth; });
        // 殖民地前 20 年增长更快
        if (self.state.day - (c.foundedDay || 0) < 20 * SM.DAYS_PER_YEAR) rate *= 1.5;
        c.growth = (c.growth || 0) + rate;
        while (c.growth >= SM.BASE.growthCost && c.pops < 120) {
          c.growth -= SM.BASE.growthCost;
          c.pops++;
          if (self.state.day - (c.foundedDay || 0) > 30) {
            // 新人口带来一点小提示
          }
        }
      });
    }

    /* ---------------------------------------------------------------- */
    /* 殖民地                                                            */
    /* ---------------------------------------------------------------- */
    createColony(planet, empire, opts) {
      opts = opts || {};
      const sys = this.planetSystem(planet.id);
      const state = this.state;
      const colony = {
        id: 'c' + (state.nextId.colony++),
        systemId: sys.id,
        planetId: planet.id,
        owner: empire.id,
        name: opts.name || planet.name,
        pops: opts.pops || 3,
        growth: opts.pops ? 45 : 15,
        districts: opts.homeworld ? { city: 2, generator: 2, mining: 2, agri: 2 } : { city: 1, generator: 0, mining: 0, agri: 0 },
        buildings: opts.homeworld ? ['capital', 'lab', 'foundry', 'factory'] : ['capital'],
        queue: [],
        shipQueue: [],
        defense: 0,
        defenseMax: 0,
        occupiedBy: null,
        starbase: { level: 1, hull: 320, hullMax: 320, shield: 0, shieldMax: 0 },
        assigned: {},
        jobSlots: {},
        unemployed: 0,
        foundedDay: state.day,
        bombedDay: -9999
      };
      colony.defenseMax = this.colonyDefenseMax(colony);
      colony.defense = colony.defenseMax;
      state.colonies.push(colony);
      empire.colonies.push(colony.id);
      planet.colonyId = colony.id;
      sys.colonyId = colony.id;
      sys.owner = empire.id;
      sys.surveyed[empire.id] = true;
      if (sys.anomaly) sys.anomalyKnown[empire.id] = true;
      empire.stats.coloniesFounded++;
      state.stats.coloniesFounded++;
      this.refreshEconomy(empire);
      return colony;
    }

    colonyDefenseMax(c) {
      let def = 250 + c.pops * 6;
      c.buildings.forEach(function (b) {
        if (SM.BUILDINGS[b] && SM.BUILDINGS[b].defense) def += SM.BUILDINGS[b].defense;
      });
      Object.keys(c.assigned || {}).forEach(function (j) {
        if (SM.JOBS[j] && SM.JOBS[j].defense) def += SM.JOBS[j].defense * c.assigned[j];
      });
      return Math.round(def);
    }

    buildDistrict(colonyId, key) {
      const c = this.colony(colonyId);
      const e = c ? this.empire(c.owner) : null;
      if (!c || !e || c.occupiedBy) return { ok: false, reason: '无效的殖民地' };
      const def = SM.DISTRICTS[key];
      if (!def) return { ok: false, reason: '无效的区划' };
      const max = this.colonyMaxDistricts(c)[key] || 0;
      const queued = c.queue.filter(function (q) { return q.type === 'district' && q.key === key; }).length;
      if ((c.districts[key] || 0) + queued >= max) return { ok: false, reason: '已达到该区划上限' };
      if (c.queue.length >= 6) return { ok: false, reason: '建造队列已满' };
      const cost = this.districtCost(e, key);
      if (e.resources.minerals < cost) return { ok: false, reason: '矿物不足（需要 ' + cost + '）' };
      const days = this.buildDays(e, def.time);
      e.resources.minerals -= cost;
      c.queue.push({ type: 'district', key: key, days: days, daysLeft: days, cost: cost, name: def.name });
      this.notice('info', c.name + ' 开始建造：' + def.name, { icon: def.icon, empireId: e.id, systemId: c.systemId });
      return { ok: true };
    }

    cancelBuild(colonyId, index) {
      const c = this.colony(colonyId);
      const e = c ? this.empire(c.owner) : null;
      if (!c || !e) return { ok: false, reason: '无效的殖民地' };
      const q = c.queue[index];
      if (!q) return { ok: false, reason: '建造项不存在' };
      c.queue.splice(index, 1);
      const refund = Math.floor((q.cost || 0) * 0.5);
      e.resources.minerals += refund;
      this.notice('info', c.name + ' 取消建造：' + q.name + '（返还 ' + refund + ' 矿物）', { icon: '↩', empireId: e.id, systemId: c.systemId });
      return { ok: true, refund: refund };
    }

    buildBuilding(colonyId, key) {
      const c = this.colony(colonyId);
      const e = c ? this.empire(c.owner) : null;
      if (!c || !e || c.occupiedBy) return { ok: false, reason: '无效的殖民地' };
      const def = SM.BUILDINGS[key];
      if (!def) return { ok: false, reason: '无效的建筑' };
      if (def.unique) return { ok: false, reason: '该建筑无法重复建造' };
      if (def.req && !e.techs[def.req]) return { ok: false, reason: '尚未解锁该建筑' };
      if (c.buildings.indexOf(key) >= 0 && !def.repeatable) return { ok: false, reason: '每个殖民地只能建造一座' };
      if (!def.repeatable && c.queue.some(function (q) { return q.type === 'building' && q.key === key; })) return { ok: false, reason: '该建筑已在建造队列中' };
      const queuedB = c.queue.filter(function (q) { return q.type === 'building'; }).length;
      if (this.colonyUsedBuildingSlots(c) + queuedB >= this.colonyBuildingSlots(c)) return { ok: false, reason: '建筑位不足（建造城市区划可增加）' };
      if (c.queue.length >= 6) return { ok: false, reason: '建造队列已满' };
      const cost = this.buildingCost(e, key);
      if (e.resources.minerals < cost) return { ok: false, reason: '矿物不足（需要 ' + cost + '）' };
      const days = this.buildDays(e, def.time);
      e.resources.minerals -= cost;
      c.queue.push({ type: 'building', key: key, days: days, daysLeft: days, cost: cost, name: def.name });
      this.notice('info', c.name + ' 开始建造：' + def.name, { icon: def.icon, empireId: e.id, systemId: c.systemId });
      return { ok: true };
    }

    buildDays(e, days) {
      return Math.max(10, Math.round(days / (1 + (e.mods.buildSpeedMult || 0))));
    }

    districtCost(e, key) {
      return Math.max(10, Math.round(SM.DISTRICTS[key].cost * (1 + (e.mods.districtCostMult || 0))));
    }
    buildingCost(e, key) {
      return Math.max(10, Math.round(SM.BUILDINGS[key].cost * (1 + (e.mods.buildingCostMult || 0))));
    }
    stationCost(e) {
      return Math.max(10, Math.round(80 * (1 + (e.mods.stationCostMult || 0))));
    }
    shipCost(e, cls) {
      return Math.max(1, Math.round(SM.SHIPS[cls].cost * (1 + (e.mods.shipCostMult || 0))));
    }
    colonyShipCost(e) {
      return {
        alloys: Math.max(10, Math.round(100 * (1 + (e.mods.colonyCostMult || 0)))),
        influence: Math.max(10, Math.round(40 * (1 + (e.mods.colonyCostMult || 0) * 0.5)))
      };
    }

    upgradeStarbase(colonyId) {
      const c = this.colony(colonyId);
      const e = c ? this.empire(c.owner) : null;
      if (!c || !e || c.occupiedBy) return { ok: false, reason: '无效的殖民地' };
      const next = c.starbase.level + 1;
      if (next > 3) return { ok: false, reason: '已达最高等级' };
      if (this.maxStarbaseLevel(e) < next) return { ok: false, reason: '需要研究「' + SM.STARBASE_LEVELS[next].name + '」相关科技' };
      if (c.starbase.upgrading) return { ok: false, reason: '正在升级中' };
      const cost = SM.STARBASE_LEVELS[next].upgradeCost.alloys;
      if (e.resources.alloys < cost) return { ok: false, reason: '合金不足（需要 ' + cost + '）' };
      e.resources.alloys -= cost;
      c.starbase.upgrading = { days: SM.STARBASE_LEVELS[next].upgradeCost.days, daysLeft: SM.STARBASE_LEVELS[next].upgradeCost.days, next: next };
      this.notice('info', c.name + ' 的星际基地开始升级。', { icon: '🏰', empireId: e.id, systemId: c.systemId });
      return { ok: true };
    }

    /* ---------------------------------------------------------------- */
    /* 舰队                                                              */
    /* ---------------------------------------------------------------- */
    makeShip(cls, empire) {
      const def = SM.SHIPS[cls];
      const e = empire || null;
      const m = e ? e.mods : {};
      const hullMax = Math.max(1, Math.round(def.hull * (1 + (m.shipHullMult || 0))));
      const shieldMax = Math.max(0, Math.round(def.shield * (1 + (m.shipShieldMult || 0))));
      return {
        id: 'sh' + (this.state.nextId.ship++),
        cls: cls,
        hull: hullMax,
        hullMax: hullMax,
        shield: shieldMax,
        shieldMax: shieldMax,
        armor: def.armor,
        damage: def.damage,
        evasion: def.evasion,
        power: def.power
      };
    }

    nextFleetName(e) {
      this.state.fleetNum[e.id] = (this.state.fleetNum[e.id] || 0) + 1;
      return '第' + this.state.fleetNum[e.id] + '舰队';
    }

    createFleet(empire, systemId, ships, opts) {
      opts = opts || {};
      const fleet = {
        id: 'f' + (this.state.nextId.fleet++),
        owner: empire ? empire.id : null,
        name: opts.name || (empire ? this.nextFleetName(empire) : '未知舰队'),
        kind: opts.kind || 'combat',
        neutral: !!opts.neutral,
        systemId: systemId,
        ships: ships,
        travel: null,
        path: [],
        mission: null,
        auto: !!opts.auto,
        lastOrderDay: -9999
      };
      this.state.fleets.push(fleet);
      if (empire) empire.fleets.push(fleet.id);
      return fleet;
    }

    removeFleet(f) {
      const idx = this.state.fleets.indexOf(f);
      if (idx >= 0) this.state.fleets.splice(idx, 1);
      if (f.owner) {
        const e = this.empire(f.owner);
        if (e) {
          const i = e.fleets.indexOf(f.id);
          if (i >= 0) e.fleets.splice(i, 1);
        }
      }
      if (this.state.selectedFleet === f.id) this.state.selectedFleet = null;
    }

    buildShip(colonyId, cls, count) {
      const c = this.colony(colonyId);
      const e = c ? this.empire(c.owner) : null;
      if (!c || !e || c.occupiedBy) return { ok: false, reason: '无效的殖民地' };
      if (!this.hasShipClass(e, cls)) return { ok: false, reason: '尚未解锁该舰船' };
      if (c.shipQueue.length >= 8) return { ok: false, reason: '造船队列已满' };
      count = Math.max(1, Math.min(8, count || 1));
      const unit = this.shipCost(e, cls);
      const total = unit * count;
      if (e.resources.alloys < total) return { ok: false, reason: '合金不足（需要 ' + total + '）' };
      e.resources.alloys -= total;
      const days = Math.round(SM.SHIPS[cls].days);
      for (let i = 0; i < count; i++) {
        c.shipQueue.push({ cls: cls, days: days, daysLeft: days, cost: unit, name: SM.SHIPS[cls].name });
      }
      this.notice('info', c.name + ' 开始建造 ' + count + ' 艘' + SM.SHIPS[cls].name + '。', { icon: SM.SHIPS[cls].icon, empireId: e.id, systemId: c.systemId });
      return { ok: true };
    }

    canColonizeCheck(planet, empire, excludeFleet) {
      if (!planet || !planet.habitable) return { ok: false, reason: '不可居住' };
      if (planet.colonyId) return { ok: false, reason: '已有殖民地' };
      const sys = this.planetSystem(planet.id);
      if (!sys) return { ok: false, reason: '无效星系' };
      if (!sys.surveyed[empire.id]) return { ok: false, reason: '尚未调查该星系' };
      if (sys.owner && sys.owner !== empire.id) return { ok: false, reason: '该星系属于其他帝国' };
      if (sys.colonyId) return { ok: false, reason: '该星系已有殖民地' };
      const owned = this.ownedSystems(empire.id).map(function (s) { return s.id; });
      const reach = SM.Galaxy.reach(this.state.systems, owned, SM.COLONY_RANGE);
      if (reach.indexOf(sys.id) < 0 && sys.owner !== empire.id) return { ok: false, reason: '超出殖民范围（需在领土 ' + SM.COLONY_RANGE + ' 跳以内）' };
      const busy = this.state.fleets.some(function (f) {
        if (excludeFleet && f.id === excludeFleet.id) return false;
        return f.owner === empire.id && f.kind === 'colony' &&
          (f.mission && f.mission.planetId === planet.id);
      });
      if (busy) return { ok: false, reason: '已有殖民船前往' };
      const queued = this.state.colonies.some(function (cc) {
        return cc.owner === empire.id && cc.shipQueue.some(function (q) { return q.cls === 'colony' && q.targetPlanetId === planet.id; });
      });
      if (queued) return { ok: false, reason: '已有殖民船在建造' };
      return { ok: true };
    }

    orderColonize(planetId, empireId) {
      const e = this.empire(empireId || this.player().id);
      if (!e) return { ok: false, reason: '无效帝国' };
      const planet = this.planet(planetId);
      const check = this.canColonizeCheck(planet, e);
      if (!check.ok) return check;
      const cost = this.colonyShipCost(e);
      if (e.resources.alloys < cost.alloys) return { ok: false, reason: '合金不足（需要 ' + cost.alloys + '）' };
      if (e.resources.influence < cost.influence) return { ok: false, reason: '影响力不足（需要 ' + cost.influence + '）' };
      const cap = this.colony(e.capital);
      if (!cap || cap.occupiedBy) {
        const any = e.colonies.map(this.colony.bind(this)).find(function (c) { return c && !c.occupiedBy; });
        if (!any) return { ok: false, reason: '没有可用的造船殖民地' };
        e.capital = any.id;
      }
      const yard = this.colony(e.capital);
      if (yard.shipQueue.length >= 8) return { ok: false, reason: '造船队列已满' };
      e.resources.alloys -= cost.alloys;
      e.resources.influence -= cost.influence;
      yard.shipQueue.push({
        cls: 'colony',
        days: SM.SHIPS.colony.days,
        daysLeft: SM.SHIPS.colony.days,
        cost: cost.alloys,
        targetPlanetId: planetId,
        name: '殖民船'
      });
      this.notice('colony', '殖民船开始建造：目标 ' + planet.name + '。', { icon: '🌱', empireId: e.id, systemId: yard.systemId });
      return { ok: true };
    }

    moveFleet(f, targetSystemId, silent) {
      if (!f || !f.ships.length) return { ok: false, reason: '舰队不存在' };
      if (f.systemId === targetSystemId && !f.travel) { f.path = []; f.mission = null; return { ok: true }; }
      const from = f.travel ? f.travel.to : f.systemId;
      const path = SM.Galaxy.path(this.state.systems, from, targetSystemId);
      if (!path) return { ok: false, reason: '无法抵达（超空间航道不通）' };
      // 敌对舰队挡路则停下
      f.mission = null;
      f.path = path.slice(1);
      if (!f.travel && f.path.length) this.startNextTravel(f);
      f.lastOrderDay = this.state.day;
      if (!silent && f.owner === this.player().id) {
        const sys = this.system(targetSystemId);
        this.notice('info', f.name + ' 前往 ' + (sys ? sys.name : targetSystemId), { icon: '🚀' });
      }
      return { ok: true };
    }

    startNextTravel(f) {
      if (!f.path.length) return;
      const to = f.path[0];
      const fromSys = this.system(f.systemId);
      const toSys = this.system(to);
      if (!fromSys || !toSys) { f.path = []; return; }
      const dist = SM.distance(fromSys, toSys);
      const speed = this.fleetSpeed(f);
      const days = Math.max(4, Math.round((8 + dist / 26) / speed));
      f.travel = { from: f.systemId, to: to, total: days, progress: 0 };
      f.path.shift();
    }

    mergeFleets(fleetId, otherId) {
      const a = this.fleet(fleetId);
      const b = this.fleet(otherId);
      if (!a || !b || a.owner !== b.owner) return { ok: false, reason: '无法合并' };
      if (a.systemId !== b.systemId || a.travel || b.travel) return { ok: false, reason: '需在同一星系且未移动' };
      if (a.kind !== b.kind) return { ok: false, reason: '只能合并同类舰队' };
      a.ships = a.ships.concat(b.ships);
      this.removeFleet(b);
      return { ok: true };
    }

    /* ---------------------------------------------------------------- */
    /* 太空站与探索                                                      */
    /* ---------------------------------------------------------------- */
    canBuildStation(sys, type, empire) {
      if (!empire) return { ok: false, reason: '无效帝国' };
      if (!sys) return { ok: false, reason: '无效星系' };
      if (sys.core && this.state.fleets.some(function (f) { return f.systemId === sys.id && f.neutral; })) {
        return { ok: false, reason: '远古守卫仍在' };
      }
      const dep = sys.deposits || { energy: 0, minerals: 0, research: 0 };
      if (type === 'mining' && dep.energy + dep.minerals <= 0) return { ok: false, reason: '没有可开采的资源点' };
      if (type === 'research' && dep.research <= 0) return { ok: false, reason: '没有可研究的资源点' };
      if (sys.colonyId) return { ok: false, reason: '该星系已有殖民地' };
      const st = sys.stations[type];
      if (st && st.built) return { ok: false, reason: '该太空站已存在' };
      if (st && st.building) return { ok: false, reason: '正在建造中' };
      if (sys.owner && sys.owner !== empire.id) return { ok: false, reason: '该星系属于其他帝国' };
      const owned = this.ownedSystems(empire.id).map(function (s) { return s.id; });
      if (owned.length && sys.owner !== empire.id) {
        const reach = SM.Galaxy.reach(this.state.systems, owned, SM.LANE_RANGE);
        if (reach.indexOf(sys.id) < 0) return { ok: false, reason: '超出建造范围（' + SM.LANE_RANGE + ' 跳）' };
      }
      return { ok: true };
    }

    stationIncome(sys, type) {
      const dep = sys.deposits || { energy: 0, minerals: 0, research: 0 };
      if (type === 'mining') return { energy: dep.energy, minerals: dep.minerals };
      return { research: dep.research };
    }

    bestStationType(sys) {
      const dep = sys.deposits || { energy: 0, minerals: 0, research: 0 };
      if (dep.energy + dep.minerals > 0) return 'mining';
      if (dep.research > 0) return 'research';
      return null;
    }

    orderBuildStation(systemId, type, empireId) {
      const e = this.empire(empireId || this.player().id);
      const sys = this.system(systemId);
      if (!e || !sys) return { ok: false, reason: '无效目标' };
      const check = this.canBuildStation(sys, type, e);
      if (!check.ok) return check;
      const cost = this.stationCost(e);
      if (e.resources.minerals < cost) return { ok: false, reason: '矿物不足（需要 ' + cost + '）' };
      // 找空闲工程船
      const ships = this.state.fleets.filter(function (f) { return f.owner === e.id && f.kind === 'construction' && f.ships.length; });
      if (!ships.length) return { ok: false, reason: '没有可用的工程船' };
      let ship = ships.find(function (f) { return f.systemId === systemId && !f.travel && !f.mission; });
      if (!ship) {
        ship = ships.filter(function (f) { return !f.mission; }).sort(function (a, b) {
          return (a.travel ? 1 : 0) - (b.travel ? 1 : 0);
        })[0];
      }
      if (!ship) return { ok: false, reason: '工程船正忙，请稍后再试' };
      ship.mission = { type: 'travelBuild', targetId: systemId, stationType: type, paid: false };
      const from = ship.travel ? ship.travel.to : ship.systemId;
      const path = SM.Galaxy.path(this.state.systems, from, systemId);
      if (!path) { ship.mission = null; return { ok: false, reason: '无法抵达' }; }
      ship.path = path.slice(1);
      if (!ship.travel && ship.path.length) this.startNextTravel(ship);
      this.notice('info', '工程船前往 ' + sys.name + ' 建造' + (type === 'mining' ? '采矿站' : '研究站') + '。', { icon: '🚧', empireId: e.id });
      return { ok: true };
    }

    startSurvey(f, e) {
      const sys = this.system(f.systemId);
      if (!sys || sys.surveyed[e.id]) return false;
      const days = Math.max(15, Math.round((20 + sys.planets.length * 8) / (1 + (e.mods.surveySpeedMult || 0))));
      f.mission = { type: 'survey', systemId: sys.id, days: days, progress: 0 };
      return true;
    }

    finishSurvey(f, e) {
      const sys = this.system(f.mission.systemId);
      f.mission = null;
      if (!sys || sys.surveyed[e.id]) return;
      sys.surveyed[e.id] = true;
      sys.surveyCount = (sys.surveyCount || 0) + 1;
      // 调查奖励
      e.research.society.progress += 25;
      if (sys.anomaly && !sys.anomalyKnown[e.id]) {
        sys.anomalyKnown[e.id] = true;
        const anom = SM.ANOMALIES.find(function (a) { return a.id === sys.anomaly; });
        if (anom) {
          if (anom.reward) {
            Object.keys(anom.reward).forEach(function (k) {
              if (e.resources[k] !== undefined) e.resources[k] += anom.reward[k];
              else if (e.research[k]) e.research[k].progress += anom.reward[k];
              else e.resources[k] = (e.resources[k] || 0) + anom.reward[k];
            });
          }
          if (e.isPlayer) {
            const parts = Object.keys(anom.reward || {}).map(function (k) {
              const name = SM.RESOURCES[k] ? SM.RESOURCES[k].name : (SM.RESEARCH[k] ? SM.RESEARCH[k].name : k);
              return name + ' +' + anom.reward[k];
            }).join('，');
            this.notice('event', '异常现象「' + anom.title + '」：' + anom.text + ' 奖励：' + parts, { icon: anom.icon, systemId: sys.id, autoPause: true });
          }
        }
      }
      if (e.isPlayer) {
        const habitats = sys.planets.filter(function (pl) { return pl.habitable && !pl.colonyId; });
        if (habitats.length && !e.stats.firstHabitableNotified) {
          e.stats.firstHabitableNotified = true;
          this.notice('colony', '发现宜居世界：' + habitats[0].name + '（大小 ' + habitats[0].size + '）。打开「殖民目标」即可派遣殖民船。', {
            icon: '🌱', systemId: sys.id, planetId: habitats[0].id, firstHabitable: true, autoPause: true
          });
        } else if (habitats.length) {
          this.notice('colony', '发现宜居世界：' + habitats[0].name + '（' + sys.name + ' 星系）。', {
            icon: '🌱', systemId: sys.id, planetId: habitats[0].id
          });
        } else {
          this.notice('info', '已调查 ' + sys.name + '：发现 ' + sys.planets.length + ' 颗行星。', { icon: '🔭', systemId: sys.id });
        }
      }
    }

    startColonizing(f, e, planetId) {
      const planet = this.planet(planetId);
      if (!planet || planet.colonyId) return false;
      f.mission = { type: 'colonizing', planetId: planetId, days: 150, progress: 0 };
      return true;
    }

    finishColonizing(f, e) {
      const planet = this.planet(f.mission.planetId);
      f.mission = null;
      if (!planet || planet.colonyId) {
        this.notice('info', '殖民失败：目标星球已不可用。', { icon: '⚠', empireId: e.id, autoPause: e.isPlayer });
        this.removeFleet(f);
        return;
      }
      const rest = this.canColonizeCheck(planet, e, f);
      if (!rest.ok) {
        this.notice('info', '殖民失败：' + rest.reason, { icon: '⚠', empireId: e.id, autoPause: e.isPlayer });
        this.removeFleet(f);
        return;
      }
      const colony = this.createColony(planet, e, { pops: 3 });
      if (!f.owner || f.owner === e.id) this.removeFleet(f);
      if (e.isPlayer) {
        this.notice('colony', '新殖民地建立：' + colony.name + '！', { icon: '🌱', systemId: colony.systemId, autoPause: true });
      }
    }

    /* ---------------------------------------------------------------- */
    /* 每日推进                                                          */
    /* ---------------------------------------------------------------- */
    stepDay() {
      const s = this.state;
      if (s.gameOver && s.gameOver.type === 'defeat') return;
      s.day++;
      this.updateFleets();
      this.updateBattles();
      this.updateBombardment();
      this.updateRaids();
      this.updateColonies();
      this.updateStarbases();
      if (s.day % SM.DAYS_PER_MONTH === 0) this.monthly();
      this.checkGameEnd();
    }

    updateFleets() {
      const self = this;
      const fleets = this.state.fleets.slice();
      fleets.forEach(function (f) {
        if (!f.ships.length) { self.removeFleet(f); return; }
        if (f.travel) {
          f.travel.progress++;
          if (f.travel.progress >= f.travel.total) self.arrive(f);
          return;
        }
        if (f.mission) {
          const m = f.mission;
          if (m.type === 'survey' || m.type === 'colonizing') {
            m.progress++;
            if (m.progress >= m.days) {
              if (m.type === 'survey') self.finishSurvey(f, self.empire(f.owner));
              else self.finishColonizing(f, self.empire(f.owner));
            }
          } else if (m.type === 'building') {
            m.progress++;
            if (m.progress >= m.days) self.finishStation(f, self.empire(f.owner));
          }
        }
        if (!f.travel && !f.mission && f.auto && !f.neutral) {
          const e = self.empire(f.owner);
          if (!e || !e.alive) return;
          if (f.kind === 'science') self.autoScience(f, e);
          else if (f.kind === 'construction') self.autoConstruction(f, e);
          else if (f.kind === 'colony') self.autoColony(f, e);
        }
      });
    }

    arrive(f) {
      const s = this.state;
      f.systemId = f.travel.to;
      f.travel = null;
      const sys = this.system(f.systemId);
      if (!sys) return;
      const player = this.player();
      if (f.owner && player && f.kind === 'combat' && sys.owner === player.id && sys.colonyId &&
        this.isAtWar(f.owner, player.id) && f.lastWarnSystem !== sys.id) {
        f.lastWarnSystem = sys.id;
        this.notice('war', '敌军舰队进入 ' + sys.name + '！殖民地 ' + (this.colony(sys.colonyId) || {}).name + ' 正受到威胁。', {
          icon: '🚨', systemId: sys.id, autoPause: true, incoming: true
        });
      }
      // 抵达敌对星系：停止前进，准备战斗
      if (f.owner && this.systemHasHostileFleet(f.owner, sys)) {
        f.path = [];
        if (f.mission && f.mission.type !== 'colonizing') f.mission = null;
        if (f.owner === this.player().id) {
          this.notice('battle', f.name + ' 在 ' + sys.name + ' 遭遇敌对舰队！', { icon: '💥', systemId: sys.id, autoPause: true });
        }
        return;
      }
      if (!f.owner && this.fleetsIn(sys.id).some(function (o) { return o.owner !== null; })) {
        // 中立生物遇到入侵者，停下战斗即可
      }
      if (f.path.length) { this.startNextTravel(f); return; }
      this.onFleetIdle(f);
    }

    onFleetIdle(f) {
      const e = f.owner ? this.empire(f.owner) : null;
      if (!e) return;
      const m = f.mission;
      if (m) {
        if (m.type === 'travelBuild') {
          if (f.systemId !== m.targetId) {
            if (!f.path.length) {
              const path = SM.Galaxy.path(this.state.systems, f.systemId, m.targetId);
              if (!path) { f.mission = null; return; }
              f.path = path.slice(1);
              if (f.path.length) this.startNextTravel(f);
            }
            return;
          }
          const sys = this.system(f.systemId);
          const cost = this.stationCost(e);
          if (e.resources.minerals < cost) {
            f.mission = null;
            if (e.isPlayer) this.notice('info', '工程船无法开工：矿物不足。', { icon: '⚠', systemId: sys.id });
            return;
          }
          const check = this.canBuildStation(sys, m.stationType, e);
          if (!check.ok) {
            f.mission = null;
            if (e.isPlayer) this.notice('info', '无法建造太空站：' + check.reason, { icon: '⚠' });
            return;
          }
          e.resources.minerals -= cost;
          this.refreshEconomy(e);
          f.mission = { type: 'building', systemId: sys.id, stationType: m.stationType, days: 60, progress: 0 };
          sys.stations[m.stationType] = { owner: e.id, built: false, building: true, daysLeft: 60, startedDay: this.state.day };
          if (!sys.owner) sys.owner = e.id;
          return;
        }
        if (m.type === 'travelColonize') {
          const planet = this.planet(m.planetId);
          if (!planet || planet.colonyId || f.systemId !== m.systemId) {
            if (!planet || planet.colonyId) { f.mission = null; }
            return;
          }
          this.startColonizing(f, e, m.planetId);
          return;
        }
      }
      if (f.kind === 'science' && this.startSurvey(f, e)) return;
      if (f.auto) {
        if (f.kind === 'science') this.autoScience(f, e);
        else if (f.kind === 'construction') this.autoConstruction(f, e);
      }
    }

    finishStation(f, e) {
      const sys = this.system(f.mission.systemId);
      const type = f.mission.stationType;
      f.mission = null;
      if (!sys) return;
      const st = sys.stations[type];
      if (!st) return;
      st.built = true;
      st.building = false;
      st.daysLeft = 0;
      st.owner = e.id;
      sys.owner = e.id;
      this.refreshEconomy(e);
      if (e.isPlayer) {
        this.notice('info', sys.name + ' 的' + (type === 'mining' ? '采矿站' : '研究站') + '建成。', { icon: type === 'mining' ? '⛏' : '🔭', systemId: sys.id });
      }
    }

    /* ---------------------------------------------------------------- */
    /* 自动行为                                                          */
    /* ---------------------------------------------------------------- */
    autoScience(f, e) {
      if (this.state.day < (f.nextThink || 0)) return;
      f.nextThink = this.state.day + 4;
      const sys = this.system(f.systemId);
      if (!sys) return;
      // 当前星系未调查且安全
      if (!sys.surveyed[e.id] && !this.systemHasHostileFleet(e.id, sys) && this.startSurvey(f, e)) return;
      // 找下一个目标
      const self = this;
      const candidates = this.state.systems.filter(function (s) {
        return !s.surveyed[e.id] && !self.systemHasHostileFleet(e.id, s);
      });
      if (!candidates.length) {
        // 全调查完了：在首都待命
        const capSys = self.colony(e.capital);
        if (capSys && f.systemId !== capSys.systemId && !f.travel) self.moveFleet(f, capSys.systemId, true);
        return;
      }
      const startSys = this.system(f.systemId);
      let best = null, bestScore = Infinity, bestPath = null;
      candidates.forEach(function (s) {
        const path = SM.Galaxy.path(self.state.systems, f.systemId, s.id);
        if (!path) return;
        if (!self.pathSafe(e, path)) return;
        let score = path.length * 10 + SM.distance(startSys, s) / 400;
        if (s.planets.some(function (p) { return p.habitable; })) score -= 3;
        if (s.anomaly) score -= 2;
        if (score < bestScore) { bestScore = score; best = s; bestPath = path; }
      });
      if (best && bestPath) {
        f.mission = null;
        f.path = bestPath.slice(1);
        if (f.path.length) this.startNextTravel(f);
      }
    }

    autoConstruction(f, e) {
      if (f.mission) return;
      if (this.state.day < (f.nextThink || 0)) return;
      f.nextThink = this.state.day + 4;
      const self = this;
      const owned = this.ownedSystems(e.id).map(function (s) { return s.id; });
      if (!owned.length) return;
      const reach = SM.Galaxy.reach(this.state.systems, owned, SM.LANE_RANGE);
      const cost = this.stationCost(e);
      if (e.resources.minerals < cost) return;
      const candidates = [];
      this.state.systems.forEach(function (s) {
        if (s.owner && s.owner !== e.id) return;
        if (s.colonyId) return;
        if (s.owner !== e.id && reach.indexOf(s.id) < 0) return;
        if (self.systemHasHostileFleet(e.id, s)) return;
        const type = self.bestStationType(s);
        if (!type) return;
        if (s.stations[type] && s.stations[type].built) return;
        if (s.stations[type] && s.stations[type].building) return;
        const value = (s.deposits.energy + s.deposits.minerals + s.deposits.research * 0.8);
        const path = SM.Galaxy.path(self.state.systems, f.systemId, s.id);
        if (!path) return;
        if (!self.pathSafe(e, path)) return;
        const score = path.length * 10 - value + (s === self.system(f.systemId) ? -8 : 0);
        candidates.push({ sys: s, type: type, path: path, score: score });
      });
      candidates.sort(function (a, b) { return a.score - b.score; });
      const target = candidates[0];
      if (!target) return;
      f.mission = { type: 'travelBuild', targetId: target.sys.id, stationType: target.type, paid: false };
      f.path = target.path.slice(1);
      if (f.path.length) this.startNextTravel(f);
    }

    pathSafe(e, path) {
      for (let i = 0; i < path.length; i++) {
        const sys = this.system(path[i]);
        if (!sys) return false;
        if (this.systemHasHostileFleet(e.id, sys)) return false;
        if (sys.owner && sys.owner !== e.id && this.isAtWar(e.id, sys.owner)) return false;
      }
      return true;
    }

    autoColony(f, e) {
      const m = f.mission;
      if (!m) return;
      if (m.type === 'travelColonize') {
        if (f.systemId === m.systemId) {
          const planet = this.planet(m.planetId);
          if (planet && !planet.colonyId) this.startColonizing(f, e, m.planetId);
        }
        return;
      }
    }

    /* ---------------------------------------------------------------- */
    /* 战斗                                                              */
    /* ---------------------------------------------------------------- */
    isAtWar(a, b) {
      if (!a || !b || a === b) return false;
      return this.state.wars.some(function (w) {
        return (w.a === a && w.b === b) || (w.a === b && w.b === a);
      });
    }
    warBetween(a, b) {
      return this.state.wars.find(function (w) {
        return (w.a === a && w.b === b) || (w.a === b && w.b === a);
      }) || null;
    }
    warsFor(empire) {
      const id = typeof empire === 'string' ? empire : (empire && empire.id);
      return this.state.wars.filter(function (w) { return w.a === id || w.b === id; });
    }
    anyWar(e) { return this.state.wars.some(function (w) { return w.a === e.id || w.b === e.id; }); }
    hostileOwners(a, b) {
      if (a === b) return false;
      if (a === null || b === null) return true;
      return this.isAtWar(a, b);
    }

    systemHasHostileFleet(empireId, sys) {
      const self = this;
      return this.state.fleets.some(function (f) {
        if (f.systemId !== sys.id || f.travel) return false;
        if (f.owner === empireId) return false;
        if (f.owner === null) return f.kind === 'neutral';
        return self.isAtWar(empireId, f.owner);
      });
    }

    updateBattles() {
      const self = this;
      const bySystem = {};
      this.state.fleets.forEach(function (f) {
        if (f.travel || !f.ships.length) return;
        (bySystem[f.systemId] = bySystem[f.systemId] || []).push(f);
      });
      // 已结束的战斗
      this.state.systems.forEach(function (sys) {
        if (!sys.battle) return;
        if (!bySystem[sys.id]) { self.endBattle(sys, null); }
      });
      Object.keys(bySystem).forEach(function (sysId) {
        self.resolveBattle(self.system(sysId), bySystem[sysId]);
      });
    }

    battleSideOwner(f) { return f.owner; }

    resolveBattle(sys, fleets) {
      if (!sys) return;
      const self = this;
      const colonies = this.state.colonies.filter(function (c) { return c.systemId === sys.id && !c.occupiedBy; });
      const stations = colonies.filter(function (c) { return c.starbase.hull > 0; });
      // 是否有敌对关系
      let hasHostility = false;
      for (let i = 0; i < fleets.length && !hasHostility; i++) {
        for (let j = i + 1; j < fleets.length; j++) {
          if (self.hostileOwners(fleets[i].owner, fleets[j].owner)) { hasHostility = true; break; }
        }
      }
      if (!hasHostility) {
        for (let i = 0; i < fleets.length && !hasHostility; i++) {
          for (let j = 0; j < stations.length; j++) {
            if (self.hostileOwners(fleets[i].owner, stations[j].owner)) { hasHostility = true; break; }
          }
        }
      }
      if (!hasHostility) {
        if (sys.battle) this.endBattle(sys, '所有敌对目标已消失');
        return;
      }
      if (!sys.battle) {
        sys.battle = {
          startDay: this.state.day,
          log: [],
          playerSide: false,
          ships: fleets.reduce(function (a, f) { return a + f.ships.length; }, 0)
        };
        this.state.stats.battles++;
        const playerInv = fleets.some(function (f) { return f.owner === this.player().id; }, this) ||
          stations.some(function (c) { return c.owner === this.player().id; }, this);
        sys.battle.playerSide = playerInv;
        if (playerInv) {
          this.notice('battle', '战斗爆发：' + sys.name + '！', { icon: '💥', systemId: sys.id, autoPause: true });
        }
      }
      const battle = sys.battle;
      battle.duration = this.state.day - battle.startDay;

      // 构建射击者与目标
      const targets = [];
      fleets.forEach(function (f) {
        f.ships.forEach(function (s) { targets.push({ kind: 'ship', fleet: f, ship: s, owner: f.owner }); });
      });
      stations.forEach(function (c) {
        targets.push({ kind: 'station', colony: c, owner: c.owner });
      });
      const shots = [];
      fleets.forEach(function (f) {
        f.ships.forEach(function (s) { if (s.damage > 0) shots.push({ owner: f.owner, ship: s }); });
      });
      stations.forEach(function (c) {
        const def = SM.STARBASE_LEVELS[c.starbase.level];
        shots.push({ owner: c.owner, station: c, damage: def.damage });
      });

      shots.forEach(function (shot) {
        // 找敌人
        const enemies = targets.filter(function (t) {
          return self.hostileOwners(shot.owner, t.owner) && !((t.kind === 'ship') && t.ship.hull <= 0);
        });
        if (!enemies.length) return;
        const target = enemies[Math.floor(self.rng.next() * enemies.length)];
        let dmg = (shot.station ? shot.damage : shot.ship.damage) * (0.85 + self.rng.next() * 0.3);
        if (shot.owner) {
          const e = self.empire(shot.owner);
          if (e) {
            dmg *= 1 + (e.mods.shipDamageMult || 0);
            if (e.shortage && e.shortage.energy) dmg *= 0.6;
          }
        }
        if (target.kind === 'ship') {
          if (self.rng.next() < target.ship.evasion) return;
          self.damageShip(target.ship, dmg);
        } else {
          self.damageStation(target.colony, dmg);
        }
      });

      // 清理
      const destroyedFleets = [];
      fleets.forEach(function (f) {
        const before = f.ships.length;
        f.ships = f.ships.filter(function (s) { return s.hull > 0; });
        if (f.ships.length < before) {
          const lost = before - f.ships.length;
          self.state.stats.shipsLost += lost;
          if (f.owner && self.empire(f.owner)) self.empire(f.owner).stats.shipsLost = (self.empire(f.owner).stats.shipsLost || 0) + lost;
        }
        if (!f.ships.length) destroyedFleets.push(f);
      });
      colonies.forEach(function (c) {
        if (c.starbase.hull <= 0 && !c.starbase.destroyedNotified) {
          c.starbase.destroyedNotified = true;
          const e = self.empire(c.owner);
          if (e && e.isPlayer) self.notice('battle', c.name + ' 的星际基地被摧毁！', { icon: '💥', systemId: c.systemId, autoPause: true });
        }
      });
      destroyedFleets.forEach(function (f) {
        if (f.owner) {
          const e = self.empire(f.owner);
          if (e) {
            e.fleets = e.fleets.filter(function (id) { return id !== f.id; });
            const war = self.warsFor(f.owner)[0];
            if (war) war.ex[f.owner] = Math.min(100, (war.ex[f.owner] || 0) + 2 + self.fleetPower(f) / 200);
          }
          if (f.owner === self.player().id) {
            self.notice('battle', f.name + ' 全军覆没。', { icon: '☠', systemId: sys.id, autoPause: true });
          }
        }
        self.removeFleet(f);
        if (sys.battle) sys.battle.log.push({ day: self.state.day, text: (f.owner ? self.empire(f.owner).name : '中立生物') + ' 的 ' + f.name + ' 被消灭' });
        if (!f.owner) {
          const victor = fleets.filter(function (x) { return x.owner && x.ships.length; })
            .sort(function (a, b) { return self.fleetPower(b) - self.fleetPower(a); })[0];
          if (victor) {
            const ve = self.empire(victor.owner);
            if (ve) {
              ve.resources.alloys += 40;
              ve.research.physics.progress += 40;
              if (ve.isPlayer) {
                self.notice('battle', '击退了虚空生物！获得 40 合金与 40 物理学研究。', { icon: '🏆', systemId: sys.id, autoPause: true });
              }
            }
          }
        }
      });

      // 战斗结束条件：只剩一方
      const remaining = this.fleetsIn(sys.id).filter(function (f) { return f.ships.length; });
      const owners = {};
      remaining.forEach(function (f) { owners[f.owner === null ? 'null' : f.owner] = true; });
      const stOwners = colonies.filter(function (c) { return c.starbase.hull > 0; }).map(function (c) { return c.owner; });
      if (!remaining.length && !stOwners.length) {
        this.endBattle(sys, '双方都已撤离');
        return;
      }
      if (battle.duration > 0 && battle.duration % 15 === 0) {
        battle.log.push({ day: this.state.day, text: '战斗仍在继续……' });
      }
    }

    damageShip(ship, dmg) {
      let d = dmg;
      if (ship.shield > 0) {
        const absorbed = Math.min(ship.shield, d);
        ship.shield -= absorbed;
        d -= absorbed;
      }
      if (d > 0) {
        const red = ship.armor / (ship.armor + 120);
        ship.hull -= d * (1 - red);
      }
    }

    damageStation(colony, dmg) {
      const sb = colony.starbase;
      const def = SM.STARBASE_LEVELS[sb.level];
      let d = dmg;
      if (sb.shield > 0) {
        const absorbed = Math.min(sb.shield, d);
        sb.shield -= absorbed;
        d -= absorbed;
      }
      if (d > 0) {
        const red = def.armor / (def.armor + 120);
        sb.hull -= d * (1 - red);
      }
      if (sb.hull < 0) sb.hull = 0;
    }

    endBattle(sys, reason) {
      if (!sys.battle) return;
      const battle = sys.battle;
      sys.battle = null;
      const self = this;
      if (battle.playerSide) {
        const remaining = this.fleetsIn(sys.id).filter(function (f) { return f.owner === self.player().id; });
        this.notice('battle', sys.name + ' 的战斗结束。' + (reason ? '（' + reason + '）' : '') + ' 我方剩余 ' + remaining.length + ' 支舰队。', { icon: '🛡', systemId: sys.id });
      }
    }

    updateBombardment() {
      const self = this;
      this.state.systems.forEach(function (sys) {
        const fleets = self.fleetsIn(sys.id).filter(function (f) { return f.owner && f.kind === 'combat'; });
        if (!fleets.length) return;
        const colonies = self.state.colonies.filter(function (c) { return c.systemId === sys.id && !c.occupiedBy; });
        colonies.forEach(function (c) {
          if (c.starbase.hull > 0) return;
          const attackers = fleets.filter(function (f) { return self.hostileOwners(f.owner, c.owner); });
          if (!attackers.length) return;
          if (!c.bombardedBy || c.bombardedBy.length !== attackers.length) c.bombardedBy = attackers.map(function (f) { return f.id; });
          let power = 0;
          attackers.forEach(function (f) { power += self.fleetPower(f); });
          const dmg = 3 + power / 120;
          c.defense -= dmg;
          if (!c.bombardNotified) {
            c.bombardNotified = true;
            const owner = self.empire(c.owner);
            if (owner && owner.isPlayer) self.notice('battle', c.name + ' 正在遭受轨道轰炸！', { icon: '☄', systemId: sys.id, autoPause: true });
          }
          if (self.state.day % 30 === 0 && c.pops > 1 && self.rng.chance(0.4)) {
            c.pops--;
          }
          if (c.defense <= 0) {
            const occupier = self.empire(attackers[0].owner);
            c.defense = 0;
            c.occupiedBy = occupier.id;
            c.bombardNotified = false;
            self.state.stats.coloniesOccupied = (self.state.stats.coloniesOccupied || 0) + 1;
            if (occupier) occupier.stats.coloniesCaptured = (occupier.stats.coloniesCaptured || 0) + 1;
            const owner = self.empire(c.owner);
            if (owner) {
              const war = self.warBetween(owner.id, occupier.id);
              if (war) war.ex[owner.id] = Math.min(100, (war.ex[owner.id] || 0) + 25);
              if (owner.isPlayer) self.notice('war', '殖民地 ' + c.name + ' 被 ' + occupier.name + ' 占领！', { icon: '☠', systemId: sys.id, autoPause: true });
            }
            if (occupier.isPlayer) self.notice('war', '已占领 ' + c.name + '（' + (owner ? owner.name : '') + '）。', { icon: '🏴', systemId: sys.id, autoPause: true });
            self.refreshEconomy(owner);
          }
        });
      });
    }

    updateRaids() {
      const self = this;
      this.state.systems.forEach(function (sys) {
        if (!sys.owner) { sys.raidDays = 0; return; }
        const hostiles = self.fleetsIn(sys.id).filter(function (f) {
          return f.ships.length && f.owner && self.hostileOwners(f.owner, sys.owner) && f.kind === 'combat';
        });
        if (!hostiles.length) { sys.raidDays = 0; return; }
        sys.raidDays = (sys.raidDays || 0) + 1;
        if (sys.raidDays !== 3) return;
        let raided = false;
        ['mining', 'research'].forEach(function (type) {
          const st = sys.stations[type];
          if (st && st.owner === sys.owner && st.built) {
            st.built = false;
            st.owner = null;
            st.building = false;
            raided = true;
          }
        });
        if (raided) {
          const e = self.empire(sys.owner);
          if (e) {
            self.refreshEconomy(e);
            if (e.isPlayer) self.notice('war', '敌方舰队摧毁了 ' + sys.name + ' 的太空站！', { icon: '💥', systemId: sys.id, autoPause: true });
          }
        }
      });
    }

    updateColonies() {
      const self = this;
      this.state.colonies.forEach(function (c) {
        if (c.occupiedBy) return;
        // 建造队列
        if (c.queue.length) {
          const q = c.queue[0];
          q.daysLeft--;
          if (q.daysLeft <= 0) {
            c.queue.shift();
            if (q.type === 'district') {
              c.districts[q.key] = (c.districts[q.key] || 0) + 1;
            } else if (q.type === 'building') {
              c.buildings.push(q.key);
            } else if (q.type === 'starbase') {
              c.starbase.level = q.next || c.starbase.level + 1;
              const def = SM.STARBASE_LEVELS[c.starbase.level];
              c.starbase.hullMax = def.hull;
              c.starbase.hull = def.hull;
              c.starbase.shieldMax = def.shield;
              c.starbase.shield = def.shield;
            }
            const e = self.empire(c.owner);
            if (e) {
              self.refreshEconomy(e);
              if (e.isPlayer) self.notice('colony', c.name + ' 完成建造：' + q.name, { icon: '🏗', systemId: c.systemId });
            }
          }
        }
        // 造船队列
        if (c.shipQueue.length) {
          const q = c.shipQueue[0];
          q.daysLeft--;
          if (q.daysLeft <= 0) {
            c.shipQueue.shift();
            self.completeShipBuild(c, q);
          }
        }
        // 防御恢复
        const hostile = self.fleetsIn(c.systemId).some(function (f) { return f.owner && f.kind === 'combat' && self.hostileOwners(f.owner, c.owner); });
        if (!hostile && c.defense < self.colonyDefenseMax(c)) {
          c.defense = Math.min(self.colonyDefenseMax(c), c.defense + 1.5);
        }
        if (!hostile) c.bombardNotified = false;
      });
    }

    completeShipBuild(c, q) {
      const e = this.empire(c.owner);
      if (!e) return;
      const cls = q.cls;
      if (cls === 'colony') {
        const planet = this.planet(q.targetPlanetId);
        if (!planet || planet.colonyId) {
          e.resources.alloys += Math.round(q.cost * 0.5);
          if (e.isPlayer) this.notice('colony', '殖民目标已失效，殖民船订单取消（返还一半合金）。', { icon: '⚠' });
          return;
        }
        const fleet = this.createFleet(e, c.systemId, [this.makeShip('colony', e)], { name: '殖民船', kind: 'colony', auto: true });
        fleet.mission = { type: 'travelColonize', systemId: this.planetSystem(planet.id).id, planetId: planet.id };
        const path = SM.Galaxy.path(this.state.systems, c.systemId, fleet.mission.systemId);
        if (path) {
          fleet.path = path.slice(1);
          if (!fleet.travel && fleet.path.length) this.startNextTravel(fleet);
        }
        e.stats.shipsBuilt++;
        return;
      }
      const ship = this.makeShip(cls, e);
      let fleet = null;
      if (cls === 'science' || cls === 'construction') {
        fleet = this.createFleet(e, c.systemId, [ship], {
          name: cls === 'science' ? '科研船' : '工程船',
          kind: cls,
          auto: true
        });
      } else {
        fleet = this.state.fleets.find(function (f) {
          return f.owner === e.id && f.systemId === c.systemId && f.kind === 'combat' && !f.travel && !f.mission;
        });
        if (!fleet) fleet = this.createFleet(e, c.systemId, [ship], { name: this.nextFleetName(e), kind: 'combat' });
        else fleet.ships.push(ship);
      }
      e.stats.shipsBuilt++;
      this.state.stats.shipsBuilt++;
      if (e.isPlayer) this.notice('info', c.name + ' 建成 ' + SM.SHIPS[cls].name + '。', { icon: SM.SHIPS[cls].icon, systemId: c.systemId });
    }

    updateStarbases() {
      const self = this;
      this.state.colonies.forEach(function (c) {
        if (c.occupiedBy) return;
        if (c.starbase.upgrading) {
          c.starbase.upgrading.daysLeft--;
          if (c.starbase.upgrading.daysLeft <= 0) {
            c.starbase.level = c.starbase.upgrading.next;
            const def = SM.STARBASE_LEVELS[c.starbase.level];
            c.starbase.hullMax = def.hull;
            c.starbase.hull = def.hull;
            c.starbase.shieldMax = def.shield;
            c.starbase.shield = def.shield;
            c.starbase.upgrading = null;
            const e = self.empire(c.owner);
            if (e && e.isPlayer) self.notice('colony', c.name + ' 的星际基地升级为「' + def.name + '」。', { icon: '🏰', systemId: c.systemId });
          }
        }
        const hostile = self.fleetsIn(c.systemId).some(function (f) { return f.owner && f.kind === 'combat' && self.hostileOwners(f.owner, c.owner); });
        if (!hostile) {
          const def = SM.STARBASE_LEVELS[c.starbase.level];
          if (c.starbase.hull < c.starbase.hullMax) {
            c.starbase.hull = Math.min(c.starbase.hullMax, c.starbase.hull + c.starbase.hullMax * 0.01);
            if (c.starbase.hull >= c.starbase.hullMax) c.starbase.destroyedNotified = false;
          }
          if (c.starbase.shield < (c.starbase.shieldMax || def.shield)) {
            c.starbase.shield = Math.min(c.starbase.shieldMax || def.shield, c.starbase.shield + (c.starbase.shieldMax || def.shield) * 0.05);
          }
        }
      });
      this.state.fleets.forEach(function (f) {
        if (f.travel) return;
        const fsys = self.system(f.systemId);
        if (fsys && fsys.battle) return;
        f.ships.forEach(function (s) {
          if (s.shieldMax && s.shield < s.shieldMax) s.shield = Math.min(s.shieldMax, s.shield + s.shieldMax * 0.08);
        });
      });
    }

    /* ---------------------------------------------------------------- */
    /* 月度结算                                                          */
    /* ---------------------------------------------------------------- */
    monthly() {
      const self = this;
      this.state.monthly++;
      this.state.empires.forEach(function (e) {
        if (!e.alive) return;
        self.rebalanceJobs(e);
        self.computeIncome(e);
        self.applyIncome(e);
        self.advanceResearch(e);
        self.monthlyPopulation(e);
        self.checkFood(e);
      });
      this.state.empires.forEach(function (e) {
        if (!e.alive) return;
        if (e.isPlayer) return;
        self.aiMonthly(e);
      });
      this.checkContacts();
      this.diplomacyMonthly();
      this.eventsMonthly();
      this.cleanupEmpires();
      this.cleanupStations();
      this.checkGameEnd();
      this.state.empires.forEach(function (e) {
        if (e.alive) self.refreshEconomy(e);
      });
    }

    checkFood(e) {
      if ((e.income.food || 0) < -5 && e.isPlayer && this.state.day % (SM.DAYS_PER_MONTH * 6) === 0) {
        this.notice('economy', '食物严重短缺！请建造农业区划或减少人口。', { icon: '⚠' });
      }
    }

    cleanupStations() {
      const self = this;
      this.state.systems.forEach(function (sys) {
        ['mining', 'research'].forEach(function (type) {
          const st = sys.stations[type];
          if (!st || !st.building) return;
          const hasBuilder = self.state.fleets.some(function (f) {
            return f.mission && f.mission.type === 'building' && f.mission.systemId === sys.id && f.mission.stationType === type;
          });
          if (!hasBuilder && (self.state.day - (st.startedDay || 0)) > 3) {
            sys.stations[type] = null;
          }
        });
      });
    }

    checkContacts() {
      const self = this;
      const empires = this.state.empires.filter(function (e) { return e.alive; });
      const year = SM.dateParts(this.state.day).year;
      for (let i = 0; i < empires.length; i++) {
        for (let j = i + 1; j < empires.length; j++) {
          const a = empires[i], b = empires[j];
          if (a.contacts[b.id]) continue;
          let met = false;
          if (year >= SM.START_YEAR + 8) met = true;
          if (!met) {
            const as = this.ownedSystems(a.id);
            const bs = this.ownedSystems(b.id);
            for (let x = 0; x < as.length && !met; x++) {
              for (let y = 0; y < bs.length; y++) {
                if (SM.distance(as[x], bs[y]) < 620) { met = true; break; }
              }
            }
          }
          if (!met) {
            for (let x = 0; x < this.state.fleets.length && !met; x++) {
              const fa = this.state.fleets[x];
              if (fa.owner !== a.id || fa.travel) continue;
              for (let y = 0; y < this.state.fleets.length; y++) {
                const fb = this.state.fleets[y];
                if (fb.owner === b.id && !fb.travel && fb.systemId === fa.systemId) { met = true; break; }
              }
            }
          }
          if (met) {
            a.contacts[b.id] = true;
            b.contacts[a.id] = true;
            const key = this.diploKey(a.id, b.id);
            if (this.state.diplo[key] === undefined) this.state.diplo[key] = 0;
            if (a.isPlayer || b.isPlayer) {
              this.notice('diplo', '首次接触：' + a.name + ' 与 ' + b.name + ' 建立了通讯。', {
                icon: '📡', autoPause: a.isPlayer || b.isPlayer, firstContact: a.isPlayer || b.isPlayer,
                otherId: a.isPlayer ? b.id : a.id
              });
            }
          }
        }
      }
    }

    /* ---------------------------------------------------------------- */
    /* 外交                                                              */
    /* ---------------------------------------------------------------- */
    diploKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
    relation(a, b) {
      const v = this.state.diplo[this.diploKey(a, b)];
      return v === undefined ? 0 : v;
    }
    changeRelation(a, b, delta) {
      const key = this.diploKey(a, b);
      const cur = this.state.diplo[key] === undefined ? 0 : this.state.diplo[key];
      this.state.diplo[key] = Math.max(-100, Math.min(100, cur + delta));
    }
    truceUntil(a, b) { return this.state.truces[this.diploKey(a, b)] || 0; }
    contacted(a, b) {
      const ea = this.empire(a), eb = this.empire(b);
      return !!(ea && eb && ea.contacts[eb.id]);
    }

    declareWar(attackerId, defenderId, silent) {
      const a = this.empire(attackerId), b = this.empire(defenderId);
      if (!a || !b || !a.alive || !b.alive) return { ok: false, reason: '目标不存在' };
      if (this.isAtWar(a.id, b.id)) return { ok: false, reason: '已经处于战争状态' };
      if (!this.contacted(a.id, b.id)) return { ok: false, reason: '尚未建立通讯' };
      if (this.truceUntil(a.id, b.id) > this.state.day) return { ok: false, reason: '停战协议仍然有效' };
      if (a.isPlayer) {
        if (a.resources.influence < 30) return { ok: false, reason: '影响力不足（需要 30）' };
        a.resources.influence -= 30;
      }
      const war = { id: 'w' + (this.state.nextId.war++), a: a.id, b: b.id, startDay: this.state.day, ex: {} };
      war.ex[a.id] = 0;
      war.ex[b.id] = 0;
      this.state.wars.push(war);
      this.changeRelation(a.id, b.id, -45);
      const involvesPlayer = a.isPlayer || b.isPlayer;
      this.notice('war', a.name + ' 向 ' + b.name + ' 宣战！', { icon: '💥', autoPause: involvesPlayer, empireId: b.id });
      if (!silent) {
        if (b.isPlayer) this.notice('war', '战争降临：' + a.name + ' 的舰队正在逼近。', {
          icon: '🚨', autoPause: true, warOnPlayer: true, attackerId: a.id
        });
        if (a.isPlayer) this.notice('war', '我们已向 ' + b.name + ' 宣战。', { icon: '💥' });
      }
      a.ai.target = b.id;
      b.ai.target = a.id;
      return { ok: true, war: war };
    }

    resolveUltimatum(accept) {
      const u = this.state.pendingUltimatum;
      const p = this.player();
      if (!u || !p || u.to !== p.id) return { ok: false, reason: '没有待处理的最后通牒' };
      const a = this.empire(u.from);
      if (!a || !a.alive) {
        this.state.pendingUltimatum = null;
        return { ok: false, reason: '对方已经不存在' };
      }
      if (accept) {
        if (p.resources.energy < u.demand) return { ok: false, reason: '能量币不足（需要 ' + u.demand + '）' };
        p.resources.energy -= u.demand;
        this.state.pendingUltimatum = null;
        this.changeRelation(a.id, p.id, 15);
        this.state.truces[this.diploKey(a.id, p.id)] = this.state.day + 2 * SM.DAYS_PER_YEAR;
        a.ai.target = null;
        this.notice('diplo', '我们接受了 ' + a.name + ' 的最后通牒，支付 ' + u.demand + ' 能量币。两年内不会再被同一帝国勒索。', { icon: '🕊' });
        return { ok: true, accepted: true };
      }
      this.state.pendingUltimatum = null;
      a.ai.target = p.id;
      const res = this.declareWar(a.id, p.id, false);
      if (!res.ok) this.notice('war', a.name + ' 的最后通牒到期，但战争未能爆发：' + res.reason, { icon: '⚠' });
      return { ok: true, accepted: false, war: res.war || null };
    }

    endWar(war, type, winnerId) {
      if (!war) return;
      const self = this;
      const a = this.empire(war.a), b = this.empire(war.b);
      const all = [a, b];
      // 处理被占领的殖民地：白和按现状划分边界，投降则交出占领区
      this.state.colonies.forEach(function (c) {
        if (!c.occupiedBy) return;
        if (c.owner !== war.a && c.owner !== war.b) return;
        if (c.occupiedBy !== war.a && c.occupiedBy !== war.b) return;
        const occupier = self.empire(c.occupiedBy);
        if (occupier && (type === 'white' || type === 'surrender')) {
          const oldOwner = c.owner;
          c.owner = occupier.id;
          c.occupiedBy = null;
          const old = self.empire(oldOwner);
          if (old) {
            old.colonies = old.colonies.filter(function (id) { return id !== c.id; });
            if (old.capital === c.id) {
              const rest = old.colonies.filter(function (id) { const cc = self.colony(id); return cc && !cc.occupiedBy; });
              old.capital = rest[0] || null;
            }
          }
          occupier.colonies.push(c.id);
          if (!occupier.capital) occupier.capital = c.id;
          const csys = self.system(c.systemId);
          if (csys) {
            csys.owner = occupier.id;
            ['mining', 'research'].forEach(function (t) {
              if (csys.stations[t] && csys.stations[t].owner !== occupier.id) csys.stations[t] = null;
            });
          }
          c.defenseMax = self.colonyDefenseMax(c);
          c.defense = c.defenseMax * 0.5;
          c.starbase.hull = c.starbase.hullMax * 0.5;
        } else {
          c.occupiedBy = null;
          c.defense = self.colonyDefenseMax(c) * 0.4;
        }
        c.bombardNotified = false;
      });
      this.state.wars = this.state.wars.filter(function (w) { return w.id !== war.id; });
      const until = this.state.day + SM.TRUCE_YEARS * SM.DAYS_PER_YEAR;
      this.state.truces[this.diploKey(war.a, war.b)] = until;
      this.changeRelation(war.a, war.b, type === 'surrender' ? -20 : 10);
      const text = type === 'surrender'
        ? (this.empire(winnerId) ? this.empire(winnerId).name : '?') + ' 赢得了战争，吞并了占领区。'
        : '双方以现有边界签署停战协议，占领区归占领者所有。';
      const playerInvolved = (a && a.isPlayer) || (b && b.isPlayer);
      this.notice('diplo', '战争结束：' + text, { icon: '🕊', autoPause: playerInvolved });
      if (this.state.pendingPeace && this.state.pendingPeace.warId === war.id) this.state.pendingPeace = null;
      all.forEach(function (e) { if (e) self.refreshEconomy(e); });
    }

    warExhaustion(war, eid) { return war.ex[eid] || 0; }

    aiWarExhaustion(war, e) {
      const val = war.ex[e.id] || 0;
      const colon = this.empireColonyCount(e);
      return val + (colon === 0 ? 50 : 0);
    }

    aiPeaceWilling(war, e) {
      const enemyId = war.a === e.id ? war.b : war.a;
      const ex = war.ex[e.id] || 0;
      const myLost = this.state.colonies.filter(function (c) { return c.owner === e.id && c.occupiedBy === enemyId; }).length;
      const myGain = this.state.colonies.filter(function (c) { return c.owner === enemyId && c.occupiedBy === e.id; }).length;
      if (myGain > 0 && ex < 40) return false;
      if (myLost > 0) return ex > 20;
      return ex > 55;
    }

    diplomacyMonthly() {
      const self = this;
      const day = this.state.day;
      // 关系缓慢回归 0
      Object.keys(this.state.diplo).forEach(function (key) {
        const v = self.state.diplo[key];
        if (v > 0) self.state.diplo[key] = Math.max(0, v - 0.15);
        else if (v < 0) self.state.diplo[key] = Math.min(0, v + 0.08);
      });
      // 战争疲劳
      this.state.wars.slice().forEach(function (war) {
        [war.a, war.b].forEach(function (eid) {
          war.ex[eid] = Math.min(100, (war.ex[eid] || 0) + 0.4);
        });
        if ((war.ex[war.a] || 0) >= 100 || (war.ex[war.b] || 0) >= 100) {
          self.endWar(war, 'white', null);
          return;
        }
        // AI 主动求和
        const a = self.empire(war.a), b = self.empire(war.b);
        if (!a || !b) return;
        [a, b].forEach(function (ai) {
          if (ai.isPlayer) return;
          if (war.lastOfferDay && day - war.lastOfferDay < 360) return;
          if (self.aiPeaceWilling(war, ai)) {
            war.lastOfferDay = day;
            const other = ai.id === war.a ? b : a;
            if (other.isPlayer) {
              if (!self.state.pendingPeace) {
                self.state.pendingPeace = { from: ai.id, warId: war.id, type: 'white', text: ai.name + ' 请求停战。他们愿意以现有边界结束这场战争。' };
                self.notice('diplo', ai.name + ' 请求停战。', { icon: '🕊', autoPause: true });
              }
            } else {
              self.endWar(war, 'white', null);
            }
          }
        });
      });
      // AI 宣战
      this.state.empires.forEach(function (e) {
        if (!e.alive || e.isPlayer) return;
        const diff = SM.DIFFICULTY[self.state.difficulty] || SM.DIFFICULTY.normal;
        const earliest = diff.id === 'easy' ? 12 : diff.id === 'hard' ? 6 : 9;
        if (day < earliest * SM.DAYS_PER_YEAR) return;
        if (self.anyWar(e)) return;
        if (day % (SM.DAYS_PER_MONTH * 3) !== 0) return;
        const pers = SM.AI_PERSONALITIES[e.personality] || SM.AI_PERSONALITIES.expand;
        const aggression = pers.aggression * diff.aiAggression;
        if (!self.rng.chance(0.08 * aggression)) return;
        const myPower = self.empirePower(e);
        const targets = self.state.empires.filter(function (o) {
          return o.alive && o.id !== e.id && self.contacted(e.id, o.id) && !self.isAtWar(e.id, o.id) &&
            self.truceUntil(e.id, o.id) <= day;
        });
        if (!targets.length) return;
        targets.sort(function (x, y) { return self.empirePower(x) - self.empirePower(y); });
        const victim = targets[0];
        const ratio = diff.id === 'easy' ? 1.8 : diff.id === 'hard' ? 1.4 : 1.6;
        if (self.empirePower(victim) * ratio > myPower) return;
        if (self.relation(e.id, victim.id) > -5) return;
        if (victim.isPlayer) {
          // 对玩家先发最后通牒，给一个明确的选择，而不是无预警开战
          if (self.state.pendingUltimatum) return;
          if (e.ai.lastUltimatumDay && day - e.ai.lastUltimatumDay < 3 * SM.DAYS_PER_YEAR) return;
          e.ai.lastUltimatumDay = day;
          e.ai.target = victim.id;
          const year = Math.floor(day / SM.DAYS_PER_YEAR);
          const demand = 120 + Math.max(0, year - 2205) * 10;
          self.state.pendingUltimatum = { from: e.id, to: victim.id, demand: demand, day: day };
          self.notice('diplo', e.name + ' 发出最后通牒：要求 ' + demand + ' 能量币，否则立即开战。', {
            icon: '⚠', autoPause: true, ultimatum: true, attackerId: e.id
          });
          return;
        }
        self.declareWar(e.id, victim.id, false);
      });
    }

    offerPeace(playerId, targetId, type) {
      const e = this.empire(playerId);
      const t = this.empire(targetId);
      if (!e || !t) return { ok: false, reason: '目标不存在' };
      const war = this.warBetween(e.id, t.id);
      if (!war) return { ok: false, reason: '并不处于战争状态' };
      const occupied = this.state.colonies.filter(function (c) { return c.owner === t.id && c.occupiedBy === e.id; });
      const occupiedCount = occupied.length;
      const total = this.empireColonyCount(t);
      const tEx = war.ex[t.id] || 0;
      const ePower = this.empirePower(e), tPower = this.empirePower(t);
      let accept = false;
      if (type === 'white') {
        accept = tEx > 40 || tPower < ePower * 0.75 || occupiedCount > 0 || this.empireColonyCount(t) === 0;
      } else if (type === 'surrender') {
        accept = occupiedCount > 0 && (occupiedCount >= Math.max(1, total * 0.5) || tEx > 60 || this.empireColonyCount(t) === 0);
      }
      if (accept) {
        this.endWar(war, type, e.id);
        return { ok: true, accepted: true };
      }
      this.changeRelation(e.id, t.id, -5);
      return { ok: false, accepted: false, reason: t.name + ' 拒绝了我们的和平提议。' };
    }

    acceptPeaceOffer() {
      const p = this.state.pendingPeace;
      if (!p) return;
      const war = this.state.wars.find(function (w) { return w.id === p.warId; });
      this.state.pendingPeace = null;
      if (war) this.endWar(war, 'white', null);
    }

    rejectPeaceOffer() {
      const p = this.state.pendingPeace;
      this.state.pendingPeace = null;
      if (!p) return;
      const other = this.empire(p.from);
      if (other) {
        this.changeRelation(this.player().id, other.id, -10);
        this.notice('diplo', '我们拒绝了 ' + other.name + ' 的停战请求。', { icon: '💥' });
      }
    }

    sendGift(fromId, toId, amount) {
      const a = this.empire(fromId), b = this.empire(toId);
      if (!a || !b) return { ok: false, reason: '目标不存在' };
      if (!this.contacted(a.id, b.id)) return { ok: false, reason: '尚未建立通讯' };
      amount = amount || 100;
      if (a.resources.energy < amount) return { ok: false, reason: '能量币不足' };
      a.resources.energy -= amount;
      b.resources.energy += amount;
      const bonus = 1 + (b.mods.relationBonus || 0) * 0.3;
      const delta = Math.round((amount / 10) * bonus);
      this.changeRelation(a.id, b.id, delta);
      this.notice('diplo', a.name + ' 向 ' + b.name + ' 赠送了 ' + amount + ' 能量币。', { icon: '🎁', autoPause: false });
      return { ok: true, delta: delta };
    }

    /* ---------------------------------------------------------------- */
    /* 事件                                                              */
    /* ---------------------------------------------------------------- */
    eventsMonthly() {
      if (this.state.pendingEvent) return;
      const player = this.player();
      if (!player.alive) return;
      const day = this.state.day;
      const self = this;
      // 先处理事件链的后续事件
      if (this.state.delayedEvents && this.state.delayedEvents.length) {
        const idx = this.state.delayedEvents.findIndex(function (q) { return q.day <= day && q.empireId === player.id; });
        if (idx >= 0) {
          const q = this.state.delayedEvents.splice(idx, 1)[0];
          const ev = this.eventById(q.eventId);
          if (ev) {
            this.state.pendingEvent = { eventId: ev.id, empireId: player.id };
            this.state.lastEventDay = day;
            this.notice('event', '新的进展：' + ev.title, { icon: ev.icon, autoPause: true, event: ev.id });
            return;
          }
        }
      }
      if (day - (this.state.lastEventDay || -9999) < 150) return;
      if (this.rng.next() > 0.07) return;
      const year = SM.dateParts(day).year;
      const pool = SM.EVENTS.filter(function (ev) {
        if (ev.hidden) return false;
        if (ev.minYear && year < ev.minYear) return false;
        const key = player.id + ':' + ev.id;
        if (ev.once && self.state.firedEvents[key]) return false;
        if (!ev.once) {
          const last = (self.state.eventLastFired && self.state.eventLastFired[key]) || -9999;
          if (day - last < (ev.cooldown || 5 * SM.DAYS_PER_YEAR)) return false;
        }
        if (ev.cond && !ev.cond(self, player)) return false;
        return true;
      });
      if (!pool.length) return;
      let total = 0;
      pool.forEach(function (ev) { total += ev.weight; });
      let r = this.rng.next() * total;
      let chosen = pool[0];
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) { chosen = pool[i]; break; }
      }
      this.state.firedEvents[player.id + ':' + chosen.id] = true;
      if (!this.state.eventLastFired) this.state.eventLastFired = {};
      this.state.eventLastFired[player.id + ':' + chosen.id] = day;
      this.state.lastEventDay = day;
      this.state.pendingEvent = { eventId: chosen.id, empireId: player.id };
      this.notice('event', '事件：' + chosen.title, { icon: chosen.icon, autoPause: true, event: chosen.id });
    }

    queueEvent(eventId, delayDays, empireId) {
      if (!this.state.delayedEvents) this.state.delayedEvents = [];
      const eid = empireId || this.player().id;
      this.state.delayedEvents.push({ day: this.state.day + (delayDays || 180), eventId: eventId, empireId: eid });
    }

    eventById(id) { return SM.EVENTS.find(function (e) { return e.id === id; }); }

    resolveEvent(choiceIndex) {
      const p = this.state.pendingEvent;
      if (!p) return;
      const ev = this.eventById(p.eventId);
      this.state.pendingEvent = null;
      if (!ev) return;
      const e = this.empire(p.empireId);
      if (!e) return;
      const opt = ev.options[Math.max(0, Math.min(ev.options.length - 1, choiceIndex))];
      this.applyEventEffects(e, opt.effects);
      this.refreshEconomy(e);
      this.notice('event', '事件「' + ev.title + '」：' + opt.label, { icon: ev.icon, autoPause: false });
    }

    applyEventEffects(e, effects) {
      if (!effects) return;
      Object.keys(effects).forEach(function (k) {
        const v = effects[k];
        if (k === 'relationAll') {
          const self = this;
          this.state.empires.forEach(function (o) {
            if (o.id !== e.id && o.alive && self.contacted(e.id, o.id)) self.changeRelation(e.id, o.id, v);
          });
        } else if (k === 'addPops') {
          const cap = this.colony(e.capital);
          if (cap) cap.pops = Math.max(1, cap.pops + v);
        } else if (k === 'spawnRaid') {
          this.spawnRaid(e);
        } else if (k === 'mods') {
          e.permanentMods = e.permanentMods || {};
          Object.keys(v).forEach(function (mk) { e.permanentMods[mk] = (e.permanentMods[mk] || 0) + v[mk]; });
        } else if (k === 'queueEvent') {
          this.queueEvent(v.id, v.delay || 180, e.id);
        } else if (k === 'addShips') {
          const cap = this.colony(e.capital);
          if (cap) {
            let fleet = this.combatFleets(e).find(function (f) { return f.systemId === cap.systemId; });
            if (!fleet) fleet = this.createFleet(e, cap.systemId, [], { name: this.nextFleetName(e), kind: 'combat' });
            const n = Math.max(1, v.count || 1);
            for (let i = 0; i < n; i++) fleet.ships.push(this.makeShip(v.cls || 'corvette', e));
            e.stats.shipsBuilt = (e.stats.shipsBuilt || 0) + n;
          }
        } else if (e.resources[k] !== undefined) {
          e.resources[k] = Math.max(0, e.resources[k] + v);
        } else if (e.research[k]) {
          e.research[k].progress += v;
        }
      }, this);
      e.mods = this.computeMods(e);
    }

    spawnRaid(e) {
      const cap = this.colony(e.capital);
      if (!cap) return;
      const sys = this.system(cap.systemId);
      const near = sys.lanes.map(function (i) { return this.state.systems[i]; }, this)
        .filter(function (s) { return s && !s.colonyId; });
      const target = near.length ? near[0] : sys;
      const ships = [];
      for (let i = 0; i < 3; i++) {
        const s = this.makeShip('amoeba', null);
        s.name = '海盗';
        ships.push(s);
      }
      this.createFleet(null, target.id, ships, { name: '星际海盗', kind: 'neutral', neutral: true });
      this.notice('war', '海盗舰队出现在 ' + target.name + ' 附近！', { icon: '🏴‍☠️', systemId: target.id, autoPause: true });
    }

    /* ---------------------------------------------------------------- */
    /* AI                                                                */
    /* ---------------------------------------------------------------- */
    aiMonthly(e) {
      const self = this;
      if (!e.alive) return;
      CATS.forEach(function (cat) {
        if (!e.research[cat].current) self.aiPickResearch(e, cat);
      });
      e.colonies.forEach(function (cid) {
        const c = self.colony(cid);
        if (c && !c.occupiedBy) self.aiBuildColony(e, c);
      });
      this.aiBuildShips(e);
      this.aiUpgradeStarbase(e);
      this.aiColonize(e);
      this.aiTraditions(e);
      this.aiFleets(e);
      this.aiMergeFleets(e);
    }

    aiBuildColony(e, c) {
      if (c.queue.length > 0) return;
      const housing = this.colonyHousing(c);
      const max = this.colonyMaxDistricts(c);
      const counts = {};
      c.buildings.forEach(function (b) { counts[b] = (counts[b] || 0) + 1; });
      const freeSlots = this.colonyBuildingSlots(c) - this.colonyUsedBuildingSlots(c) - c.queue.filter(function (q) { return q.type === 'building'; }).length;
      const canAfford = function (cost) { return e.resources.minerals > cost + 120; };
      const wantBuildings = (counts.lab || 0) < Math.min(4, Math.ceil(c.pops / 8)) ||
        (counts.foundry || 0) < Math.min(3, Math.ceil(c.pops / 12));

      // 住房紧张，或需要更多建筑位 → 城市区划
      if ((housing <= c.pops + 2 || (freeSlots <= 0 && wantBuildings)) && (c.districts.city || 0) < (max.city || 0)) {
        const cost = this.districtCost(e, 'city');
        if (canAfford(cost)) { this.buildDistrict(c.id, 'city'); return; }
      }
      // 建筑
      if (freeSlots > 0 && e.resources.minerals > 260) {
        const has = function (k) { return (counts[k] || 0) > 0; };
        const canBuild = function (k) {
          const def = SM.BUILDINGS[k];
          if (!def || (def.req && !e.techs[def.req])) return false;
          return true;
        };
        let pick = null;
        if (e.income.consumer_goods < 4 && (counts.factory || 0) < Math.max(1, Math.ceil(c.pops / 20))) pick = 'factory';
        else if ((counts.lab || 0) < Math.min(4, Math.ceil(c.pops / 8))) pick = 'lab';
        else if ((counts.foundry || 0) < Math.min(3, Math.ceil(c.pops / 10))) pick = 'foundry';
        else if (!has('culture') && e.income.unity < 6) pick = 'culture';
        else if (!has('fortress')) pick = 'fortress';
        else if (canBuild('admin_office') && !has('admin_office')) pick = 'admin_office';
        else if (canBuild('robot_plant') && !has('robot_plant')) pick = 'robot_plant';
        else if (canBuild('research_institute') && !has('research_institute')) pick = 'research_institute';
        else if ((counts.factory || 0) < 2) pick = 'factory';
        else pick = 'lab';
        if (pick && this.buildBuilding(c.id, pick).ok) return;
      }
      // 区划：优先解决失业与赤字
      const jobTotal = this.colonyJobTotal(c);
      let key = null;
      if (c.pops > jobTotal) {
        const keys = ['mining', 'generator', 'agri'].filter(function (k) { return (c.districts[k] || 0) < (max[k] || 0); });
        if (keys.length) key = keys[Math.floor(this.rng.next() * keys.length)];
      }
      if (!key && e.income.food < 0) key = 'agri';
      if (!key && e.income.minerals < 20) key = 'mining';
      if (!key && e.income.energy < 0) key = 'generator';
      if (!key) {
        const opts = ['mining', 'generator', 'agri'].filter(function (k) { return (c.districts[k] || 0) < (max[k] || 0); });
        if (opts.length) key = opts[Math.floor(this.rng.next() * opts.length)];
      }
      if (key && canAfford(this.districtCost(e, key))) this.buildDistrict(c.id, key);
    }

    aiUpgradeStarbase(e) {
      if (e.resources.alloys < 300) return;
      const self = this;
      const max = this.maxStarbaseLevel(e);
      const colonies = e.colonies.map(function (id) { return self.colony(id); }).filter(function (c) { return c && !c.occupiedBy; });
      for (let i = 0; i < colonies.length; i++) {
        const c = colonies[i];
        if (c.starbase.upgrading) continue;
        if (c.starbase.level >= max) continue;
        const def = SM.STARBASE_LEVELS[c.starbase.level + 1];
        if (!def || !def.upgradeCost) continue;
        if (e.resources.alloys < def.upgradeCost.alloys + 150) continue;
        this.upgradeStarbase(c.id);
        return;
      }
    }

    aiBuildShips(e) {
      const self = this;
      const pers = SM.AI_PERSONALITIES[e.personality] || SM.AI_PERSONALITIES.expand;
      const year = SM.dateParts(this.state.day).year;
      const diff = SM.DIFFICULTY[this.state.difficulty] || SM.DIFFICULTY.normal;
      const targetPower = (420 + (year - SM.START_YEAR) * 150) * pers.aggression * diff.aiGrowth;
      const curPower = this.empirePower(e);
      const cap = this.colony(e.capital) || e.colonies.map(this.colony.bind(this)).find(function (c) { return c; });
      if (!cap) return;
      // 民用船
      const sci = e.fleets.filter(function (id) { const f = self.fleet(id); return f && f.kind === 'science'; }).length;
      const con = e.fleets.filter(function (id) { const f = self.fleet(id); return f && f.kind === 'construction'; }).length;
      if (sci < 2 && e.resources.alloys > 70 && cap.shipQueue.length < 3) this.buildShip(cap.id, 'science', 1);
      if (con < 2 && e.resources.alloys > 70 && cap.shipQueue.length < 3) this.buildShip(cap.id, 'construction', 1);
      if (curPower >= targetPower) return;
      if (e.resources.alloys < 80) return;
      if (cap.shipQueue.length >= 4) return;
      const cls = ['battleship', 'cruiser', 'destroyer', 'corvette'].find(function (c) { return self.hasShipClass(e, c); });
      if (!cls) return;
      let count = 1;
      if (e.resources.alloys > this.shipCost(e, cls) * 3 && this.rng.chance(0.4)) count = 2;
      this.buildShip(cap.id, cls, count);
    }

    aiColonize(e) {
      const self = this;
      const year = SM.dateParts(this.state.day).year;
      if (this.state.day % (SM.DAYS_PER_MONTH * 3) !== 0) return;
      const queued = e.colonies.some(function (cid) {
        const c = self.colony(cid);
        return c && c.shipQueue.some(function (q) { return q.cls === 'colony'; });
      });
      if (queued) return;
      const moving = this.state.fleets.some(function (f) { return f.owner === e.id && f.kind === 'colony'; });
      if (moving) return;
      const cost = this.colonyShipCost(e);
      if (e.resources.alloys < cost.alloys + 50 || e.resources.influence < cost.influence + 10) return;
      // 殖民地越多，扩张欲望略有下降
      const pers = SM.AI_PERSONALITIES[e.personality] || SM.AI_PERSONALITIES.expand;
      if (!this.rng.chance(0.5 * pers.expansion)) return;
      const owned = this.ownedSystems(e.id).map(function (s) { return s.id; });
      const reach = SM.Galaxy.reach(this.state.systems, owned, SM.COLONY_RANGE);
      const candidates = [];
      this.state.systems.forEach(function (s) {
        if (s.colonyId || (s.owner && s.owner !== e.id)) return;
        if (reach.indexOf(s.id) < 0 && s.owner !== e.id) return;
        if (!s.surveyed[e.id]) return;
        if (self.systemHasHostileFleet(e.id, s)) return;
        s.planets.forEach(function (p) {
          if (!p.habitable || p.colonyId) return;
          const plan = self.canColonizeCheck(p, e);
          if (!plan.ok) return;
          const jumps = SM.Galaxy.jumpsBetween(self.state.systems, e.capital ? self.colony(e.capital).systemId : s.id, s.id);
          let score = 100 - (isFinite(jumps) ? jumps * 8 : 60) + p.size * 1.5 + (p.maxDistricts ? p.maxDistricts.city : 0);
          if (s.anomaly) score += 5;
          candidates.push({ planet: p, score: score });
        });
      });
      candidates.sort(function (a, b) { return b.score - a.score; });
      if (!candidates.length) return;
      this.orderColonize(candidates[0].planet.id, e.id);
    }

    aiTraditions(e) {
      const self = this;
      const avail = SM.TRADITIONS.filter(function (t) {
        if (e.traditions.indexOf(t.id) >= 0) return false;
        if (t.req) {
          for (let i = 0; i < t.req.length; i++) if (e.traditions.indexOf(t.req[i]) < 0) return false;
        }
        return e.resources.unity >= self.traditionCost(e, t);
      });
      if (!avail.length) return;
      if (this.state.day % (SM.DAYS_PER_MONTH * 6) !== 0) return;
      const t = avail[Math.floor(this.rng.next() * avail.length)];
      this.buyTradition(e, t.id);
    }

    aiFleets(e) {
      const self = this;
      const fleets = this.combatFleets(e).filter(function (f) { return !f.travel; });
      if (!fleets.length) return;
      const cap = this.colony(e.capital);
      const capSys = cap ? cap.systemId : fleets[0].systemId;
      const wars = this.warsFor(e);
      if (!wars.length) {
        if (this.aiHuntNeutrals(e, fleets)) return;
        fleets.forEach(function (f) {
          if (f.systemId !== capSys && !f.mission && self.state.day - (f.lastOrderDay || 0) > 120) {
            self.moveFleet(f, capSys, true);
          }
        });
        return;
      }
      const war = wars[0];
      const enemyId = war.a === e.id ? war.b : war.a;
      const enemy = this.empire(enemyId);
      if (!enemy || !enemy.alive) return;
      const mySystems = this.ownedSystems(e.id).map(function (s) { return s.id; });
      // 防守：敌方舰队进入我方领土
      let defendTarget = null;
      for (let i = 0; i < this.state.fleets.length; i++) {
        const f = this.state.fleets[i];
        if (f.owner !== enemyId || f.travel || f.kind !== 'combat') continue;
        if (mySystems.indexOf(f.systemId) >= 0) { defendTarget = f.systemId; break; }
      }
      if (defendTarget) {
        fleets.forEach(function (f) {
          if (f.systemId !== defendTarget && self.state.day - (f.lastOrderDay || 0) > 60) self.moveFleet(f, defendTarget, true);
        });
        return;
      }
      // 进攻：优先攻击敌方殖民地
      const enemyColonies = enemy.colonies.map(this.colony.bind(this)).filter(function (c) { return c && !c.occupiedBy; });
      if (!enemyColonies.length) return;
      const fromSys = fleets[0].systemId;
      const scored = enemyColonies.map(function (c) {
        const jumps = SM.Galaxy.jumpsBetween(self.state.systems, fromSys, c.systemId);
        const defense = self.fleetsIn(c.systemId).filter(function (f) { return f.owner === enemyId; })
          .reduce(function (a, f) { return a + self.fleetPower(f); }, 0) + (c.starbase.hull > 0 ? SM.STARBASE_LEVELS[c.starbase.level].power : 0);
        const enemyCap = enemy.capital ? self.colony(enemy.capital) : null;
        return { c: c, score: (isFinite(jumps) ? jumps * 20 : 500) + defense * 0.4 + (enemyCap && c.systemId === enemyCap.systemId ? -20 : 0) };
      }).sort(function (a, b) { return a.score - b.score; });
      const target = scored[0].c;
      fleets.forEach(function (f) {
        if (self.state.day - (f.lastOrderDay || 0) > 90) self.moveFleet(f, target.systemId, true);
      });
    }

    aiMergeFleets(e) {
      const self = this;
      const fleets = this.combatFleets(e).filter(function (f) { return !f.travel && !f.mission; });
      for (let i = 0; i < fleets.length; i++) {
        for (let j = i + 1; j < fleets.length; j++) {
          if (fleets[i].systemId === fleets[j].systemId && fleets[i].ships.length && fleets[j].ships.length) {
            fleets[i].ships = fleets[i].ships.concat(fleets[j].ships);
            this.removeFleet(fleets[j]);
          }
        }
      }
    }

    aiHuntNeutrals(e, fleets) {
      const self = this;
      const strongest = fleets.slice().sort(function (a, b) { return self.fleetPower(b) - self.fleetPower(a); })[0];
      if (!strongest) return false;
      const power = this.fleetPower(strongest);
      if (power < 260) return false;
      const owned = this.ownedSystems(e.id).map(function (s) { return s.id; });
      if (!owned.length) return false;
      const reach = SM.Galaxy.reach(this.state.systems, owned, 4);
      const capColony = this.colony(e.capital);
      const capSysId = capColony ? capColony.systemId : null;
      const targets = [];
      this.state.fleets.forEach(function (f) {
        if (f.owner !== null || !f.neutral || !f.ships.length) return;
        if (reach.indexOf(f.systemId) < 0 && f.systemId !== capSysId) return;
        if (self.fleetPower(f) * 1.35 > power) return;
        targets.push(f);
      });
      if (!targets.length) return false;
      const target = targets[0];
      if (strongest.systemId === target.systemId) return false;
      if (this.state.day - (strongest.lastOrderDay || 0) < 120) return false;
      this.moveFleet(strongest, target.systemId, true);
      return true;
    }

    cleanupEmpires() {
      const self = this;
      this.state.empires.forEach(function (e) {
        if (!e.alive) return;
        const colonyCount = e.colonies.filter(function (cid) {
          const c = self.colony(cid);
          return c && !c.occupiedBy;
        }).length;
        if (colonyCount > 0) return;
        // 还有殖民船/订单就不算灭亡
        const hasShip = self.state.fleets.some(function (f) { return f.owner === e.id && f.kind === 'colony'; });
        const hasOrder = e.colonies.some(function (cid) {
          const c = self.colony(cid);
          return c && c.shipQueue.some(function (q) { return q.cls === 'colony'; });
        });
        if (hasShip || hasOrder) return;
        // 被占领的殖民地直接移交给占领者
        e.colonies.slice().forEach(function (cid) {
          const c = self.colony(cid);
          if (!c || !c.occupiedBy) return;
          const occ = self.empire(c.occupiedBy);
          if (!occ) return;
          c.owner = occ.id;
          c.occupiedBy = null;
          if (occ.colonies.indexOf(c.id) < 0) occ.colonies.push(c.id);
          if (!occ.capital) occ.capital = c.id;
          const sys = self.system(c.systemId);
          if (sys) sys.owner = occ.id;
          c.defenseMax = self.colonyDefenseMax(c);
          c.defense = c.defenseMax * 0.5;
        });
        e.colonies = [];
        e.alive = false;
        // 释放它占领的别国殖民地
        self.state.colonies.forEach(function (c) {
          if (c.occupiedBy === e.id) {
            c.occupiedBy = null;
            c.defense = self.colonyDefenseMax(c) * 0.4;
          }
        });
        // 释放无主星系
        self.state.systems.forEach(function (s) {
          if (s.owner === e.id) {
            s.owner = null;
            s.stations = { mining: null, research: null };
          }
        });
        self.state.wars = self.state.wars.filter(function (w) { return w.a !== e.id && w.b !== e.id; });
        self.state.fleets.filter(function (f) { return f.owner === e.id; }).forEach(function (f) { self.removeFleet(f); });
        self.notice('war', e.name + ' 已经灭亡。', { icon: '🪦', autoPause: e.isPlayer });
      });
    }

    /* ---------------------------------------------------------------- */
    /* 结局                                                              */
    /* ---------------------------------------------------------------- */
    scoreOf(e) {
      const pops = this.empirePops(e);
      const techs = Object.keys(e.techs).length;
      const colonies = this.empireColonyCount(e);
      const power = this.empirePower(e);
      const systems = this.ownedSystems(e.id).length;
      return Math.round(pops * 2 + techs * 15 + colonies * 25 + power / 10 + systems * 3 + e.traditions.length * 20);
    }

    checkGameEnd() {
      const s = this.state;
      if (s.gameOver && (s.gameOver.type === 'defeat' || s.gameOver.type === 'victory')) return;
      const player = this.player();
      const hasColonyShip = this.state.fleets.some(function (f) { return f.owner === player.id && f.kind === 'colony'; }) ||
        player.colonies.some(function (cid) { const c = this.colony(cid); return c && c.shipQueue.some(function (q) { return q.cls === 'colony'; }); }, this);
      if (!player.alive || (this.empireColonyCount(player) === 0 && !hasColonyShip)) {
        if (!s.gameOver || s.gameOver.type !== 'defeat') {
          s.gameOver = { type: 'defeat', day: s.day };
          this.notice('war', '帝国陨落。我们在群星之间的故事结束了。', { icon: '💀', autoPause: true });
        }
        return;
      }
      const others = s.empires.filter(function (e) { return e.id !== player.id; });
      const aliveOthers = others.filter(function (e) { return e.alive && this.empireColonyCount(e) > 0; }, this);
      if (!aliveOthers.length) {
        s.gameOver = { type: 'victory', day: s.day, reason: '征服' };
        this.notice('victory', '银河属于我们了！所有敌对帝国都已被消灭。', { icon: '👑', autoPause: true });
        return;
      }
      const year = SM.dateParts(s.day).year;
      if (year >= SM.VICTORY_YEAR && !s.scoreShown) {
        s.scoreShown = true;
        s.gameOver = { type: 'score', day: s.day, scores: this.scoreBoard() };
        this.notice('victory', '纪元结算：' + SM.VICTORY_YEAR + ' 年到来。', { icon: '🏆', autoPause: true });
      }
      if (year >= SM.END_YEAR && (!s.gameOver || s.gameOver.type === 'score')) {
        s.gameOver = { type: 'end', day: s.day, scores: this.scoreBoard() };
      }
    }

    scoreBoard() {
      const self = this;
      return this.state.empires.filter(function (e) { return e.alive || e.isPlayer; }).map(function (e) {
        return {
          id: e.id, name: e.name, color: e.color, isPlayer: e.isPlayer,
          score: self.scoreOf(e), pops: self.empirePops(e), colonies: self.empireColonyCount(e),
          techs: Object.keys(e.techs).length, power: self.empirePower(e), traditions: e.traditions.length
        };
      }).sort(function (a, b) { return b.score - a.score; });
    }

    continueAfterScore() {
      if (this.state.gameOver && this.state.gameOver.type === 'score') this.state.gameOver = null;
    }

    /* ---------------------------------------------------------------- */
    /* 通知与存档                                                        */
    /* ---------------------------------------------------------------- */
    notice(type, text, opts) {
      opts = opts || {};
      const player = this.player();
      if (opts.empireId && player && opts.empireId !== player.id &&
        ['war', 'diplo', 'victory', 'event'].indexOf(type) < 0) {
        return;
      }
      const n = {
        id: ++this.noticeSeq,
        day: this.state.day,
        type: type,
        text: text,
        icon: opts.icon || '•',
        systemId: opts.systemId || null,
        planetId: opts.planetId || null,
        empireId: opts.empireId || null,
        autoPause: !!opts.autoPause,
        event: opts.event || null,
        firstHabitable: !!opts.firstHabitable,
        firstContact: !!opts.firstContact,
        otherId: opts.otherId || null,
        warOnPlayer: !!opts.warOnPlayer,
        attackerId: opts.attackerId || null,
        incoming: !!opts.incoming,
        ultimatum: !!opts.ultimatum
      };
      this.notices.push(n);
      if (this.notices.length > 80) this.notices.shift();
      this.state.log.push({ day: n.day, text: text, type: type, icon: n.icon, systemId: n.systemId });
      if (this.state.log.length > 120) this.state.log.shift();
    }

    takeNotices() {
      const out = this.notices;
      this.notices = [];
      return out;
    }

    serialize() {
      return JSON.stringify({ v: 1, opts: this.opts, rng: this.rng.s, state: this.state });
    }

    static deserialize(json) {
      let data;
      try { data = JSON.parse(json); } catch (err) { return null; }
      if (!data || !data.state) return null;
      const game = Object.create(Game.prototype);
      game.opts = data.opts;
      game.rng = new RNG(1);
      game.rng.s = data.rng >>> 0;
      game.state = data.state;
      game.notices = [];
      game.noticeSeq = 0;
      if (!game.state.notices) game.state.notices = [];
      if (!game.state.eventLastFired) game.state.eventLastFired = {};
      if (!game.state.delayedEvents) game.state.delayedEvents = [];
      if (game.state.lastEventDay === undefined) game.state.lastEventDay = -9999;
      if (game.state.pendingUltimatum === undefined) game.state.pendingUltimatum = null;
      // 兼容：补全缺失字段
      game.state.empires.forEach(function (e) {
        if (!e.permanentMods) e.permanentMods = {};
        if (!e.techCounts) e.techCounts = {};
        Object.keys(e.techs || {}).forEach(function (id) {
          if (!e.techCounts[id]) e.techCounts[id] = 1;
        });
        e.mods = game.computeMods(e);
        if (!e.research) e.research = {};
        CATS.forEach(function (cat) {
          if (!e.research[cat]) e.research[cat] = { current: null, options: [], progress: 0 };
        });
        if (!e.ai) e.ai = { nextDiploDay: 0, nextWarDay: 0, lastPeaceOffer: -9999, target: null };
      });
      game.state.systems.forEach(function (s) {
        if (!s.stations) s.stations = { mining: null, research: null };
        if (!s.surveyed) s.surveyed = {};
        if (!s.deposits) s.deposits = { energy: 0, minerals: 0, research: 0 };
      });
      game.state.colonies.forEach(function (c) {
        if (!c.assigned) c.assigned = {};
        if (!c.queue) c.queue = [];
        if (!c.shipQueue) c.shipQueue = [];
        if (!c.starbase) c.starbase = { level: 1, hull: 320, hullMax: 320, shield: 0, shieldMax: 0 };
      });
      game.state.empires.forEach(function (e) { if (e.alive) game.refreshEconomy(e); });
      return game;
    }
  }

  SM.Game = Game;
})(typeof window !== 'undefined' ? window : globalThis);
