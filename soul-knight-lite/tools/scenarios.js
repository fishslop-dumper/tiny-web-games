/* CDP 测试场景 —— 元气骑士 · 轻量版 */
const INIT = `(() => {
  const g = () => window.SK.game;
  const cv = document.getElementById('cv');
  window.__T = {
    key(code, down) {
      window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: code, bubbles: true }));
    },
    tap(code) { this.key(code, true); setTimeout(() => this.key(code, false), 60); },
    aimAt(wx, wy) {
      const gg = g();
      const r = cv.getBoundingClientRect();
      const lx = wx - gg.cam.x, ly = wy - gg.cam.y;
      const sx = r.width / 384, sy = r.height / 216;
      cv.dispatchEvent(new MouseEvent('mousemove', {
        clientX: r.left + lx * sx, clientY: r.top + ly * sy, bubbles: true
      }));
    },
    fire(down) {
      const r = cv.getBoundingClientRect();
      cv.dispatchEvent(new MouseEvent(down ? 'mousedown' : 'mouseup', {
        button: 0, clientX: r.left + r.width * 0.72, clientY: r.top + r.height * 0.4, bubbles: true
      }));
    },
    gotoRoom(type) {
      const gg = g();
      const room = gg.floor.rooms.find(r => r.type === type) || gg.floor.rooms[1];
      gg.player.x = room.rect.x + 256;
      gg.player.y = room.rect.y + 160;
      gg.player.vx = gg.player.vy = 0;
      return room.type;
    },
    info() {
      const gg = g();
      const r = gg.room;
      return {
        state: gg.state, floor: gg.floorNum,
        roomType: r && r.type, roomEnemies: r && r.enemies.length,
        locked: r && r.locked, cleared: r && r.cleared,
        hp: gg.player && Math.round(gg.player.hp * 10) / 10,
        armor: gg.player && Math.round(gg.player.armor * 10) / 10,
        energy: gg.player && Math.round(gg.player.energy),
        coins: gg.player && gg.player.coins,
        weapon: gg.player && gg.player.weapon && gg.player.weapon.name,
        bullets: gg.bullets.length, particles: gg.particles.length,
        boss: gg.boss ? { name: gg.boss.name, hp: Math.round(gg.boss.hp) } : null,
        doors: gg.floor.doors.length, rooms: gg.floor.rooms.length
      };
    },
    clearRoom() {
      const gg = g();
      for (const e of gg.enemies.slice()) e.hurt(9999, 0, gg, false);
      return gg.enemies.length;
    }
  };
  return 1;
})()`;

async function init(ev) { await ev(INIT); }

module.exports = {
  async title(ev) { await init(ev); },

  async char(ev, sleep) {
    await init(ev);
    await ev(`document.getElementById('btnStart').click()`);
    await sleep(420);
  },

  async play(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(260);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
    await ev(`__T.gotoRoom('normal')`);
    await sleep(420);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
    // 走向房间中心，朝最近的敌人开火
    await ev(`(() => {
      const g = window.SK.game;
      const e = g.enemies[0];
      if (e) __T.aimAt(e.x, e.y);
      __T.fire(true);
      __T.key('KeyW', true);
      return 1;
    })()`);
    await sleep(700);
    await ev(`__T.key('KeyW', false)`);
    await sleep(260);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async combat(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(1)`);
    await sleep(220);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(400);
    await ev(`(() => { __T.fire(true); const g = window.SK.game; const e = g.enemies[0]; if (e) __T.aimAt(e.x, e.y); return 1; })()`);
    await sleep(1100);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async boss(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(2)`);
    await sleep(220);
    await ev(`__T.gotoRoom('boss')`);
    await sleep(900);
    await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('smg', 3);
      g.player.invuln = 9999;   // 只为截图，别被打死
      const b = g.boss; if (b) __T.aimAt(b.x, b.y);
      __T.fire(true);
      return 1;
    })()`);
    await sleep(1500);
    await ev(`(() => { const g = window.SK.game; const b = g.boss; if (b) __T.aimAt(b.x, b.y); return 1; })()`);
    await sleep(1200);
    await ev(`(() => { const g = window.SK.game; g.player.hp = 4; g.player.armor = 2; return 1; })()`);
    await sleep(500);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async shop(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(220);
    const t = await ev(`__T.gotoRoom('shop')`);
    console.log('room:', t);
    await sleep(500);
    await ev(`window.SK.game.player.coins = 60`);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async f2(ev, sleep) {
    await init(ev);
    await ev(`(() => { const g = window.SK.game; g.startRun(3); return 1; })()`);
    await sleep(220);
    await ev(`(__T.gotoRoom('normal'), window.SK.game.nextFloor(), 1)`);
    await sleep(900);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(600);
    await ev(`(() => { const g = window.SK.game; g.player.hp = 5; const e = g.enemies[0]; if (e) __T.aimAt(e.x, e.y); __T.fire(true); return 1; })()`);
    await sleep(500);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async f3(ev, sleep) {
    await init(ev);
    await ev(`(() => { const g = window.SK.game; g.startRun(1); g.floorNum = 2; g.nextFloor(); return 1; })()`);
    await sleep(900);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(700);
    await ev(`(() => { const g = window.SK.game; g.player.slots[0] = SK.makeWeapon('laser', 3); const e = g.enemies[0]; if (e) __T.aimAt(e.x, e.y); g.player.aimAng = 0.4; __T.fire(true); return 1; })()`);
    await sleep(700);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async win(ev, sleep) {
    await init(ev);
    await ev(`(() => { const g = window.SK.game; g.startRun(1); g.killCount = 74; g.player.coins = 186; g.startedAt = Date.now() - 913000; g.win(); return 1; })()`);
    await sleep(400);
    console.log('state:', await ev('window.SK.game.state'));
  },

  async clear(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(220);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(400);
    const n = await ev(`__T.clearRoom()`);
    console.log('enemiesLeft:', n);
    await sleep(700);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  async treasure(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(220);
    await ev(`__T.gotoRoom('treasure')`);
    await sleep(500);
    await ev(`(() => { const g = window.SK.game; const c = g.room.pickups.find(p => p.kind === 'chest'); if (c) { g.player.x = c.x; g.player.y = c.y + 14; } return 1; })()`);
    await sleep(600);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  /* 功能回归：清房 → 开门 → 换房 → 打 boss → 传送门 → 下一层 */
  async flow(ev, sleep) {
    await init(ev);
    const out = {};
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(300);
    out.lockedOnEntry = await ev(`(() => {
      const g = window.SK.game;
      const d = g.floor.doors.find(d => d.a === g.room || d.b === g.room);
      const idx = d.tiles[0];
      return { doors: g.floor.doors.filter(x => x.a === g.room || x.b === g.room).map(x => x.locked),
               doorSolid: g.solidTile(idx % g.floor.tw, (idx / g.floor.tw) | 0) };
    })()`);
    out.enemies = await ev(`window.SK.game.room.enemies.length`);
    await ev(`__T.clearRoom()`);
    await sleep(260);
    out.afterClear = await ev(`(() => {
      const g = window.SK.game;
      const d = g.floor.doors.find(d => d.a === g.room || d.b === g.room);
      const idx = d.tiles[0];
      return { cleared: g.room.cleared, doors: g.floor.doors.filter(x => x.a === g.room || x.b === g.room).map(x => x.locked),
               doorSolid: g.solidTile(idx % g.floor.tw, (idx / g.floor.tw) | 0), coins: g.player.coins,
               pickups: g.room.pickups.length };
    })()`);
    // 走进隔壁房间
    out.walk = await ev(`(() => {
      const g = window.SK.game;
      const d = g.floor.doors.find(d => d.a === g.room || d.b === g.room);
      const other = d.a === g.room ? d.b : d.a;
      g.player.x = other.rect.x + 256;
      g.player.y = other.rect.y + 160;
      return { target: other.gx + ',' + other.gy };
    })()`);
    await sleep(300);
    out.roomAfter = await ev(`(() => { const g = window.SK.game; return { room: g.room.gx+','+g.room.gy, enemies: g.enemies.length, type: g.room.type }; })()`);
    // 杀掉 boss（先把玩家挪开，免得传送门直接开在脚下）
    await ev(`__T.gotoRoom('boss')`);
    await sleep(500);
    out.bossSpawn = await ev(`(() => { const g = window.SK.game; return { boss: g.boss && g.boss.name, hp: g.boss && g.boss.hp }; })()`);
    await ev(`(() => { const g = window.SK.game; g.player.x = g.room.rect.x + 90; g.player.y = g.room.rect.y + 90; g.boss.hurt(99999, 0, g, false); return 1; })()`);
    await sleep(400);
    out.afterBoss = await ev(`(() => {
      const g = window.SK.game;
      return { cleared: g.room.cleared, portal: !!g.room.pickups.find(p => p.kind === 'portal'),
               enemies: g.enemies.length, pickups: g.room.pickups.length };
    })()`);
    // 走进传送门
    await ev(`(() => { const g = window.SK.game; const pt = g.room.pickups.find(p => p.kind === 'portal'); if (!pt) return 'no portal'; pt.arm = 0; g.player.x = pt.x; g.player.y = pt.y; return 1; })()`);
    await sleep(600);
    out.talentScreen = await ev(`({ state: window.SK.game.state, cards: document.querySelectorAll('.tcard').length })`);
    await ev(`(() => { const c = document.querySelectorAll('.tcard')[0]; if (c) c.click(); return 1; })()`);
    await sleep(900);
    out.floor2 = await ev(`(() => { const g = window.SK.game; return { state: g.state, floor: g.floorNum, rooms: g.floor.rooms.length, hp: g.player.hp }; })()`);
    console.log(JSON.stringify(out, null, 1));
  },

  /* 战斗数据回归 */
  async verify(ev, sleep) {
    await init(ev);
    const r = {};
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    // 清空当前房间，摆一个不动的靶子
    r.setup = await ev(`(() => {
      const g = window.SK.game;
      for (const e of g.enemies.slice()) { e.dead = true; }
      g.enemies.length = 0;
      g.room.cleared = true;
      const e = g.spawnEnemy('slime', g.player.x + 70, g.player.y);
      e.speed = 0; e.aiT = 999; e.__dummy = true;
      window.__dummy = e;
      return { hp: e.hp };
    })()`);
    await ev(`(() => { const g = window.SK.game; SK.attack(g.player.weapon, g.player, 0, g); return 1; })()`);
    await sleep(420);
    r.bullet = await ev(`({ hp: window.__dummy.hp, dead: window.__dummy.dead })`);

    // 换近战
    r.melee = await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('sword', 1);
      const e = g.spawnEnemy('slime', g.player.x + 16, g.player.y);
      e.speed = 0; e.aiT = 999;
      window.__dummy2 = e;
      const before = e.hp;
      SK.attack(g.player.slots[0], g.player, 0, g);
      return { before };
    })()`);
    await sleep(320);
    r.meleeAfter = await ev(`({ hp: window.__dummy2.hp, dead: window.__dummy2.dead })`);

    // 拾取武器
    r.pickup = await ev(`(() => {
      const g = window.SK.game;
      const p = g.dropWeapon(g.player.x + 8, g.player.y);
      p.settled = true;
      return { name: p.weapon.name, dist: Math.round(SK.dist(p.x,p.y,g.player.x,g.player.y)) };
    })()`);
    await sleep(120);
    r.hintNow = await ev(`(() => { const g = window.SK.game; return g.hintTarget && g.hintTarget.kind; })()`);
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))`);
    await sleep(160);
    r.afterPickup = await ev(`(() => { const g = window.SK.game; return { slots: g.player.slots.map(w=>w&&w.name), pickups: g.room.pickups.length }; })()`);

    // 护甲恢复
    r.armor = await ev(`(() => { const g = window.SK.game; g.player.armor = 0; g.player.armorDelay = 0.2; return 0; })()`);
    await sleep(2200);
    r.armorAfter = await ev(`Math.round(window.SK.game.player.armor * 10) / 10`);

    // 帧率
    r.fps = await ev(`(() => new Promise(res => {
      let n = 0; const t0 = performance.now(); let done = false;
      function fin() { if (!done) { done = true; res(n); } }
      function tick() { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else fin(); }
      requestAnimationFrame(tick);
      setTimeout(fin, 1500);
    }))()`);

    console.log(JSON.stringify(r, null, 1));
  },

  /* E 拾取调试 */
  async pickup(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`(() => {
      const g = window.SK.game;
      window.__calls = [];
      const orig = g.doInteract;
      g.doInteract = function () {
        window.__calls.push('call hint=' + (g.hintTarget && g.hintTarget.kind) + ' pk=' + (g.hintTarget === window.__pk));
        return orig.call(g);
      };
      const p = g.dropWeapon(g.player.x + 8, g.player.y);
      p.settled = true;
      window.__pk = p;
      return 1;
    })()`);
    await sleep(150);
    console.log('hint before:', await ev(`(() => { const g = window.SK.game; return { hint: g.hintTarget && g.hintTarget.kind, n: g.room.pickups.length, dist: Math.round(SK.dist(window.__pk.x, window.__pk.y, g.player.x, g.player.y)) }; })()`));
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))`);
    await sleep(150);
    console.log('after:', await ev(`({ calls: window.__calls, keysE: !!SK.Input.keys.KeyE, n: window.SK.game.room.pickups.length, slots: window.SK.game.player.slots.map(w=>w&&w.name) })`));
  },

  /* 自动驾驶：只用键鼠，真打一间房 */
  async autoplay(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(2)`);
    await sleep(200);
    await ev(`(() => {
      window.__shots = 0; window.__hits = 0; window.__rooms = [];
      const origA = SK.attack;
      SK.attack = function () { window.__shots++; return origA.apply(this, arguments); };
      const origH = SK.Enemy.prototype.hurt;
      SK.Enemy.prototype.hurt = function (d) { window.__hits++; return origH.apply(this, arguments); };
      return 1;
    })()`);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(300);
    const start = await ev('__T.info()');
    await ev(`__T.fire(true)`);
    for (let i = 0; i < 26; i++) {
      await ev(`(() => {
        const g = window.SK.game;
        const p = g.player;
        if (window.__rooms[window.__rooms.length-1] !== g.room.gx+','+g.room.gy) window.__rooms.push(g.room.gx+','+g.room.gy);
        let best = null, bd = 1e9;
        for (const e of g.enemies) { const d = SK.dist(e.x,e.y,p.x,p.y); if (d<bd) { bd=d; best=e; } }
        if (best) {
          __T.aimAt(best.x, best.y);
          const a = Math.atan2(best.y-p.y, best.x-p.x);
          const fwd = bd > 90;
          __T.key('KeyD', fwd && Math.cos(a) > 0.3);
          __T.key('KeyA', fwd && Math.cos(a) < -0.3);
          __T.key('KeyS', fwd && Math.sin(a) > 0.3);
          __T.key('KeyW', fwd && Math.sin(a) < -0.3);
        }
        return 1;
      })()`);
      await sleep(180);
    }
    await ev(`(() => { ['KeyW','KeyA','KeyS','KeyD'].forEach(k => __T.key(k, false)); __T.fire(false); return 1; })()`);
    await sleep(400);
    const end = await ev('__T.info()');
    console.log('shots/hits:', await ev(`[window.__shots, window.__hits]`));
    console.log('rooms:', JSON.stringify(await ev(`window.__rooms`)));
    console.log('start:', JSON.stringify({ e: start.roomEnemies, hp: start.hp, arm: start.armor }));
    console.log('end  :', JSON.stringify({ e: end.roomEnemies, hp: end.hp, arm: end.armor, cleared: end.cleared, coins: end.coins, w: end.weapon }));
  },

  /* 站在门口看门的渲染 */
  async doors(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(400);
    await ev(`__T.clearRoom()`);
    await sleep(300);
    await ev(`(() => {
      const g = window.SK.game;
      const d = g.floor.doors.find(d => d.a === g.room || d.b === g.room);
      const r = d.rect;
      // 站到门内侧 40px
      const cx = r.x + r.w/2, cy = r.y + r.h/2;
      const a = Math.atan2(g.room.rect.y + 160 - cy, g.room.rect.x + 256 - cx);
      g.player.x = cx + Math.cos(a) * 46;
      g.player.y = cy + Math.sin(a) * 46;
      return { dir: d.dir, locked: d.locked };
    })()`);
    await sleep(500);
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  /* 绕圈打 BOSS：验证能不能打下来 */
  async bossfight(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('smg', 2);
      g.player.maxHp = 40; g.player.hp = 40;   // 加厚，只看能不能打死
      __T.gotoRoom('boss');
      return 1;
    })()`);
    await sleep(700);
    await ev(`__T.fire(true)`);
    const log = [];
    for (let i = 0; i < 40; i++) {
      await ev(`(() => {
        const g = window.SK.game;
        const b = g.boss, p = g.player;
        if (!b) return 1;
        __T.aimAt(b.x, b.y);
        const a = Math.atan2(p.y - b.y, p.x - b.x);
        const d = SK.dist(p.x, p.y, b.x, b.y);
        // 绕着 boss 逆时针转，太近就拉开
        const tang = a + Math.PI / 2;
        const want = d < 100 ? a : tang;
        ['KeyW','KeyA','KeyS','KeyD'].forEach(k => __T.key(k, false));
        if (Math.cos(want) > 0.35) __T.key('KeyD', true);
        if (Math.cos(want) < -0.35) __T.key('KeyA', true);
        if (Math.sin(want) > 0.35) __T.key('KeyS', true);
        if (Math.sin(want) < -0.35) __T.key('KeyW', true);
        return 1;
      })()`);
      await sleep(200);
      if (i % 8 === 7) log.push(await ev(`(() => { const g = window.SK.game; return [Math.round(g.boss ? g.boss.hp : 0), Math.round(g.player.hp)]; })()`));
    }
    await ev(`(() => { ['KeyW','KeyA','KeyS','KeyD'].forEach(k => __T.key(k, false)); __T.fire(false); return 1; })()`);
    console.log('bossHp/playerHp:', JSON.stringify(log));
    console.log('info:', JSON.stringify(await ev('__T.info()')));
  },

  /* 长时间跑图：检验内存/性能是否稳定 */
  async soak(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`(() => {
      window.__frames = 0;
      const g = window.SK.game;
      const orig = g.render.bind(g);
      g.render = function () { window.__frames++; return orig(); };
      __T.fire(true);
      return 1;
    })()`);
    const t0 = Date.now();
    for (let i = 0; i < 60; i++) {
      await ev(`(() => {
        const g = window.SK.game;
        const i = ${i};
        const keys = ['KeyW','KeyA','KeyS','KeyD'];
        keys.forEach(k => __T.key(k, false));
        __T.key(keys[i % 4], true);
        const e = g.enemies[0];
        if (e) __T.aimAt(e.x, e.y);
        if (i % 7 === 0) __T.tap('Space');
        if (i % 11 === 0) __T.tap('KeyQ');
        return 1;
      })()`);
      await sleep(400);
      if (i % 3 === 0) {
        // 每几轮清房并换房间，制造大量生成/销毁
        await ev(`(() => { const g = window.SK.game; if (g.enemies.length) __T.clearRoom(); __T.gotoRoom(g.floor.rooms.filter(r=>r.type==='normal' || r.type==='normal')[0] ? 'normal':'normal'); return 1; })()`);
      }
      if (i % 20 === 19) console.log('  t=' + Math.round((Date.now() - t0) / 1000) + 's');
    }
    await ev(`(() => { ['KeyW','KeyA','KeyS','KeyD'].forEach(k => __T.key(k, false)); __T.fire(false); return 1; })()`);
    console.log('soak:', JSON.stringify(await ev(`(() => {
      const g = window.SK.game;
      return { frames: window.__frames, gameTime: Math.round(g.time), state: g.state,
               hp: Math.round(g.player.hp), floor: g.floorNum, particles: g.particles.length,
               roomGrounds: g.floor.rooms.filter(r => r.ground).length, rooms: g.floor.rooms.length };
    })()`)));
  },

  /* 真实用户手势（会真正启动 AudioContext）+ 长时间高频音效压力测试 */
  async trusted(ev, sleep, T) {
    await init(ev);
    await T.key('keyDown', 'KeyA', 'a', 65);
    await T.key('keyUp', 'KeyA', 'a', 65);
    await sleep(300);
    console.log('audio:', JSON.stringify(await ev(`(() => {
      const S = window.SK.Sound;
      return { on: S.on, has: !!S.ctx, state: S.ctx && S.ctx.state, sr: S.ctx && S.ctx.sampleRate };
    })()`)));

    await ev(`(() => {
      window.__frames = 0; window.__maxDt = 0; window.__last = 0;
      const g = window.SK.game;
      const orig = g.render.bind(g);
      g.render = function () {
        const now = performance.now();
        if (window.__last) window.__maxDt = Math.max(window.__maxDt, now - window.__last);
        window.__last = now;
        window.__frames++;
        return orig();
      };
      g.startRun(0);
      return 1;
    })()`);
    await sleep(250);
    await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('smg', 3);
      g.player.invuln = 99999;
      __T.gotoRoom('normal');
      return 1;
    })()`);
    await sleep(400);
    await ev(`__T.fire(true)`);
    const stats = [];
    for (let i = 0; i < 48; i++) {
      await ev(`(() => {
        const g = window.SK.game;
        while (g.enemies.length < 5) {
          g.spawnEnemy('slime', g.player.x + SK.rand(-100, 100), g.player.y + SK.rand(-70, 70));
        }
        const e = g.enemies[0];
        if (e) __T.aimAt(e.x, e.y);
        return 1;
      })()`);
      await sleep(220);
      if (i % 8 === 7) {
        stats.push(await ev(`(() => {
          const g = window.SK.game;
          return {
            t: Math.round(g.time),
            fps: Math.round(window.__frames / Math.max(1, g.time)),
            maxFrameMs: Math.round(window.__maxDt),
            heapMB: Math.round((performance.memory ? performance.memory.usedJSHeapSize : 0) / 1048576),
            audio: SK.Sound.ctx && SK.Sound.ctx.state,
            enemies: g.enemies.length,
            particles: g.particles.length
          };
        })()`));
        await ev(`window.__maxDt = 0`);
      }
    }
    await ev(`__T.fire(false)`);
    console.log('stats:', JSON.stringify(stats, null, 0));
    console.log('final:', JSON.stringify(await ev('__T.info()')));
  },

  /* 反复重开一局，看画布/堆内存有没有泄漏 */
  async leak(ev, sleep) {
    await init(ev);
    const rows = [];
    for (let i = 0; i < 14; i++) {
      await ev(`(() => { const g = window.SK.game; g.startRun(${i % 4}); return 1; })()`);
      await sleep(160);
      // 进两个房间，确保 renderGround 真的跑了
      await ev(`__T.gotoRoom('normal')`);
      await sleep(150);
      await ev(`(() => { const g = window.SK.game; const r = g.floor.rooms[g.floor.rooms.length-1]; g.player.x = r.rect.x+256; g.player.y = r.rect.y+160; return 1; })()`);
      await sleep(150);
      rows.push(await ev(`(() => {
        const m = performance.memory || {};
        return '#' + ${i} + ' heap=' + Math.round((m.usedJSHeapSize||0)/1048576) + 'MB total=' + Math.round((m.totalJSHeapSize||0)/1048576) + 'MB grounds=' + window.SK.game.floor.rooms.filter(r=>r.ground).length;
      })()`));
    }
    console.log(rows.join('\n'));
  },

  /* 门锁住时贴门站位不该卡死 */
  async doorstuck(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`__T.gotoRoom('normal')`);
    await sleep(300);
    const out = {};
    out.before = await ev(`(() => {
      const g = window.SK.game;
      const d = g.floor.doors.find(d => d.a === g.room || d.b === g.room);
      // 把玩家硬塞到门内侧 19.5px 处（原来的卡死安全带）
      const r = d.rect;
      const insideX = (d.dir === 'w') ? r.x + r.w + 20 : (d.dir === 'e' ? r.x - 20 : r.x + r.w / 2);
      const insideY = (d.dir === 'n') ? r.y + r.h + 20 : (d.dir === 's' ? r.y - 20 : r.y + r.h / 2);
      g.player.x = insideX; g.player.y = insideY;
      return { x: Math.round(g.player.x), y: Math.round(g.player.y), locked: g.room.locked };
    })()`);
    await sleep(260);
    out.afterLock = await ev(`(() => {
      const g = window.SK.game;
      return { locked: g.room.locked, insideWall: g.blockedAt(g.player.x, g.player.y, g.player.r),
               x: Math.round(g.player.x), y: Math.round(g.player.y) };
    })()`);
    // 试着往四个方向走，看能不能动
    await ev(`(() => { const g = window.SK.game; window.__p0 = { x: g.player.x, y: g.player.y }; __T.key('KeyD', true); return 1; })()`);
    await sleep(500);
    await ev(`__T.key('KeyD', false)`);
    out.moved = await ev(`(() => { const g = window.SK.game; return Math.round(Math.hypot(g.player.x - window.__p0.x, g.player.y - window.__p0.y)); })()`);
    out.hp = await ev(`Math.round(window.SK.game.player.hp)`);
    console.log(JSON.stringify(out));
  },

  /* 天赋界面 */
  async talents(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`(() => { const g = window.SK.game; g.openTalents('天赋祭坛'); return 1; })()`);
    await sleep(400);
    console.log('state:', await ev(`window.SK.game.state`));
    console.log('cards:', await ev(`document.querySelectorAll('.tcard').length`));
  },

  /* 天赋选择生效 */
  async talentpick(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    const b = await ev(`(() => { const p = window.SK.game.player; return { maxHp: p.maxHp, rate: p.mods.rate, dmg: p.mods.dmgRanged }; })()`);
    await ev(`(() => {
      const g = window.SK.game;
      g._talentPicks = [SK.TALENTS.find(t=>t.id==='rapid'), SK.TALENTS.find(t=>t.id==='ammo'), SK.TALENTS.find(t=>t.id==='iron')];
      g.openTalents('test', null);
      return 1;
    })()`);
    await sleep(250);
    await ev(`document.querySelectorAll('.tcard')[0].click()`);
    await sleep(300);
    const a = await ev(`(() => { const g = window.SK.game; const p = g.player; return { state: g.state, rate: p.mods.rate, talents: p.talents, slots: document.querySelectorAll('#hpPips i').length }; })()`);
    console.log('before:', JSON.stringify(b));
    console.log('after :', JSON.stringify(a));
  },

  /* BOSS 宝箱 */
  async bosschest(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`__T.gotoRoom('boss')`);
    await sleep(500);
    await ev(`(() => { const g = window.SK.game; g.player.x = g.room.rect.x + 90; g.player.y = g.room.rect.y + 90; g.boss.hurt(99999, 0, g, false); return 1; })()`);
    await sleep(400);
    const has = await ev(`(() => { const g = window.SK.game; const c = g.room.pickups.find(p=>p.kind==='bosschest'); return { found: !!c, key: g.room.bossKey }; })()`);
    console.log('chest:', JSON.stringify(has));
    await ev(`(() => { const g = window.SK.game; const c = g.room.pickups.find(p=>p.kind==='bosschest'); g.player.x = c.x; g.player.y = c.y + 12; return 1; })()`);
    await sleep(600);
    console.log('after:', JSON.stringify(await ev(`(() => { const g = window.SK.game; const w = g.room.pickups.filter(p=>p.kind==='weapon').map(p=>p.weapon && p.weapon.name); return { weapons: w, opened: g.room.pickups.filter(p=>p.kind==='bosschest').map(p=>p.opened) }; })()`)));
  },

  /* 掉落池检查 */
  async weapons(ev, sleep) {
    await init(ev);
    const r = await ev(`(() => {
      const cnt = {}, melee = { n: 0, total: 0 }, tiers = [0,0,0,0,0];
      for (let f = 1; f <= 3; f++) {
        for (let i = 0; i < 400; i++) {
          const w = SK.rollWeapon(f);
          cnt[w.name] = (cnt[w.name] || 0) + 1;
          melee.total++;
          if (w.kind === 'melee') melee.n++;
          tiers[w.tier]++;
        }
      }
      return { kinds: Object.keys(cnt).length, meleePct: Math.round(melee.n / melee.total * 100), tiers, names: cnt };
    })()`);
    console.log('weapons:', JSON.stringify(r));
    const boss = await ev(`(() => {
      const keys = Object.keys(SK.BOSS_WEAPONS).map(k => k + '=' + SK.BOSS_WEAPONS[k]);
      const w = SK.makeWeapon(SK.BOSS_WEAPONS.slimeKing, 4, true);
      return { keys: keys, sample: { name: w.name, dmg: w.dmg, tier: w.tier, kind: w.kind } };
    })()`);
    console.log('boss:', JSON.stringify(boss));
  },

  /* 祭坛 / 宝箱房 / 精英房 */
  async roomtypes(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    const types = await ev(`window.SK.game.floor.rooms.map(r => r.type)`);
    console.log('types:', JSON.stringify(types));
    await ev(`__T.gotoRoom('treasure')`);
    await sleep(500);
    console.log('treasure:', JSON.stringify(await ev(`(() => { const g = window.SK.game; return { chests: g.room.pickups.filter(p=>p.kind==='chest').length }; })()`)));
    const hasShrine = await ev(`!!window.SK.game.floor.rooms.find(r=>r.type==='shrine')`);
    if (hasShrine) {
      await ev(`__T.gotoRoom('shrine')`);
      await sleep(500);
      const info = await ev(`(() => { const g = window.SK.game; const s = g.room.pickups.find(p=>p.kind==='shrine'); return { has: !!s, x: s && Math.round(s.x), y: s && Math.round(s.y) }; })()`);
      console.log('shrine:', JSON.stringify(info));
      await ev(`(() => { const g = window.SK.game; const s = g.room.pickups.find(p=>p.kind==='shrine'); if (s) { g.player.x = s.x; g.player.y = s.y + 10; } return 1; })()`);
      await sleep(300);
      console.log('hint:', await ev(`document.getElementById('hintTag').textContent`));
      console.log('before E:', JSON.stringify(await ev(`({ state: window.SK.game.state, maxHp: window.SK.game.player.maxHp })`)));
      await ev(`window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))`);
      await sleep(350);
      console.log('after shrine touch:', JSON.stringify(await ev(`({ state: window.SK.game.state, cards: document.querySelectorAll('.tcard').length, maxHp: window.SK.game.player.maxHp })`)));
      await ev(`(() => { const c = document.querySelectorAll('.tcard')[0]; if (c) c.click(); return 1; })()`);
      await sleep(250);
    }
    if (await ev(`!!window.SK.game.floor.rooms.find(r=>r.type==='elite')`)) {
      await ev(`(() => { const c = document.querySelectorAll('.tcard')[0]; if (c) c.click(); return 1; })()`);
      await sleep(200);
      await ev(`__T.gotoRoom('elite')`);
      await sleep(500);
      console.log('elite:', JSON.stringify(await ev(`(() => { const g = window.SK.game; return { enemies: g.enemies.length, elite: g.enemies.filter(e=>e.elite).length }; })()`)));
    }
  },

  /* 换武器：旧武器应该掉在地上 */
  async swap(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    const before = await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('smg', 1);
      g.player.slots[1] = SK.makeWeapon('bow', 1);
      g.player.slot = 0;
      const drop = g.dropWeapon(g.player.x + 10, g.player.y + 4, SK.makeWeapon('axe', 2));
      drop.settled = true;
      return { slots: g.player.slots.map(w=>w&&w.name), ground: g.room.pickups.filter(p=>p.kind==='weapon').map(p=>p.weapon.name) };
    })()`);
    await sleep(200);
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))`);
    await sleep(300);
    const after = await ev(`(() => {
      const g = window.SK.game;
      return { slots: g.player.slots.map(w=>w&&w.name), ground: g.room.pickups.filter(p=>p.kind==='weapon').map(p=>p.weapon.name) };
    })()`);
    console.log('before:', JSON.stringify(before));
    console.log('after :', JSON.stringify(after));
    console.log('hint  :', await ev(`document.getElementById('hintTag').textContent`));
  },

  /* 机制型天赋效果 */
  async talentfx(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    const r = await ev(`(() => {
      const g = window.SK.game, p = g.player;
      const out = {};
      const pick = (id) => p.pickTalent(SK.TALENTS.find(t => t.id === id));
      pick('bounce'); pick('split'); pick('critpierce'); pick('corpse');
      pick('lifesteal_placeholder');
      out.talents = p.talents;
      out.bounceMod = p.mods.bounce;
      out.splitMod = p.mods.split;
      // 打一发弹跳弹，确认 bullet 带 bounce
      p.slots[0] = SK.makeWeapon('pistol', 1);
      g.bullets.length = 0;
      SK.attack(p.slots[0], p, 0, g);
      out.bulletBounce = g.bullets[0] && g.bullets[0].bounce;
      out.bulletSplit = g.bullets[0] && g.bullets[0].split;
      // 尸爆：杀一个怪，看会不会连锁
      const e = g.spawnEnemy('slime', p.x + 40, p.y);
      e.hurt(9999, 0, g, false);
      out.corpseOk = true;
      // 破甲冲击 / 修复
      pick('armorbreak'); pick('armorfix');
      p.armor = 1;
      p.invuln = 0;
      p.hurt(30, 0, g);
      out.armorAfter = Math.round(p.armor * 10) / 10;
      out.hpAfter = Math.round(p.hp);
      // 雷暴
      pick('storm');
      out.storm = p.mods.storm;
      return out;
    })()`);
    console.log('fx:', JSON.stringify(r));
  },

  /* 武器对比浮窗 */
  async tooltip(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(220);
    await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('pistol', 1);
      const d = g.dropWeapon(g.player.x + 16, g.player.y + 2, SK.makeWeapon('shotgun', 3));
      d.settled = true;
      return 1;
    })()`);
    await sleep(400);
    console.log('hint:', await ev(`document.getElementById('hintTag').textContent`));
  },

  /* 近战能不能玩：贴脸挥砍，看有没有硬直、会不会秒死 */
  async melee(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(3)`);
    await sleep(200);
    await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('sword', 2);
      g.player.slot = 0;
      __T.gotoRoom('normal');
      window.__stun = 0; window.__dmg = 0;
      const oh = SK.Enemy.prototype.hurt;
      SK.Enemy.prototype.hurt = function () { window.__dmg++; return oh.apply(this, arguments); };
      return 1;
    })()`);
    await sleep(400);
    const start = await ev('__T.info()');
    await ev(`__T.fire(true)`);
    for (let i = 0; i < 30; i++) {
      await ev(`(() => {
        const g = window.SK.game, p = g.player;
        let best = null, bd = 1e9;
        for (const e of g.enemies) { const d = SK.dist(e.x,e.y,p.x,p.y); if (d<bd) { bd=d; best=e; } }
        if (best) {
          __T.aimAt(best.x, best.y);
          if (g.enemies.some(e => e.stunT > 0.01)) window.__stun++;
          const a = Math.atan2(best.y-p.y, best.x-p.x);
          __T.key('KeyD', Math.cos(a) > 0.3);
          __T.key('KeyA', Math.cos(a) < -0.3);
          __T.key('KeyS', Math.sin(a) > 0.3);
          __T.key('KeyW', Math.sin(a) < -0.3);
        }
        return 1;
      })()`);
      await sleep(180);
    }
    await ev(`(() => { ['KeyW','KeyA','KeyS','KeyD'].forEach(k => __T.key(k,false)); __T.fire(false); return 1; })()`);
    await sleep(300);
    const end = await ev('__T.info()');
    console.log('enemies', start.roomEnemies, '->', end.roomEnemies, '| hp', start.hp + '/' + start.armor, '->', end.hp + '/' + end.armor,
      '| hits', await ev('window.__dmg'), '| 观察到硬直的帧', await ev('window.__stun'));
  },

  /* 里程碑天赋：清 5 间房应该弹一次 */
  async milestone(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    const log = [];
    for (let i = 0; i < 7; i++) {
      await ev(`(() => {
        const g = window.SK.game;
        if (g.state === 'talent') { document.querySelectorAll('.tcard')[0].click(); }
        return 1;
      })()`);
      await sleep(140);
      await ev(`(() => {
        const g = window.SK.game;
        const rooms = g.floor.rooms.filter(r => r.type === 'normal' || r.type === 'elite');
        const r = rooms[${i} % rooms.length];
        g.player.x = r.rect.x + 256; g.player.y = r.rect.y + 160;
        return 1;
      })()`);
      await sleep(220);
      await ev(`__T.clearRoom()`);
      await sleep(260);
      log.push(await ev(`({ n: window.SK.game.roomsCleared, state: window.SK.game.state, cards: document.querySelectorAll('.tcard').length })`));
    }
    console.log('milestones:', JSON.stringify(log));
    console.log('talents:', JSON.stringify(await ev(`window.SK.game.player.talents`)));
  },

  /* 金币能花出去吗：换一批天赋 */
  async goldsink(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`(() => { const g = window.SK.game; g.player.coins = 100; g.openTalents('test'); return 1; })()`);
    await sleep(300);
    const b = await ev(`({ coins: window.SK.game.player.coins, btn: document.getElementById('btnReroll').textContent, picks: window.SK.game._talentPicks.map(t=>t.id) })`);
    await ev(`document.getElementById('btnReroll').click()`);
    await sleep(250);
    const a = await ev(`({ coins: window.SK.game.player.coins, btn: document.getElementById('btnReroll').textContent, picks: window.SK.game._talentPicks.map(t=>t.id) })`);
    console.log('before:', JSON.stringify(b));
    console.log('after :', JSON.stringify(a));
  },

  /* BOSS 预警区 */
  async warning(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`__T.gotoRoom('boss')`);
    await sleep(600);
    await ev(`(() => {
      const g = window.SK.game, b = g.boss;
      b.act = null; b.actT = 0;
      b.chooseAct(g, 100);
      g.player.invuln = 9999;
      return b.act.name;
    })()`);
    await sleep(450);
    console.log('warnings:', await ev(`window.SK.game.warnings.length`));
    console.log('act:', await ev(`window.SK.game.boss && window.SK.game.boss.act && window.SK.game.boss.act.name`));
  },

  /* 房间事件 */
  async events(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    const has = await ev(`!!window.SK.game.floor.rooms.find(r=>r.type==='event')`);
    console.log('has event room:', has);
    if (!has) return;
    await ev(`__T.gotoRoom('event')`);
    await sleep(500);
    const info = await ev(`(() => { const g = window.SK.game; const e = g.room.pickups.find(p=>p.kind==='event'); return { ev: e && e.evType, coins: g.player.coins, weapon: g.player.weapon && g.player.weapon.name, tier: g.player.weapon && g.player.weapon.tier }; })()`);
    console.log('event:', JSON.stringify(info));
    await ev(`(() => {
      const g = window.SK.game;
      g.player.coins = 200;
      const e = g.room.pickups.find(p=>p.kind==='event');
      g.player.x = e.x; g.player.y = e.y + 12;
      return 1;
    })()`);
    await sleep(300);
    console.log('hint:', await ev(`document.getElementById('hintTag').textContent`));
    await ev(`window.dispatchEvent(new KeyboardEvent('keydown', {code:'KeyE', bubbles:true}))`);
    await sleep(400);
    console.log('after:', JSON.stringify(await ev(`(() => { const g = window.SK.game; return { coins: g.player.coins, weapon: g.player.weapon && g.player.weapon.name, tier: g.player.weapon && g.player.weapon.tier, talents: g.player.talents.length, events: g.room.pickups.filter(p=>p.kind==='event').length }; })()`)));
  },

  /* 蓄力武器 + 近战连击 */
  async charge(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(2)`);
    await sleep(200);
    await ev(`(() => {
      const g = window.SK.game;
      g.player.slots[0] = SK.makeWeapon('bow', 2);
      g.player.slot = 0;
      __T.gotoRoom('normal');
      return 1;
    })()`);
    await sleep(400);
    // 按住不放，等满蓄自动放
    await ev(`__T.fire(true)`);
    await sleep(120);
    const mid = await ev(`(() => { const p = window.SK.game.player; return { charge: Math.round(p.charge*100)/100, max: p.weapon.charge.time }; })()`);
    await sleep(700);
    const after = await ev(`(() => { const g = window.SK.game; return { charge: Math.round(g.player.charge*100)/100, bullets: g.bullets.length, dmg: g.bullets[0] ? Math.round(g.bullets[0].dmg) : 0 }; })()`);
    await ev(`__T.fire(false)`);
    console.log('charging:', JSON.stringify(mid), '->', JSON.stringify(after));

    // 近战三连
    const combo = await ev(`(() => {
      const g = window.SK.game, p = g.player;
      p.slots[0] = SK.makeWeapon('sword', 1);
      const out = [];
      for (let i = 0; i < 3; i++) {
        SK.attack(p.slots[0], p, 0, g);
        const s = p.swings[p.swings.length-1];
        out.push({ combo: s.combo, dmg: Math.round(s.dmg), arc: Math.round(s.arc*100)/100, stun: s.stun });
        p.swings.length = 0;
      }
      return out;
    })()`);
    console.log('combo:', JSON.stringify(combo));
  },

  /* 死亡 / 重开 */
  async death(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(200);
    await ev(`(() => { const g = window.SK.game; g.player.hurt(999, 0, g); return 1; })()`);
    await sleep(1600);
    console.log('over:', await ev(`document.getElementById('scrOver').classList.contains('show')`));
    console.log('stats:', await ev(`document.getElementById('overStats').textContent`));
    await ev(`document.getElementById('btnAgain').click()`);
    await sleep(300);
    console.log('afterAgain:', await ev(`window.SK.game.state`));
  },

  /* 战斗压力测试：模拟 30 秒乱打，看有没有异常 */
  async stress(ev, sleep) {
    await init(ev);
    await ev(`window.SK.game.startRun(0)`);
    await sleep(150);
    const res = [];
    for (let r = 0; r < 6; r++) {
      await ev(`__T.gotoRoom('normal')`);
      await sleep(160);
      await ev(`(() => { __T.fire(true); return 1; })()`);
      // 随机移动
      for (let i = 0; i < 8; i++) {
        await ev(`(() => {
          const g = window.SK.game;
          const e = g.enemies[0];
          if (e) __T.aimAt(e.x + Math.random()*20-10, e.y + Math.random()*20-10);
          const keys = ['KeyW','KeyA','KeyS','KeyD'];
          keys.forEach(k => __T.key(k, false));
          __T.key(keys[(Math.random()*4)|0], true);
          if (Math.random() < 0.4) __T.tap('Space');
          return 1;
        })()`);
        await sleep(180);
      }
      res.push(await ev('__T.info()'));
      await ev(`__T.clearRoom()`);
      await sleep(120);
    }
    await ev(`(() => { ['KeyW','KeyA','KeyS','KeyD'].forEach(k => __T.key(k, false)); __T.fire(false); return 1; })()`);
    console.log(JSON.stringify(res.map(r => ({ hp: r.hp, arm: r.armor, en: r.energy, b: r.bullets, p: r.particles }))));
  }
};
