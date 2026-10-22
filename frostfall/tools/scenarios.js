/* CDP 测试场景（仅开发用） */
module.exports = {
  /* 开局状态自检 */
  async basic(ev) {
    const info = await ev(`(() => {
      const g = window.__fw.game;
      return { day: g.state.day, pop: g.state.pop, b: g.state.buildings.length,
               palette: document.querySelectorAll('.pitem').length,
               chips: document.querySelectorAll('.res-chip').length,
               speedBtns: document.querySelectorAll('#speedBox button').length,
               temp: document.getElementById('wTemp').textContent };
    })()`);
    console.log('状态:', JSON.stringify(info));
  },

  /* 建一圈东西 + 选中地块，检查建造流程与侧栏 */
  async build(ev) {
    const out = await ev(`(() => {
      const { game: g, renderer: r, UI } = window.__fw;
      const FW = window.FW;
      const log = [];
      function nearest(type, need) {
        for (let ring = 1; ring <= 7; ring++) for (let s = 0; s < 16; s++) {
          const t = g.tile(ring, s);
          if (!t || t.kind) continue;
          if (need && t.feat !== need) continue;
          if (!need && t.feat) continue;
          if (!g.isConnected(t) && !g.pathRoads(ring, s)) continue;
          return t;
        }
        return null;
      }
      function place(type) {
        const def = FW.BLD[type];
        const t = nearest(type, def.need);
        if (!t) { log.push(type + ':no-tile'); return; }
        if (!g.isConnected(t)) g.autoRoad(t.r, t.s);
        const res = g.build(type, t.r, t.s);
        log.push(type + ':' + (res.ok ? 'ok@' + t.r + ',' + t.s : res.why));
      }
      ['coalmine','sawmill','hunter','cookhouse','workshop','tent','tent','medical'].forEach(place);
      UI.setSpeed(2);
      const mine = g.state.buildings.find(b => b.type === 'coalmine');
      if (mine) { r.selected = { r: mine.r, s: mine.s, sel: true }; UI.sideSig = ''; }
      return { log, buildings: g.state.buildings.length, wood: g.state.res.wood, steel: g.state.res.steel };
    })()`);
    console.log(JSON.stringify(out));
    await new Promise((r) => setTimeout(r, 2500));
  },

  /* 中期：第 12 天，带蒸汽枢纽与外围工业区 */
  async mid(ev, sleep) {
    const r = await ev(`(() => {
      const { game: g, renderer: r, UI } = window.__fw;
      const FW = window.FW;
      Object.assign(g.state.res, { wood: 700, steel: 400, coal: 1200, raw: 200, meal: 400 });
      for (const id of ['pipe1','gen2','heater','hub','wood2']) g.state.techs[id] = true;
      g.recalcMods();
      g.setGenLevel(3);
      function nearest(type, need, minRing) {
        for (let ring = minRing || 1; ring <= 7; ring++) for (let s = 0; s < 16; s++) {
          const t = g.tile(ring, s);
          if (!t || t.kind) continue;
          if (need && t.feat !== need) continue;
          if (!need && t.feat) continue;
          if (!g.isConnected(t) && !g.pathRoads(ring, s)) continue;
          return t;
        }
        return null;
      }
      function place(type, minRing) {
        const def = FW.BLD[type];
        const t = nearest(type, def.need, minRing);
        if (!t) return null;
        if (!g.isConnected(t)) g.autoRoad(t.r, t.s);
        const res = g.build(type, t.r, t.s);
        return res.ok ? t : null;
      }
      ['coalmine','coalmine','sawmill','sawmill','steelworks','hunter','hunter','cookhouse','workshop','medical'].forEach(t => place(t));
      for (let i = 0; i < 4; i++) place('tent');
      const hub = place('hub', 4);
      if (hub) { place('coalmine', 5); place('sawmill', 5); place('medical', 5); }
      g.state.day = 12; g.state.hour = 9;
      g.updateWeather();
      for (let i = 0; i < 12; i++) g.advance(1);
      UI.setSpeed(1);
      UI.closeModal();
      UI.sideSig = '';
      const b = g.state.buildings.find(x => x.type === 'hub');
      if (b) r.selected = { r: b.r, s: b.s, sel: true };
      return { hub: !!b, b: g.state.buildings.length, temp: g.state.weather.temp, hubs: g.hubs().length };
    })()`);
    console.log(JSON.stringify(r));
    await sleep(1200);
  },

  /* 模拟人类玩 8 天：自动建造 + 快进 + 自动处理事件 */
  async run8(ev, sleep) {
    const out = await ev(`(() => {
      const { game: g, renderer: r, UI } = window.__fw;
      const FW = window.FW;
      const trace = [];
      function nearest(type, need) {
        for (let ring = 1; ring <= 7; ring++) for (let s = 0; s < 16; s++) {
          const t = g.tile(ring, s);
          if (!t || t.kind) continue;
          if (need && t.feat !== need) continue;
          if (!need && t.feat) continue;
          if (!g.isConnected(t) && !g.pathRoads(ring, s)) continue;
          return t;
        }
        return null;
      }
      function place(type) {
        const def = FW.BLD[type];
        if (!g.canAfford(def.cost)) return false;
        const t = nearest(type, def.need);
        if (!t) return false;
        if (!g.isConnected(t)) g.autoRoad(t.r, t.s);
        return g.build(type, t.r, t.s).ok;
      }
      function count(t) { return g.state.buildings.filter(b => b.type === t).length; }
      for (let day = 1; day <= 8; day++) {
        const S = g.state;
        if (!count('coalmine')) place('coalmine');
        if (!count('sawmill')) place('sawmill');
        if (!count('cookhouse')) place('cookhouse');
        if (!count('hunter')) place('hunter');
        if (!count('workshop')) place('workshop');
        if (!count('medical') && S.sick > 3) place('medical');
        while (g.housing().cap < S.pop + 8) { if (!place('tent')) break; }
        if (S.res.raw < 40) place('hunter');
        if (S.res.coal < 160) place('coalmine');
        if (S.res.wood < 50) place('sawmill');
        if (S.res.steel < 40) place('steelworks');
        for (const id of FW.TECH_ORDER) { if (g.canResearch(id).ok) { g.research(id); break; } }
        if (S.res.coal > 200 && S.gen.level < g.state.genCap) g.setGenLevel(S.gen.level + 1);
        for (let h = 0; h < 24; h++) {
          g.advance(1);
          while (S.queue.length) {
            trace.push('事件:' + S.queue[0].title);
            g.resolveEvent(0);
            UI.sideSig = '';
          }
          if (S.gameOver) break;
        }
        trace.push('D' + S.day + ' 人' + Math.round(S.pop) + ' 病' + Math.round(S.sick) +
                   ' 希' + Math.round(S.hope) + ' 怨' + Math.round(S.discontent) + ' 技' + Object.keys(S.techs).length);
        if (S.gameOver) break;
      }
      UI.setSpeed(1);
      UI.sideSig = '';
      const mine = g.state.buildings.find(b => b.type === 'coalmine');
      if (mine) r.selected = { r: mine.r, s: mine.s, sel: true };
      return { trace, over: g.state.gameOver };
    })()`);
    console.log(out.trace.join('\n'));
    console.log('结局:', out.over);
    await sleep(1200);
  },

  /* 帮助 / 日志 / 重开 流程 */
  async flow(ev, sleep) {
    const r1 = await ev(`(() => {
      const { UI } = window.__fw;
      UI.openHelp();
      return document.querySelectorAll('.modal.help h4').length;
    })()`);
    console.log('帮助小节数:', r1);
    await sleep(400);
    const r2 = await ev(`(() => {
      const { UI, game: g } = window.__fw;
      UI.closeModal();
      for (let i = 0; i < 30; i++) g.log('测试日志 ' + i, i % 3 ? '' : 'bad');
      document.getElementById('btnLog').click();
      return document.querySelectorAll('.log-item').length;
    })()`);
    console.log('日志条数:', r2);
    await sleep(300);
    const r3 = await ev(`(() => {
      const { UI, game: g } = window.__fw;
      UI.closeModal();
      g.state.gameOver = 'riot';
      UI.pump();
      const hasBtn = !!document.querySelector('[data-mact="restart"]');
      document.querySelector('[data-mact="restart"]').click();
      return { hasBtn, day: window.__fw.game.state.day, pop: window.__fw.game.state.pop,
               buildings: window.__fw.game.state.buildings.length, over: window.__fw.game.state.gameOver };
    })()`);
    console.log('重开:', JSON.stringify(r3));
    await sleep(900);
  },

  /* 风暴中的城市 */
  async storm(ev, sleep) {
    const r = await ev(`(() => {
      const { game: g, renderer: r, UI } = window.__fw;
      const FW = window.FW;
      Object.assign(g.state.res, { wood: 900, steel: 700, coal: 2600, raw: 300, meal: 900 });
      for (const id of ['pipe1','pipe2','gen2','gen3','heater','insul','house','hub','wood2','coal2','steel2','medic2','food2']) g.state.techs[id] = true;
      g.recalcMods();
      g.setGenLevel(4);
      function nearest(type, need, minRing) {
        for (let ring = minRing || 1; ring <= 7; ring++) for (let s = 0; s < 16; s++) {
          const t = g.tile(ring, s);
          if (!t || t.kind) continue;
          if (need && t.feat !== need) continue;
          if (!need && t.feat) continue;
          if (!g.isConnected(t) && !g.pathRoads(ring, s)) continue;
          return t;
        }
        return null;
      }
      function place(type, minRing) {
        const def = FW.BLD[type];
        const t = nearest(type, def.need, minRing);
        if (!t) return null;
        if (!g.isConnected(t)) g.autoRoad(t.r, t.s);
        return g.build(type, t.r, t.s).ok ? t : null;
      }
      const plan = ['coalmine','coalmine','coalmine','sawmill','sawmill','steelworks','steelworks',
                    'hunter','hunter','cookhouse','cookhouse','workshop','workshop','medical','medical',
                    'hub','hub','hub','tent','tent','tent','house','house','tent','tent','tent'];
      for (let i = 0; i < 3; i++) for (const t of plan) place(t);
      g.state.day = 21; g.state.hour = 13;
      g.updateWeather();
      for (let i = 0; i < 8; i++) g.advance(1);
      g.setOverdrive(true);
      UI.setSpeed(2);
      UI.closeModal();
      UI.sideSig = '';
      r.selected = null;
      return { b: g.state.buildings.length, pop: Math.round(g.state.pop), temp: g.state.weather.temp, storm: g.state.storm };
    })()`);
    console.log(JSON.stringify(r));
    await sleep(1600);
  },

  /* 近景：拉近看建筑模型 */
  async closeup(ev, sleep) {
    const r = await ev(`(() => {
      const { game: g, renderer: r, UI } = window.__fw;
      const FW = window.FW;
      Object.assign(g.state.res, { wood: 900, steel: 600, coal: 1400, raw: 200, meal: 500 });
      for (const id of ['pipe1','gen2','heater','hub','house','wood2']) g.state.techs[id] = true;
      g.recalcMods(); g.setGenLevel(2);
      function place(type, ring, s) {
        const t = g.tile(ring, s);
        if (!t || t.kind) return false;
        if (!g.isConnected(t)) g.autoRoad(ring, s);
        return g.build(type, ring, s).ok;
      }
      place('tent', 1, 1); place('tent', 1, 3); place('house', 1, 5); place('cookhouse', 2, 1);
      place('medical', 2, 3); place('workshop', 2, 5); place('coalmine', 3, 3);
      place('sawmill', 3, 5); place('steelworks', 3, 7); place('hunter', 2, 7);
      place('hub', 2, 9);
      for (let i = 0; i < 6; i++) g.advance(1);
      UI.setSpeed(1); UI.closeModal();
      r.cam.x = 0; r.cam.y = -40; r.userZoom = true;
      r.cam.zoom = r.cam.baseZoom * 2.1;
      r.selected = { r: 3, s: 5, sel: true };
      r.hover = { r: 2, s: 6 };
      UI.sideSig = '';
      return { b: g.state.buildings.length };
    })()`);
    console.log(JSON.stringify(r));
    await sleep(1200);
  },

  /* 结局界面 */
  async end(ev, sleep) {
    await ev(`(() => {
      const { game: g, UI } = window.__fw;
      g.state.day = 22; g.state.hour = 23;
      g.state.pop = 63; g.state.dead = 41; g.state.hope = 58; g.state.discontent = 44;
      g.state.techs = { pipe1: 1, gen2: 1 };
      g.state.gameOver = 'victory';
      UI.pump();
      return 1;
    })()`);
    await sleep(700);
  },

  /* 拖拽手感：光标下的地面点必须黏在光标上 */
  async pan(ev, sleep) {
    const out = await ev(`(() => {
      const { renderer: r } = window.__fw;
      const cv = document.getElementById('cv');
      const rect = cv.getBoundingClientRect();
      const res = [];
      // 1) 直接调用 pan：位移 200px 后，原光标点应落到新光标点
      const a0 = r.screenToWorld(800, 450);
      r.pan(200, 0, 800, 450);
      const a1 = r.screenToWorld(1000, 450);
      res.push({ case: 'pan+200x', drift: +Math.hypot(a1.x - a0.x, a1.y - a0.y).toFixed(3) });
      // 2) 竖向
      const b0 = r.screenToWorld(800, 450);
      r.pan(0, 150, 800, 450);
      const b1 = r.screenToWorld(800, 600);
      res.push({ case: 'pan+150y', drift: +Math.hypot(b1.x - b0.x, b1.y - b0.y).toFixed(3) });
      // 3) 真实鼠标拖拽：向右拖动应当让画面跟着往右（世界目标点左移）
      r.center();
      const before = r.screenToWorld(800, 450);
      const camBefore = { x: r.cam.x, y: r.cam.y };
      function ev2(type, x, y, target) {
        target.dispatchEvent(new MouseEvent(type, { clientX: rect.left + x, clientY: rect.top + y, button: 0, bubbles: true, cancelable: true }));
      }
      ev2('mousedown', 800, 450, cv);
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 860, clientY: rect.top + 450, button: 0, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: rect.left + 940, clientY: rect.top + 450, button: 0, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: rect.left + 940, clientY: rect.top + 450, button: 0, bubbles: true }));
      const after = r.screenToWorld(940, 450);
      res.push({
        case: 'drag right 140px',
        drift: +Math.hypot(after.x - before.x, after.y - before.y).toFixed(3),
        camDX: +(r.cam.x - camBefore.x).toFixed(2),
        camDY: +(r.cam.y - camBefore.y).toFixed(2),
        selectedAfterDrag: r.selected
      });
      // 4) 滚轮缩放应以光标为锚点
      r.center();
      const c0 = r.screenToWorld(600, 300);
      r.zoomAt(600, 300, 1.3);
      const c1 = r.screenToWorld(600, 300);
      res.push({ case: 'zoom at cursor', drift: +Math.hypot(c1.x - c0.x, c1.y - c0.y).toFixed(3) });
      r.center();
      return res;
    })()`);
    console.log(JSON.stringify(out, null, 1));
    await sleep(400);
  },

  /* 真实点击流程：建造栏 → 地图点击 → 选中 */
  async play(ev, sleep) {
    const r = await ev(`(() => {
      const { game: g, renderer: r, UI } = window.__fw;
      const cv = document.getElementById('cv');
      const rect = cv.getBoundingClientRect();
      function tileScreen(ring, s) {
        const FW = window.FW;
        const THREE = window.THREE;
        const ang = FW.angleOf(s);
        const rad = FW.ringInner(ring) + FW.GEO.RING_W / 2;
        const v = new THREE.Vector3(Math.cos(ang) * rad, 1.5, Math.sin(ang) * rad).project(r.camera);
        return {
          x: rect.left + (v.x * 0.5 + 0.5) * r.w,
          y: rect.top + (-v.y * 0.5 + 0.5) * r.h
        };
      }
      function clickAt(p, button) {
        const opts = { clientX: p.x, clientY: p.y, button: button || 0, bubbles: true, cancelable: true };
        cv.dispatchEvent(new MouseEvent('mousedown', opts));
        window.dispatchEvent(new MouseEvent('mouseup', opts));
      }
      const before = { wood: g.state.res.wood, b: g.state.buildings.length };
      document.querySelector('.pitem[data-type="tent"]').click();
      const mode = UI.buildMode;
      clickAt(tileScreen(2, 1));
      const afterTent = { wood: g.state.res.wood, b: g.state.buildings.length, tile: !!g.tile(2, 1).kind };
      document.querySelector('.pitem[data-type="road"]').click();
      clickAt(tileScreen(3, 0));
      clickAt(tileScreen(4, 0));
      const roads = g.state.buildings.filter(x => x.type === 'road').length;
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      clickAt(tileScreen(2, 1));
      const sel = r.selected;
      UI.setSpeed(2);
      return { mode, before, afterTent, roads, sel, buildMode: UI.buildMode };
    })()`);
    console.log(JSON.stringify(r));
    await sleep(1500);
  },

  /* 科技面板 */
  async tech(ev) {
    await ev(`(() => {
      const { game: g, UI } = window.__fw;
      g.state.rp = 400;
      UI.openTech();
      return 1;
    })()`);
    await new Promise((r) => setTimeout(r, 600));
  },

  /* 事件弹窗 */
  async event(ev) {
    await ev(`(() => {
      const { game: g, UI } = window.__fw;
      g.state.day = 4; g.state.hour = 7;
      g.tryEvents();
      UI.pump();
      return g.state.queue.length;
    })()`);
    await new Promise((r) => setTimeout(r, 700));
  }
};
