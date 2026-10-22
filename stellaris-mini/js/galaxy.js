/* =========================================================================
 * 星系生成：螺旋银河、超空间航道、行星、首都、中立生物
 * ========================================================================= */
(function (g) {
  'use strict';
  const SM = g.SM;
  const Galaxy = (SM.Galaxy = {});

  function pickWeighted(rng, table, key) {
    const items = Object.keys(table).map(function (k) { return { k: k, w: table[k][key] }; });
    let total = 0;
    items.forEach(function (it) { total += it.w; });
    let r = rng.next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= items[i].w;
      if (r <= 0) return items[i].k;
    }
    return items[items.length - 1].k;
  }

  function gauss(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng.next();
    while (v === 0) v = rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  function makePlanet(rng, system, idx, habitable, name) {
    const type = habitable
      ? SM.HABITABLE_TYPES[Math.floor(rng.next() * SM.HABITABLE_TYPES.length)]
      : SM.UNINHABITABLE_TYPES[Math.floor(rng.next() * SM.UNINHABITABLE_TYPES.length)];
    const def = SM.PLANET_TYPES[type];
    const size = habitable ? rng.int(11, 20) : (type === 'asteroid' ? rng.int(4, 8) : rng.int(6, 26));
    const planet = {
      id: system.id + '-p' + idx,
      index: idx,
      name: name,
      type: type,
      size: size,
      habitable: habitable,
      colonyId: null,
      homeworld: false,
      deposits: { energy: 0, minerals: 0, research: 0 },
      maxDistricts: null,
      anomaly: false,
      surveyed: false
    };
    if (!habitable) {
      if (rng.chance(0.55)) planet.deposits.energy = rng.int(3, 9);
      if (rng.chance(0.55)) planet.deposits.minerals = rng.int(3, 9);
      if (rng.chance(0.22)) planet.deposits.research = rng.int(2, 6);
    } else {
      if (rng.chance(0.3)) planet.deposits.minerals = rng.int(2, 4);
      planet.maxDistricts = computeMaxDistricts(rng, size);
    }
    return planet;
  }

  function computeMaxDistricts(rng, size) {
    const city = Math.min(7, 2 + Math.floor(size / 5));
    let rem = Math.max(3, size - city);
    let gen = Math.max(1, Math.round(rem * (0.28 + rng.next() * 0.12)));
    let min = Math.max(1, Math.round(rem * (0.28 + rng.next() * 0.12)));
    if (gen + min > rem - 1) { min = Math.max(1, rem - gen - 1); }
    let agri = Math.max(1, rem - gen - min);
    if (gen + min + agri > size) { agri = Math.max(1, size - city - gen - min); }
    return { city: city, generator: gen, mining: min, agri: agri };
  }

  Galaxy.computeMaxDistricts = computeMaxDistricts;

  Galaxy.generate = function (rng, count) {
    count = count || SM.GALAXY_SIZE;
    const systems = [];
    const usedNames = {};

    function newName() {
      for (let i = 0; i < 200; i++) {
        const base = SM.SYSTEM_NAMES[Math.floor(rng.next() * SM.SYSTEM_NAMES.length)];
        if (!usedNames[base]) { usedNames[base] = 1; return base; }
      }
      for (let i = 0; i < 200; i++) {
        const base = SM.SYSTEM_NAMES[Math.floor(rng.next() * SM.SYSTEM_NAMES.length)] + ' ' + SM.ROMAN[Math.floor(rng.next() * SM.ROMAN.length)];
        if (!usedNames[base]) { usedNames[base] = 1; return base; }
      }
      return '未命名-' + systems.length;
    }

    function addSystem(x, y, star, core) {
      const sys = {
        id: 's' + systems.length,
        name: core ? '银河之心' : newName(),
        x: x, y: y,
        star: star,
        core: !!core,
        planets: [],
        lanes: [],
        owner: null,
        colonyId: null,
        stations: { mining: null, research: null },
        surveyed: {},
        surveyCount: 0,
        anomaly: null,
        anomalyKnown: {},
        hostiles: null,
        capitalOf: null,
        battle: null,
        raid: null
      };
      systems.push(sys);
      return sys;
    }

    // 银河中心：超大质量黑洞
    const core = addSystem(0, 0, 'blackhole', true);
    core.deposits = { energy: 18, minerals: 12, research: 10 };

    let attempts = 0;
    while (systems.length < count && attempts < 20000) {
      attempts++;
      const arm = Math.floor(rng.next() * 4);
      const t = Math.pow(rng.next(), 0.82);
      const r = 280 + t * 1230;
      const spread = 0.06 + 0.20 * t;
      const angle = arm * (Math.PI / 2) + 2.3 * t + gauss(rng) * spread;
      const x = Math.cos(angle) * r;
      const y = Math.sin(angle) * r * 0.62;
      if (systems.some(function (s) { return Math.hypot(s.x - x, s.y - y) < 168; })) continue;
      addSystem(x, y, pickWeighted(rng, SM.STAR_TYPES, 'weight'), false);
    }

    // 行星
    systems.forEach(function (sys) {
      if (sys.core) {
        sys.planets.push(makePlanet(rng, sys, 0, false, sys.name + ' I'));
        return;
      }
      const def = SM.STAR_TYPES[sys.star];
      const n = rng.int(def.planets[0], def.planets[1]);
      let habCount = 0;
      for (let i = 0; i < n; i++) {
        const habitable = rng.chance(def.habitable) && habCount < 2;
        if (habitable) habCount++;
        sys.planets.push(makePlanet(rng, sys, i, habitable, sys.name + ' ' + SM.ROMAN[i]));
      }
    });

    // 航道：近邻 + 最小生成树 + 少量环路
    const edges = {};
    function key(a, b) { return a < b ? a + '|' + b : b + '|' + a; }
    function addEdge(a, b) {
      if (a === b) return false;
      const k = key(a, b);
      if (edges[k]) return false;
      const A = systems[a], B = systems[b];
      if (A.lanes.length >= 6 || B.lanes.length >= 6) return false;
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      if (d > 560) return false;
      edges[k] = d;
      A.lanes.push(b); B.lanes.push(a);
      return true;
    }

    // 每个系统的两个最近邻
    systems.forEach(function (sys, i) {
      const near = systems
        .map(function (s, j) { return { j: j, d: Math.hypot(s.x - sys.x, s.y - sys.y) }; })
        .filter(function (o) { return o.j !== i && o.d < 470; })
        .sort(function (a, b) { return a.d - b.d; })
        .slice(0, 3);
      near.forEach(function (o, k) {
        if (k < 2 || (o.d < 360 && rng.chance(0.4))) addEdge(i, o.j);
      });
    });

    // 最小生成树（Prim）
    const inTree = [0];
    const seen = new Set([0]);
    while (inTree.length < systems.length) {
      let best = null;
      for (let i = 0; i < systems.length; i++) {
        if (!seen.has(i)) continue;
        for (let j = 0; j < systems.length; j++) {
          if (seen.has(j)) continue;
          const d = Math.hypot(systems[i].x - systems[j].x, systems[i].y - systems[j].y);
          if (!best || d < best.d) best = { a: i, b: j, d: d };
        }
      }
      if (!best) break;
      seen.add(best.b);
      inTree.push(best.b);
      addEdge(best.a, best.b);
    }

    // 环路
    const pairs = [];
    for (let i = 0; i < systems.length; i++) {
      for (let j = i + 1; j < systems.length; j++) {
        const d = Math.hypot(systems[i].x - systems[j].x, systems[i].y - systems[j].y);
        if (d < 330) pairs.push({ a: i, b: j, d: d });
      }
    }
    pairs.sort(function (a, b) { return a.d - b.d; });
    pairs.forEach(function (p) {
      if (rng.chance(0.48)) addEdge(p.a, p.b);
    });

    // 首都候选：距离最远的 4 个可居住星系
    const candidates = systems.filter(function (s) {
      return !s.core && s.planets.some(function (p) { return p.habitable; });
    });
    const capitals = [];
    if (candidates.length) {
      let start = candidates[Math.floor(rng.next() * candidates.length)];
      capitals.push(start);
      while (capitals.length < 4 && capitals.length < candidates.length) {
        let best = null, bestD = -1;
        candidates.forEach(function (c) {
          if (capitals.indexOf(c) >= 0) return;
          let minD = Infinity;
          capitals.forEach(function (k) { minD = Math.min(minD, Math.hypot(c.x - k.x, c.y - k.y)); });
          if (minD > bestD) { bestD = minD; best = c; }
        });
        if (!best) break;
        capitals.push(best);
      }
    }

    // 首都世界：保证体面的体型与区划
    capitals.forEach(function (sys, idx) {
      let home = null;
      sys.planets.forEach(function (p) { if (p.habitable && (!home || p.size > home.size)) home = p; });
      if (!home) return;
      home.type = 'continental';
      home.size = 20;
      home.homeworld = true;
      home.deposits = { energy: 0, minerals: 0, research: 0 };
      home.maxDistricts = { city: 6, generator: 5, mining: 5, agri: 4 };
      home.name = SM.CAPITAL_NAMES[idx % SM.CAPITAL_NAMES.length];
      sys.capitalOf = 'H' + idx;
      sys.homePlanetId = home.id;
      // 出生点附近保证 2 个可殖民目标
      const near = [sys];
      const q = [sys];
      for (let depth = 0; depth < 2; depth++) {
        const nextQ = [];
        q.forEach(function (cur) {
          cur.lanes.forEach(function (li) {
            const nb = systems[li];
            if (near.indexOf(nb) < 0 && !nb.core) { near.push(nb); nextQ.push(nb); }
          });
        });
        q.length = 0;
        Array.prototype.push.apply(q, nextQ);
      }
      let habNear = near.filter(function (s) { return s.planets.some(function (p) { return p.habitable; }); }).length;
      if (habNear < 3) {
        for (let i = 0; i < near.length && habNear < 3; i++) {
          const s = near[i];
          if (s === sys) continue;
          if (s.planets.some(function (p) { return p.habitable; })) continue;
          const p = makePlanet(rng, s, s.planets.length, true, s.name + ' ' + SM.ROMAN[s.planets.length]);
          p.size = rng.int(13, 18);
          p.maxDistricts = computeMaxDistricts(rng, p.size);
          p.deposits = { energy: 0, minerals: 0, research: 0 };
          s.planets.push(p);
          habNear++;
        }
      }
    });

    // 异常现象
    systems.forEach(function (sys) {
      if (sys.core) return;
      if (rng.chance(0.12)) {
        const anom = SM.ANOMALIES[Math.floor(rng.next() * SM.ANOMALIES.length)];
        sys.anomaly = anom.id;
      }
    });

    // 中立生物：远离首都的荒野，且不能是交通咽喉（避免堵死整片星域）
    const safe = {};
    capitals.forEach(function (c) { safe[c.id] = 1; });
    function isArticulation(idx) {
      const start = idx === 0 ? 1 : 0;
      const seen = {};
      seen[idx] = true;
      seen[start] = true;
      const q = [start];
      let count = 1;
      while (q.length) {
        const cur = q.pop();
        const lanes = systems[cur].lanes;
        for (let i = 0; i < lanes.length; i++) {
          const nb = lanes[i];
          if (!seen[nb]) { seen[nb] = true; count++; q.push(nb); }
        }
      }
      return count < systems.length;
    }
    let wild = systems.filter(function (s) {
      if (s.core || safe[s.id]) return false;
      if (s.lanes.length > 4) return false;
      if (isArticulation(systems.indexOf(s))) return false;
      return capitals.every(function (c) { return Math.hypot(s.x - c.x, s.y - c.y) > 480; });
    });
    if (wild.length < 5) {
      wild = systems.filter(function (s) {
        if (s.core || safe[s.id]) return false;
        if (isArticulation(systems.indexOf(s))) return false;
        return capitals.every(function (c) { return Math.hypot(s.x - c.x, s.y - c.y) > 380; });
      });
    }
    let pool = wild.slice();
    // 洗牌
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    const hostileCount = Math.min(5, pool.length);
    for (let i = 0; i < hostileCount; i++) {
      pool[i].hostiles = [{ cls: 'amoeba', count: rng.int(2, 4) }];
    }
    core.hostiles = [{ cls: 'amoeba', count: 6, guardian: true }];

    return {
      systems: systems,
      capitals: capitals.map(function (c) { return c.id; })
    };
  };

  /* 基于航道的 BFS 求最短路径（返回系统 id 数组，含起点终点） */
  Galaxy.path = function (systems, fromId, toId) {
    if (fromId === toId) return [fromId];
    const start = systems.find(function (s) { return s.id === fromId; });
    const goal = systems.find(function (s) { return s.id === toId; });
    if (!start || !goal) return null;
    const prev = {};
    const seen = {};
    const q = [fromId];
    seen[fromId] = true;
    while (q.length) {
      const cur = q.shift();
      const sys = systems.find(function (s) { return s.id === cur; });
      for (let i = 0; i < sys.lanes.length; i++) {
        const nbId = systems[sys.lanes[i]].id;
        if (seen[nbId]) continue;
        seen[nbId] = true;
        prev[nbId] = cur;
        if (nbId === toId) {
          const path = [toId];
          let p = toId;
          while (p !== fromId) { p = prev[p]; path.unshift(p); }
          return path;
        }
        q.push(nbId);
      }
    }
    return null;
  };

  /* 从一组系统出发、限定跳跃数的可达系统集合 */
  Galaxy.reach = function (systems, fromIds, maxJumps, filter) {
    const byId = {};
    systems.forEach(function (s) { byId[s.id] = s; });
    const dist = {};
    const q = [];
    fromIds.forEach(function (id) { dist[id] = 0; q.push(id); });
    while (q.length) {
      const cur = q.shift();
      if (dist[cur] >= maxJumps) continue;
      const sys = byId[cur];
      for (let i = 0; i < sys.lanes.length; i++) {
        const nb = systems[sys.lanes[i]].id;
        if (dist[nb] === undefined) {
          dist[nb] = dist[cur] + 1;
          q.push(nb);
        }
      }
    }
    const out = [];
    Object.keys(dist).forEach(function (id) {
      if (dist[id] > 0 && (!filter || filter(byId[id]))) out.push(id);
    });
    return out;
  };

  Galaxy.jumpsBetween = function (systems, a, b) {
    const p = Galaxy.path(systems, a, b);
    return p ? p.length - 1 : Infinity;
  };
})(typeof window !== 'undefined' ? window : globalThis);
