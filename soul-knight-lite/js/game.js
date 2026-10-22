/* ============================================================
   game.js —— 主循环 / 相机 / 房间逻辑 / 渲染 / UI
   ============================================================ */
(function () {
  'use strict';
  const SK = window.SK;
  const TILE = SK.TILE, VIEW_W = SK.VIEW_W, VIEW_H = SK.VIEW_H;
  const T = SK.T, RW = SK.ROOM_W, RH = SK.ROOM_H;

  const BOSS_KEYS = ['slimeKing', 'golem', 'mage'];
  const EVENT_HINT = {
    smith: '[E] 铁匠：30 金币，当前武器升一档',
    statue: '[E] 雕像：35 金币，随机获得一个天赋',
    gambler: '[E] 赌徒：20 金币，五五开赌一把武器',
    well: '[E] 许愿井：10 金币，回血或回能量'
  };
  const EVENT_COST = { smith: 30, statue: 35, gambler: 20, well: 10 };
  const BOSS_HINT = [
    '史莱姆王：跳起来砸地会放一圈子弹',
    '熔岩守卫：冲锋前有红色预警，躲开',
    '霜语巫妖：会瞬移，注意魔法阵'
  ];

  class Game {
    constructor() {
      this.canvas = document.getElementById('cv');
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;

      this.state = 'title';
      this.time = 0;
      this.last = 0;
      this.hitStop = 0;
      this.shakeT = 0;
      this.shakeAmt = 0;
      this.deadT = 0;

      this.bullets = [];
      this.particles = [];
      this.floats = [];
      this.lasers = [];
      this.warnings = [];
      this.enemies = [];
      this.boss = null;

      this.floor = null;
      this.room = null;
      this.player = null;
      this.cam = { x: 0, y: 0 };

      this.floorNum = 1;
      this.charIndex = 0;
      this.killCount = 0;
      this.startedAt = 0;
      this.hintTarget = null;

      this.el = {};
      this.cache = {};
      this._toastTimer = null;
      this._trans = null;

      this.bindUI();
      this.resize();
      this.makePreview();
      this.loop = this.loop.bind(this);
      requestAnimationFrame(this.loop);
    }

    /* ==================== 初始化 / UI ==================== */
    bindUI() {
      const $ = (id) => document.getElementById(id);
      this.el = {
        stage: $('stage'), hud: $('hud'), ui: $('ui'),
        hpPips: $('hpPips'), armorPips: $('armorPips'),
        energyFill: $('energyFill'), energyTxt: $('energyTxt'),
        floorTag: $('floorTag'), coinTag: $('coinTag'),
        slotEls: Array.from(document.querySelectorAll('#slots .slot')),
        dashFill: $('dashFill'), hintTag: $('hintTag'),
        bossBar: $('bossBar'), bossName: $('bossName'), bossFill: $('bossFill'),
        toast: $('toast'), fade: $('fade'), wtip: $('wtip'),
        scrTitle: $('scrTitle'), scrChar: $('scrChar'), scrPause: $('scrPause'),
        scrOver: $('scrOver'), scrWin: $('scrWin'),
        scrTalent: $('scrTalent'), talentTitle: $('talentTitle'), talentList: $('talentList'),
        btnReroll: $('btnReroll'),
        charList: $('charList'), overStats: $('overStats'), winStats: $('winStats'),
        recTag: $('recTag')
      };

      SK.Input.init(this.canvas);
      SK.Input.toLogical = (cx, cy) => {
        const r = this.canvas.getBoundingClientRect();
        return {
          x: ((cx - r.left) / r.width) * VIEW_W,
          y: ((cy - r.top) / r.height) * VIEW_H
        };
      };

      window.addEventListener('resize', () => this.resize());

      // 切到后台自动暂停，避免回来时一堆奇怪状态 / 白烧 CPU
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.state === 'play') this.showScreen('scrPause');
          for (const k in SK.Input.keys) SK.Input.keys[k] = false;
          SK.Input.mouse.down = false;
        } else {
          this.last = 0;
        }
      });

      $('btnStart').addEventListener('click', () => { SK.Sound.unlock(); this.showScreen('scrChar'); });
      $('btnReroll').addEventListener('click', () => this.rerollTalents());
      $('btnResume').addEventListener('click', () => this.resume());
      $('btnQuit').addEventListener('click', () => this.toTitle());
      $('btnAgain').addEventListener('click', () => { this.showScreen('scrChar'); this.buildChars(); });
      $('btnAgain2').addEventListener('click', () => { this.showScreen('scrChar'); this.buildChars(); });

      const rec = SK.Save.best();
      this.el.recTag.textContent = rec ? (rec >= 99 ? '最佳记录：已通关 ★' : '最佳记录：第 ' + rec + ' 层') : '';

      this.buildChars();
    }

    buildChars() {
      const list = this.el.charList;
      list.innerHTML = '';
      SK.CHARS.forEach((c, i) => {
        const card = document.createElement('div');
        card.className = 'card' + (i === this.charIndex ? ' on' : '');
        const cv = SK.Art.charThumb(c);
        card.appendChild(cv);
        const nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = c.name;
        const ds = document.createElement('div'); ds.className = 'ds'; ds.textContent = c.desc;
        const st = document.createElement('div'); st.className = 'st';
        st.innerHTML =
          '<div><span>生命</span><i>' + c.hp + '</i></div>' +
          '<div><span>护甲</span><i>' + c.armor + '</i></div>' +
          '<div><span>能量</span><i>' + c.energy + '</i></div>' +
          '<div><span>敏捷</span><i>' + c.speed + '</i></div>';
        const wp = document.createElement('div'); wp.className = 'wp';
        wp.textContent = c.perkName + ' · ' + SK.WEAPONS[c.weapon].name;
        card.appendChild(nm); card.appendChild(ds); card.appendChild(st); card.appendChild(wp);
        card.addEventListener('click', () => {
          this.charIndex = i;
          Array.from(list.children).forEach((n, j) => n.classList.toggle('on', j === i));
          SK.Sound.tone(520 + i * 80, 0.05, 'square', 0.05);
        });
        card.addEventListener('dblclick', () => this.startRun(i));
        list.appendChild(card);
      });
      // 出发按钮
      let go = document.getElementById('btnGo');
      if (!go) {
        go = document.createElement('div');
        go.id = 'btnGo'; go.className = 'cta sm'; go.textContent = '出 发';
        go.addEventListener('click', () => this.startRun(this.charIndex));
        list.parentNode.appendChild(go);
      }
    }

    showScreen(id) {
      ['scrTitle', 'scrChar', 'scrPause', 'scrOver', 'scrWin', 'scrTalent'].forEach((k) => {
        if (this.el[k]) this.el[k].classList.toggle('show', k === id);
      });
      const inGame = !id;
      this.el.hud.classList.toggle('hidden', !inGame);
      // 关掉残留的 toast
      this.el.toast.classList.remove('show');
      if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null; }
      if (id === 'scrChar') this.state = 'title_sel';
      else if (id === 'scrTitle') this.state = 'title';
      else if (id === 'scrPause') this.state = 'pause';
      else if (id === 'scrOver') this.state = 'over';
      else if (id === 'scrWin') this.state = 'win';
      else if (id === 'scrTalent') this.state = 'talent';
      SK.Input.clearEdge();
    }

    resize() {
      const W = window.innerWidth, H = window.innerHeight;
      let k = Math.min(W / VIEW_W, H / VIEW_H);
      if (k >= 2) k = Math.floor(k);
      k = Math.max(0.6, k);
      this.el.stage.style.transform = 'scale(' + k + ')';
      this.scale = k;
    }

    /* ==================== 预览背景 ==================== */
    makePreview() {
      this.floorNum = 1;
      this.floor = SK.genFloor(1);
      this.room = this.floor.start;
      this.room.visited = true;
      this.room.entered = true;
      this.room.spawned = true;
      this.enemies = this.room.enemies;
      this.player = this.enterPlayer(this.floor.start, null);
      this.player.aimAng = -0.3;
      this.snapCamera();
    }

    /* ==================== 开局 ==================== */
    startRun(charIndex) {
      SK.Sound.unlock();
      this.charIndex = charIndex;
      this.player = null;
      this.floorNum = 1;
      this.killCount = 0;
      this.time = 0;
      this.startedAt = Date.now();
      this.totalFloorReached = 1;
      this.roomsCleared = 0;
      this.pendingTalent = null;
      this.bullets.length = 0;
      this.particles.length = 0;
      this.floats.length = 0;
      this.lasers.length = 0;
      this.buildFloor(1);
      this.showScreen(null);
      this.buildHud();
      this.state = 'play';
      this.hintTarget = null;
      SK.Sound.level();
      this.toast(SK.Art.biome(1).name + ' · 第 1 层');
    }

    buildFloor(num) {
      this.floorNum = num;
      this.floor = SK.genFloor(num);
      this.room = null;
      this.boss = null;
      this.bullets.length = 0;
      this.lasers.length = 0;
      this.warnings.length = 0;
      this.player = this.enterPlayer(this.floor.start, this.player);
      this.enterRoom(this.floor.start, true);
      this.snapCamera();
    }

    /* 把玩家放到房间中央（保留状态） */
    enterPlayer(room, old) {
      const cx = room.rect.x + SK.ROOM_PW / 2;
      const cy = room.rect.y + SK.ROOM_PH / 2 + 34;
      if (old) {
        old.x = cx; old.y = cy;
        old.vx = old.vy = 0;
        old.invuln = 0.6;
        return old;
      }
      const char = SK.CHARS[this.charIndex] || SK.CHARS[0];
      const p = new SK.Player(char, cx, cy);
      return p;
    }

    portalEnter() {
      if (this.floorNum >= 3) { this.win(); return; }
      if (this._talentCb) return;
      this.openTalents('下层之前 · 选个天赋', () => this.nextFloor());
    }

    nextFloor() {
      if (this.floorNum >= 3) { this.win(); return; }
      const n = this.floorNum + 1;
      this.transition(() => {
        this.buildFloor(n);
        this.totalFloorReached = Math.max(this.totalFloorReached || 1, n);
        this.toast(SK.Art.biome(n).name + ' · 第 ' + n + ' 层');
        SK.Sound.level();
      });
    }

    transition(fn) {
      if (this._trans) return;
      this._trans = true;
      this.el.fade.classList.add('on');
      setTimeout(() => {
        fn();
        setTimeout(() => {
          this.el.fade.classList.remove('on');
          this._trans = false;
        }, 90);
      }, 170);
    }

    /* ==================== 房间 ==================== */
    roomAt(x, y) {
      const gx = Math.floor(x / SK.ROOM_PW), gy = Math.floor(y / SK.ROOM_PH);
      return this.floor.rooms.find((r) => r.gx === gx && r.gy === gy) || null;
    }

    enterRoom(room, instant) {
      if (!room || this.room === room) return;
      this.room = room;
      room.visited = true;
      room.entered = true;
      this.enemies = room.enemies;
      this.bullets.length = 0;
      this.lasers.length = 0;
      this.boss = null;
      if (!room.spawned) this.spawnRoom(room);
      // 找房间里的 boss
      for (const e of room.enemies) if (e.isBoss) this.boss = e;
      if (room.cleared) room.locked = false;
      if (instant) this.snapCamera();
    }

    spawnRoom(room) {
      room.spawned = true;
      const num = this.floorNum;
      for (const plan of room.plan) {
        if (plan.type === 'boss') {
          const key = BOSS_KEYS[Math.min(2, num - 1)];
          const b = new SK.Boss(key, plan.x, plan.y, num);
          room.enemies.push(b);
          room.bossKey = key;
          this.boss = b;
          SK.Sound.boss();
          this.toast(BOSS_HINT[Math.min(2, num - 1)]);
        } else {
          const s = this.freeSpot(plan.x, plan.y, 8);
          room.enemies.push(new SK.Enemy(plan.type, s.x, s.y, num));
        }
      }
      // 箱子
      if (room.planChest) {
        room.pickups.push(new SK.Pickup('chest', room.rect.x + SK.ROOM_PW / 2, room.rect.y + SK.ROOM_PH / 2 - 10, {}));
      }
      if (room.planChest2) {
        room.pickups.push(new SK.Pickup('chest', room.rect.x + SK.ROOM_PW / 2 + 52, room.rect.y + SK.ROOM_PH / 2 + 26, {}));
        room.pickups.push(new SK.Pickup('chest', room.rect.x + SK.ROOM_PW / 2 - 52, room.rect.y + SK.ROOM_PH / 2 + 26, {}));
      }
      // 天赋祭坛
      if (room.planShrine) {
        const pk = new SK.Pickup('shrine', room.rect.x + SK.ROOM_PW / 2, room.rect.y + SK.ROOM_PH / 2 - 6, {});
        pk.settled = true;
        room.pickups.push(pk);
      }
      // 随机事件 NPC / 设施
      if (room.planEvent) {
        const pk = new SK.Pickup('event', room.rect.x + SK.ROOM_PW / 2, room.rect.y + SK.ROOM_PH / 2 - 6, { evType: room.planEvent });
        pk.settled = true;
        room.pickups.push(pk);
      }
      // 商店
      if (room.planShop) {
        const baseX = room.rect.x + SK.ROOM_PW / 2;
        const baseY = room.rect.y + SK.ROOM_PH / 2 - 26;
        const previewW = SK.rollWeapon(Math.min(3, num + 1));
        const items = [
          { kind: 'hp', price: 10, label: '大血包' },
          { kind: 'energy', price: 8, label: '能量水晶' },
          { kind: 'weapon', price: 24, label: '随机武器', def: previewW },
          { kind: 'talent', price: 40, label: '天赋券' }
        ];
        items.forEach((it, i) => {
          const pk = new SK.Pickup('shelf', baseX + (i - 1.5) * 48, baseY, { price: it.price, item: it, def: it.def || null });
          pk.settled = true;
          room.pickups.push(pk);
        });
      }
      if (room.enemies.length === 0) this.clearRoom(room, true);
    }

    clearRoom(room, silent) {
      if (room.cleared) return;
      room.cleared = true;
      room.locked = false;
      this.floor.clearedRooms = (this.floor.clearedRooms || 0) + 1;
      if (!silent) {
        SK.Sound.door();
        this.shake(2);
        const p = this.player;
        if (p) {
          // 金币
          const coins = 3 + Math.round(this.floorNum) + SK.randi(0, 3);
          for (let i = 0; i < coins; i++) {
            this.dropPickup('coin', p.x + SK.rand(-32, 32), p.y + SK.rand(-32, 32), { value: 1 });
          }
          // 保底奖励宝箱（血瓶 / 能量 / 武器）
          if (!room.planChest && !room.planChest2) {
            const cx = room.rect.x + SK.ROOM_PW / 2;
            const cy = room.rect.y + SK.ROOM_PH / 2;
            room.pickups.push(new SK.Pickup('chest', cx, cy, {}));
          }
          // 清房计数 → 每 4 间免费送一次天赋
          this.roomsCleared = (this.roomsCleared || 0) + 1;
          if (this.roomsCleared % 4 === 0 && !this._talentCb && !this.pendingTalent) {
            this.pendingTalent = '清空 4 间房 · 选择天赋';
          }
        }
      }
    }

    updateRoom(dt) {
      const p = this.player;
      if (!p) return;
      const r = this.roomAt(p.x, p.y);
      if (r && r !== this.room) this.enterRoom(r);
      const room = this.room;
      if (!room) return;

      const inside = p.x > room.rect.x + TILE * 2.4 && p.x < room.rect.x + SK.ROOM_PW - TILE * 2.4 &&
        p.y > room.rect.y + TILE * 2.4 && p.y < room.rect.y + SK.ROOM_PH - TILE * 2.4;
      const wasLocked = room.locked;
      room.locked = inside && !room.cleared && room.enemies.length > 0;
      if (room.locked !== wasLocked && !room.locked && !room.cleared) SK.Sound.tone(180, 0.1, 'square', 0.05);

      // 兜底：万一因为关门之类的原因卡进墙里，拽出来
      this.unstick(p);

      if (!room.cleared && room.spawned && room.enemies.length === 0) this.clearRoom(room);
      // 门锁状态
      for (const d of this.floor.doors) d.locked = d.a.locked || d.b.locked;
    }

    /* ==================== 碰撞 ==================== */
    solidTile(tx, ty) {
      const f = this.floor;
      if (!f) return true;
      if (tx < 0 || ty < 0 || tx >= f.tw || ty >= f.th) return true;
      const idx = ty * f.tw + tx;
      const v = f.grid[idx];
      if (v === T.DOOR) {
        const di = f.doorMap[idx];
        if (di < 0) return false;
        return !!f.doors[di].locked;
      }
      return v !== T.FLOOR;
    }

    solidPx(x, y) {
      return this.solidTile(Math.floor(x / TILE), Math.floor(y / TILE));
    }

    blockedAt(x, y, r) {
      const k = r * 0.72;
      return this.solidPx(x - r, y) || this.solidPx(x + r, y) ||
        this.solidPx(x, y - r) || this.solidPx(x, y + r) ||
        this.solidPx(x - k, y - k) || this.solidPx(x + k, y - k) ||
        this.solidPx(x - k, y + k) || this.solidPx(x + k, y + k);
    }

    moveEnt(ent, dt) {
      let vx = (ent.vx + (ent.kx || 0)) * dt;
      let vy = (ent.vy + (ent.ky || 0)) * dt;
      if (!isFinite(vx) || Math.abs(vx) > 240) vx = SK.clamp(isFinite(vx) ? vx : 0, -240, 240);
      if (!isFinite(vy) || Math.abs(vy) > 240) vy = SK.clamp(isFinite(vy) ? vy : 0, -240, 240);
      if (vx) {
        let remain = Math.abs(vx), sgn = vx < 0 ? -1 : 1;
        while (remain > 0.0001) {
          const step = Math.min(1.5, remain);
          if (!this.blockedAt(ent.x + sgn * step, ent.y, ent.r)) ent.x += sgn * step;
          else {
            if (ent.isPlayer && Math.abs(vx) > 200) { this.shake(3); this.spark(ent.x + sgn * ent.r, ent.y, '#8fe0ff', 5); }
            ent.vx = 0; ent.kx = 0;
            break;
          }
          remain -= step;
        }
      }
      if (vy) {
        let remain = Math.abs(vy), sgn = vy < 0 ? -1 : 1;
        while (remain > 0.0001) {
          const step = Math.min(1.5, remain);
          if (!this.blockedAt(ent.x, ent.y + sgn * step, ent.r)) ent.y += sgn * step;
          else { ent.vy = 0; ent.ky = 0; break; }
          remain -= step;
        }
      }
    }

    /* ==================== 预警区（BOSS 走位解谜的核心） ==================== */
    warnZone(opt) {
      this.warnings.push({
        x: opt.x, y: opt.y,
        r: opt.r || 40,
        t: opt.t || 0.8, maxT: opt.t || 0.8,
        dmg: opt.dmg || 0,
        kind: opt.kind || 'circle',
        ang: opt.ang || 0,
        len: opt.len || 120,
        w: opt.w || 20,
        fired: false
      });
      SK.Sound.warn();
    }

    updateWarnings(dt) {
      for (let i = this.warnings.length - 1; i >= 0; i--) {
        const wn = this.warnings[i];
        wn.t -= dt;
        if (wn.t <= 0 && !wn.fired) {
          wn.fired = true;
          wn.t = 0.24;
          this.onWarnHit(wn);
        }
        if (wn.fired && wn.t <= 0) this.warnings.splice(i, 1);
      }
    }

    onWarnHit(wn) {
      const p = this.player;
      this.shake(5);
      this.burst(wn.x + (wn.kind === 'line' ? Math.cos(wn.ang) * wn.len * 0.5 : 0),
        wn.y + (wn.kind === 'line' ? Math.sin(wn.ang) * wn.len * 0.5 : 0),
        (wn.kind === 'line' ? 26 : wn.r) * 0.8);
      SK.Sound.explode();
      if (!p || p.dead) return;
      let hit = false;
      if (wn.kind === 'line') {
        const dx = Math.cos(wn.ang), dy = Math.sin(wn.ang);
        const px = p.x - wn.x, py = p.y - wn.y;
        const proj = px * dx + py * dy;
        const perp = Math.abs(px * dy - py * dx);
        if (proj > -wn.w && proj < wn.len && perp < wn.w + p.r) hit = true;
      } else if (SK.dist(wn.x, wn.y, p.x, p.y) < wn.r + p.r) {
        hit = true;
      }
      if (hit) p.hurt(wn.dmg, SK.angleTo(wn.x, wn.y, p.x, p.y), this);
    }

    drawWarnings(g) {
      for (const wn of this.warnings) {
        const k = SK.clamp(1 - wn.t / wn.maxT, 0, 1);
        if (wn.fired) {
          g.globalAlpha = Math.max(0, wn.t / 0.24) * 0.75;
          g.fillStyle = '#ffd35c';
          if (wn.kind === 'line') {
            g.save(); g.translate(wn.x, wn.y); g.rotate(wn.ang);
            g.fillRect(0, -wn.w, wn.len, wn.w * 2);
            g.restore();
          } else {
            g.beginPath(); g.arc(wn.x, wn.y, wn.r, 0, SK.TAU); g.fill();
          }
          g.globalAlpha = 1;
          continue;
        }
        g.save();
        if (wn.kind === 'line') {
          g.translate(wn.x, wn.y);
          g.rotate(wn.ang);
          g.fillStyle = 'rgba(255,60,60,' + (0.10 + k * 0.16) + ')';
          g.fillRect(0, -wn.w, wn.len, wn.w * 2);
          g.fillStyle = 'rgba(255,80,80,' + (0.22 + k * 0.3) + ')';
          g.fillRect(0, -wn.w * k, wn.len, wn.w * 2 * k);
          g.strokeStyle = 'rgba(255,110,110,.85)';
          g.lineWidth = 1;
          g.strokeRect(0.5, -wn.w, wn.len, wn.w * 2);
        } else {
          g.fillStyle = 'rgba(255,60,60,' + (0.10 + k * 0.15) + ')';
          g.beginPath(); g.arc(wn.x, wn.y, wn.r, 0, SK.TAU); g.fill();
          g.fillStyle = 'rgba(255,80,80,' + (0.2 + k * 0.3) + ')';
          g.beginPath(); g.arc(wn.x, wn.y, wn.r * k, 0, SK.TAU); g.fill();
          g.strokeStyle = 'rgba(255,110,110,.9)';
          g.lineWidth = 1;
          g.beginPath(); g.arc(wn.x, wn.y, wn.r, 0, SK.TAU); g.stroke();
        }
        g.restore();
      }
    }

    /* ==================== 战斗辅助 ==================== */
    // 卡进实心图块里时，把实体推到最近的空位（门锁上的一瞬间可能发生）
    unstick(ent) {
      if (!ent || ent.dead) return false;
      if (!this.blockedAt(ent.x, ent.y, ent.r)) return false;
      for (let rad = 2; rad <= 56; rad += 2) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * SK.TAU;
          const nx = ent.x + Math.cos(a) * rad;
          const ny = ent.y + Math.sin(a) * rad;
          if (!this.blockedAt(nx, ny, ent.r)) {
            ent.x = nx; ent.y = ny; ent.vx = 0; ent.vy = 0; ent.kx = 0; ent.ky = 0;
            if (ent.isPlayer) { this.spark(nx, ny, '#8fe0ff', 6); this.shake(2); }
            return true;
          }
        }
      }
      return false;
    }

    // 找一个不被墙卡住的落点
    freeSpot(x, y, r) {
      if (!this.blockedAt(x, y, r)) return { x: x, y: y };
      for (let ring = 1; ring <= 9; ring++) {
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * SK.TAU + ring * 0.4;
          const nx = x + Math.cos(a) * ring * 8;
          const ny = y + Math.sin(a) * ring * 8;
          if (!this.blockedAt(nx, ny, r)) return { x: nx, y: ny };
        }
      }
      return { x: x, y: y };
    }

    spawnEnemy(kind, x, y) {
      const s = this.freeSpot(x, y, 8);
      const e = new SK.Enemy(kind, s.x, s.y, this.floorNum);
      this.enemies.push(e);
      this.spark(s.x, s.y, e.color, 7, 0.6);
      return e;
    }

    mouseWorld() {
      return { x: this.cam.x + SK.Input.mouse.x, y: this.cam.y + SK.Input.mouse.y };
    }

    rollCrit() {
      const p = this.player;
      const base = p && p.perk.crit ? p.perk.crit : 0.06;
      const bonus = p && p.critBonus ? p.critBonus() : 0;
      return Math.random() < base + bonus;
    }

    /* 天赋：旋风斩 */
    whirl(ent, dmg) {
      const R = 46;
      this.shake(4);
      SK.Sound.swing();
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (SK.dist(ent.x, ent.y, e.x, e.y) < R + e.r) {
          e.hurt(dmg, SK.angleTo(ent.x, ent.y, e.x, e.y), this, false);
          if (e.applyKnock) e.applyKnock(SK.angleTo(ent.x, ent.y, e.x, e.y), 160);
        }
      }
      for (let k = this.bullets.length - 1; k >= 0; k--) {
        const b = this.bullets[k];
        if (!b.friendly && SK.dist(ent.x, ent.y, b.x, b.y) < R) this.bullets.splice(k, 1);
      }
      this.particles.push({
        x: ent.x, y: ent.y, vx: 0, vy: 0, life: 0.3, maxLife: 0.3,
        color: '#dff4ff', size: 40, grav: 0, ring: true
      });
    }

    /* 天赋：雷暴 */
    lightning(x, y, dmg) {
      this.spark(x, y, '#cfe8ff', 10, 0.8);
      this.lasers.push({ x: x, y: y - 70, tx: x, ty: y, life: 0.16, maxLife: 0.16, color: '#bfe4ff', r: 3 });
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        if (SK.dist(x, y, e.x, e.y) < 26 + e.r) {
          e.hurt(dmg, SK.angleTo(x, y, e.x, e.y), this, false);
        }
      }
      this.shake(2);
      SK.Sound.tone(1200, 0.09, 'sawtooth', 0.05, 300);
    }

    addBullet(b) {
      if (!b.hitSet) b.hitSet = null;
      this.bullets.push(b);
      if (this.bullets.length > 260) this.bullets.shift();
    }

    enemyShot(x, y, ang, spd, dmg, o) {
      o = o || {};
      const slow = this.player && this.player.mods ? this.player.mods.enemySlow : 1;
      this.addBullet({
        x: x, y: y,
        vx: Math.cos(ang) * spd * slow, vy: Math.sin(ang) * spd * slow,
        r: o.r || 2.6, dmg: dmg, friendly: false,
        pierce: 0, life: o.life || 2.6,
        color: o.color || '#ff7a5a',
        kind: o.kind || 'basic',
        glow: o.glow !== false,
        knock: 0, slow: 0, explode: 0, explodeDmg: 0, hitSet: null, trail: 0
      });
    }

    beam(ent, ang, w, ox, oy, charge) {
      SK.castBeam(this, ent, ang, w, ox, oy, charge || 0);
    }

    shake(n) {
      this.shakeAmt = Math.max(this.shakeAmt, n);
      this.shakeT = Math.max(this.shakeT, 0.18);
    }

    spark(x, y, color, n, size) {
      const count = this.lowFx ? Math.min(3, Math.ceil((n || 4) / 2)) : (n || 4);
      for (let i = 0; i < count; i++) {
        const a = SK.rand(0, SK.TAU), s = SK.rand(30, 130);
        this.particles.push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
          life: SK.rand(0.18, 0.42), maxLife: 0.42,
          color: color, size: size ? SK.rand(1, 2.4) : SK.rand(1, 2),
          grav: 210
        });
      }
      if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
    }

    burst(x, y, radius, color) {
      const n = this.lowFx ? 7 : 16;
      for (let i = 0; i < n; i++) {
        const a = SK.rand(0, SK.TAU), s = SK.rand(40, radius * 4);
        this.particles.push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: SK.rand(0.25, 0.6), maxLife: 0.6,
          color: color || (SK.chance(0.5) ? '#ffd35c' : '#ff7a3a'),
          size: SK.rand(1.5, 3.5), grav: 130
        });
      }
      if (this.particles.length > 300) this.particles.splice(0, this.particles.length - 300);
    }

    floatText(x, y, text, color) {
      this.floats.push({ x: x, y: y, text: text, color: color || '#ffffff', life: 0.7, maxLife: 0.7, vy: -34 });
    }

    spawnDeathBurst(e) {
      const cols = [e.color || '#ffffff', '#ffffff', e.color2 || '#ffd35c'];
      for (let i = 0; i < 14; i++) {
        const a = SK.rand(0, SK.TAU), s = SK.rand(30, 150);
        this.particles.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 30,
          life: SK.rand(0.3, 0.7), maxLife: 0.7,
          color: cols[i % 3], size: SK.rand(1.5, 3), grav: 260
        });
      }
      this.shake(2.5);
    }

    explode(x, y, radius, dmg, friendly) {
      // 尸爆连锁时防止无限递归
      if (this._expDepth > 2) return;
      this._expDepth = (this._expDepth || 0) + 1;
      SK.Sound.explode();
      this.shake(6);
      this.burst(x, y, radius);
      this.particles.push({
        x: x, y: y, vx: 0, vy: 0, life: 0.28, maxLife: 0.28,
        color: '#ffd35c', size: radius * 0.5, grav: 0, ring: true
      });
      if (friendly) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          const e = this.enemies[i];
          const d = SK.dist(x, y, e.x, e.y);
          if (d < radius + e.r) {
            const f = 1 - Math.min(1, d / (radius + e.r)) * 0.55;
            e.hurt(dmg * f, SK.angleTo(x, y, e.x, e.y), this, false);
          }
        }
      } else {
        const p = this.player;
        if (p && !p.dead) {
          const d = SK.dist(x, y, p.x, p.y);
          if (d < radius + p.r) p.hurt(dmg * 0.8, SK.angleTo(x, y, p.x, p.y), this);
        }
      }
      this._expDepth--;
    }

    dropPickup(kind, x, y, opt) {
      const room = this.room;
      if (!room) return null;
      const p = new SK.Pickup(kind, x, y, opt || {});
      room.pickups.push(p);
      return p;
    }

    dropWeapon(x, y, w) {
      const item = w || SK.rollWeapon(this.floorNum);
      const p = this.dropPickup('weapon', x, y, { def: item, tierColor: item.tierColor });
      if (p) p.weapon = item;
      return p;
    }

    /* ==================== 掉落 / 交互 ==================== */
    pickupCheck() {
      const room = this.room;
      const p = this.player;
      if (!room || !p || p.dead) return;
      for (let i = room.pickups.length - 1; i >= 0; i--) {
        const pk = room.pickups[i];
        if (pk.dead) { room.pickups.splice(i, 1); continue; }
        const d = SK.dist(pk.x, pk.y, p.x, p.y);
        if (pk.kind === 'coin' && d < 12) {
          p.addCoin(Math.max(1, Math.round((pk.value || 1) * p.mods.gold)));
          SK.Sound.coin();
          this.spark(pk.x, pk.y, '#ffd35c', 4, 0.5);
          room.pickups.splice(i, 1);
        } else if (pk.kind === 'bosschest' && !pk.opened && d < 20) {
          pk.opened = true;
          SK.Sound.level();
          this.shake(6);
          this.spark(pk.x, pk.y - 6, '#ffd35c', 22, 1.2);
          this.openBossChest(pk);
        } else if (pk.kind === 'hp' && d < 13) {
          if (p.hp < p.maxHp) {
            p.heal(2);
            SK.Sound.pickup();
            this.floatText(p.x, p.y - 14, '+2', '#7dff9a');
            this.spark(pk.x, pk.y, '#ff6a7d', 6);
            room.pickups.splice(i, 1);
          }
        } else if (pk.kind === 'energy' && d < 13) {
          if (p.energy < p.maxEnergy - 1) {
            p.addEnergy(28);
            SK.Sound.pickup();
            this.floatText(p.x, p.y - 14, '+能量', '#7ad8ff');
            this.spark(pk.x, pk.y, '#7ad8ff', 6);
            room.pickups.splice(i, 1);
          }
        } else if (pk.kind === 'chest' && !pk.opened && d < 18) {
          pk.opened = true;
          SK.Sound.level();
          this.spark(pk.x, pk.y - 4, '#ffd35c', 14, 0.8);
          this.openChest(pk);
        } else if (pk.kind === 'portal' && d < 14) {
          if (pk.arm > 0) { pk.arm -= 1 / 60; }
          else if (!this._trans) this.portalEnter();
        }
      }
      // 找到可交互目标
      let best = null, bestD = 24;
      for (const pk of room.pickups) {
        if (pk.kind !== 'weapon' && pk.kind !== 'shelf' && pk.kind !== 'shrine' && pk.kind !== 'event') continue;
        const d = SK.dist(pk.x, pk.y, p.x, p.y);
        if (d < bestD) { bestD = d; best = pk; }
      }
      this.hintTarget = best;
      if (best) {
        if (best.kind === 'weapon') {
          this.setHint('[E] 拾取 ' + (best.weapon ? best.weapon.name : '武器'));
        } else if (best.kind === 'shrine') {
          this.setHint('[E] 领取一个免费天赋');
        } else if (best.kind === 'event') {
          this.setHint(EVENT_HINT[best.evType] || '[E] 互动');
        } else {
          const price = p.mods.shopHalf ? Math.ceil(best.price / 2) : best.price;
          this.setHint('[E] 购买 ' + best.item.label + ' · ' + price + ' 金币' + (p.mods.shopHalf ? '（半价）' : ''));
        }
      } else if (!p.dead && room.locked) {
        this.setHint('清空敌人才能开门');
      } else {
        this.setHint('');
      }
    }

    doInteract() {
      const pk = this.hintTarget;
      const p = this.player;
      if (!pk || !p) return;
      if (pk.kind === 'weapon') {
        const w = pk.weapon;
        const cur = p.weapon;
        const old = p.giveWeapon(w);
        SK.Sound.pickup();
        this.spark(pk.x, pk.y, pk.tierColor || '#ffffff', 10, 0.7);
        const room = this.room;
        room.pickups.splice(room.pickups.indexOf(pk), 1);
        // 换下来的旧武器留在原地，别吞掉
        if (old) {
          const drop = this.dropWeapon(pk.x, pk.y, old);
          if (drop) drop.settled = true;
          this.toast('换上 ' + w.name + '（' + this.cmpText(cur, w) + '）· 旧武器掉在脚下');
        } else {
          const st = SK.weaponStats(w);
          this.toast('获得 ' + w.name + ' · DPS ' + st.dps + (w.tier > 1 ? ' [' + SK.TIER_NAMES[w.tier] + ']' : ''));
        }
        this.hintTarget = null;
        this.refreshSlots();
      } else if (pk.kind === 'shrine') {
        // 祭坛：免费给一个天赋
        const room = this.room;
        room.pickups.splice(room.pickups.indexOf(pk), 1);
        this.spark(pk.x, pk.y - 6, '#b98aff', 20, 1);
        this.hintTarget = null;
        this.openTalents('祭坛 · 免费天赋');
      } else if (pk.kind === 'event') {
        this.useEvent(pk);
      } else if (pk.kind === 'shelf') {
        const price = p.mods.shopHalf ? Math.ceil(pk.price / 2) : pk.price;
        if (p.coins >= price) {
          p.coins -= price;
          SK.Sound.buy();
          const it = pk.item;
          if (it.kind === 'hp') { p.heal(3); this.floatText(p.x, p.y - 14, '+3 HP', '#7dff9a'); }
          else if (it.kind === 'energy') { p.addEnergy(120); this.floatText(p.x, p.y - 14, '+能量', '#7ad8ff'); }
          else if (it.kind === 'talent') {
            this.spark(pk.x, pk.y, '#b98aff', 16, 1);
            const room0 = this.room;
            room0.pickups.splice(room0.pickups.indexOf(pk), 1);
            this.hintTarget = null;
            this.openTalents('天赋券 · 选择天赋');
            return;
          }
          else if (it.kind === 'weapon') {
            const w = it.def || SK.rollWeapon(this.floorNum + 1);
            const old = p.giveWeapon(w);
            if (old) { const drop = this.dropWeapon(pk.x + 26, pk.y + 8, old); if (drop) drop.settled = true; }
            this.toast('获得 ' + w.name + ' [' + SK.TIER_NAMES[w.tier] + ']');
            this.refreshSlots();
          }
          this.spark(pk.x, pk.y, '#ffd35c', 12, 0.8);
          const room = this.room;
          room.pickups.splice(room.pickups.indexOf(pk), 1);
          this.hintTarget = null;
        } else {
          SK.Sound.deny();
          this.toast('金币不够（需要 ' + pk.price + '）');
        }
      }
    }

    /* ==================== 事件 ==================== */
    onBossDeath(boss) {
      const room = this.room;
      this.shake(12);
      this.burst(boss.x, boss.y, 70, '#ffffff');
      for (let i = 0; i < 8; i++) {
        this.particles.push({
          x: boss.x, y: boss.y, vx: SK.rand(-90, 90), vy: SK.rand(-120, -30),
          life: SK.rand(0.4, 0.9), maxLife: 0.9,
          color: ['#ffd35c', '#ff7a3a', '#ffffff'][i % 3], size: SK.rand(2, 4), grav: 200
        });
      }
      this.boss = null;
      // 清掉小怪
      for (const e of room.enemies.slice()) {
        e.dead = true;
        this.spawnDeathBurst(e);
      }
      room.enemies.length = 0;
      room.cleared = true;
      room.locked = false;
      // 掉落
      for (let i = 0; i < 8; i++) {
        this.dropPickup('coin', boss.x + SK.rand(-30, 30), boss.y + SK.rand(-30, 30), { value: 2 });
      }
      for (let i = 0; i < 2; i++) this.dropPickup('hp', boss.x + SK.rand(-24, 24), boss.y + SK.rand(-20, 20), {});
      // BOSS 专属宝箱（必出该 BOSS 的传说武器）
      const bc = new SK.Pickup('bosschest', room.rect.x + SK.ROOM_PW / 2 - 46, room.rect.y + SK.ROOM_PH / 2 - 12, {});
      room.pickups.push(bc);
      const portal = new SK.Pickup('portal', room.rect.x + SK.ROOM_PW / 2 + 10, room.rect.y + SK.ROOM_PH / 2 + 6, { arm: 0.8 });
      portal.settled = true;
      room.pickups.push(portal);
      // 通关一层的补给
      const p = this.player;
      if (p) {
        p.armor = p.maxArmor;
        p.hp = Math.min(p.maxHp, p.hp + 2);
        p.addEnergy(p.maxEnergy * 0.6);
        this.floatText(p.x, p.y - 16, '补给！', '#7dff9a');
      }
      if (this.floorNum >= 3) this.toast('开宝箱 → 走进传送门 · 离开地牢');
      else this.toast('第 ' + this.floorNum + ' 层通过！开宝箱 → 走传送门');
    }

    onPlayerDeath() {
      this.state = 'dead';
      this.deadT = 1.15;
      this.shake(10);
      this.burst(this.player.x, this.player.y, 40, '#ff5a6e');
      SK.Sound.hurt();
      this.el.bossBar.classList.remove('show');
    }

    win() {
      const rec = SK.Save.report(this.floorNum, true);
      const t = Math.round((Date.now() - this.startedAt) / 1000);
      this.el.winStats.innerHTML = this.statHtml([
        ['击杀', this.killCount], ['金币', this.player ? this.player.coins : 0], ['用时', t + 's']
      ]);
      this.showScreen('scrWin');
      SK.Sound.level();
      if (rec) this.el.recTag.textContent = '最佳记录：已通关 ★';
    }

    toTitle() {
      this.showScreen('scrTitle');
      this.makePreview();
      this.state = 'title';
    }

    resume() {
      this.showScreen(null);
      this.state = 'play';
      this.last = 0;
    }

    statHtml(pairs) {
      return pairs.map((p) => '<div><b>' + p[1] + '</b>' + p[0] + '</div>').join('');
    }

    // 「换这把武器比现在强/弱多少」的简短文案
    cmpText(cur, next) {
      const a = SK.weaponStats(cur), b = SK.weaponStats(next);
      if (!b) return '';
      if (!a) return 'DPS ' + b.dps;
      const d = Math.round((b.dps / Math.max(1, a.dps) - 1) * 100);
      const arrow = d > 4 ? '▲ +' + d + '%' : d < -4 ? '▼ ' + d + '%' : '≈ 持平';
      return 'DPS ' + b.dps + ' ' + arrow;
    }

    /* ==================== 武器对比浮窗（DOM） ==================== */
    updateWeaponTip() {
      const el = this.el.wtip;
      if (!el) return;
      const pk = this.hintTarget;
      let w = null;
      if (pk && pk.kind === 'weapon') w = pk.weapon;
      else if (pk && pk.kind === 'shelf' && pk.item && pk.item.kind === 'weapon') w = pk.item.def;
      if (!w || !this.room) { if (el.classList.contains('show')) el.classList.remove('show'); return; }

      const st = SK.weaponStats(w);
      const cur = this.player.weapon;
      const curSt = SK.weaponStats(cur);
      const sig = w.id + '|' + w.tier + '|' + (cur ? cur.id + cur.tier : '') + '|' + (w.kind);
      if (sig !== this.cache.wtip) {
        this.cache.wtip = sig;
        const dmgTxt = w.kind === 'melee'
          ? ('伤害 ' + st.per)
          : ('单发 ' + Math.round(w.dmg) + (st.n > 1 ? '×' + st.n : ''));
        const en = st.energy > 0 ? ('耗能 ' + st.energy) : '不耗能';
        let cmp = '';
        if (curSt && cur !== w) {
          const d = Math.round((st.dps / Math.max(1, curSt.dps) - 1) * 100);
          const cls = d > 4 ? 'up' : d < -4 ? 'dn' : 'eq';
          const txt = d > 4 ? ('▲ +' + d + '%') : d < -4 ? ('▼ ' + d + '%') : '≈ 持平';
          cmp = '<span class="' + cls + '">' + txt + '</span>';
        }
        el.innerHTML =
          '<b style="color:' + (w.tierColor || '#dfe7f5') + '">' + w.name +
          ' <span style="font-size:5.5px;opacity:.8">' + SK.TIER_NAMES[w.tier] + '</span></b>' +
          '<div class="row"><span>' + dmgTxt + '</span><span class="dps">DPS ' + st.dps + '</span>' + cmp + '</div>' +
          '<div class="row"><span>' + en + ' · ' + st.cd + 's/发</span></div>';
      }

      const sx = Math.round(pk.x - this.cam.x);
      const sy = Math.round(pk.y - this.cam.y) - 14;
      el.style.left = SK.clamp(sx, 44, SK.VIEW_W - 44) + 'px';
      el.style.top = SK.clamp(sy, 42, SK.VIEW_H - 6) + 'px';
      if (!el.classList.contains('show')) el.classList.add('show');
    }

    /* ==================== 房间事件 ==================== */
    useEvent(pk) {
      const p = this.player;
      const cost = EVENT_COST[pk.evType] || 10;
      if (p.coins < cost) {
        SK.Sound.deny();
        this.toast('金币不够（需要 ' + cost + '）');
        return;
      }
      p.coins -= cost;
      SK.Sound.buy();
      const room = this.room;
      const done = () => { room.pickups.splice(room.pickups.indexOf(pk), 1); this.hintTarget = null; };

      if (pk.evType === 'smith') {
        const w = p.weapon;
        if (!w || w.tier >= 4) {
          p.coins += cost;
          SK.Sound.deny();
          this.toast(w ? '这把武器已经是最高档了' : '手上没有武器');
          return;
        }
        const nw = SK.makeWeapon(w.id, w.tier + 1, !!(w.def && w.def.boss));
        p.slots[p.slot] = nw;
        this.refreshSlots();
        this.spark(pk.x, pk.y - 8, '#ffd35c', 18, 1);
        this.toast(w.name + ' 升级 → 第 ' + nw.tier + ' 档（伤害 ' + nw.dmg + '）');
        done();
      } else if (pk.evType === 'statue') {
        const t = SK.TALENTS[(Math.random() * SK.TALENTS.length) | 0];
        p.pickTalent(t);
        this.buildHud();
        this.spark(pk.x, pk.y - 8, '#c9a0ff', 18, 1);
        this.toast('雕像赐福：' + t.name + ' — ' + t.desc);
        done();
      } else if (pk.evType === 'gambler') {
        const win = Math.random() < 0.55;
        if (win) {
          const w = SK.rollWeapon(3);
          const nw = SK.makeWeapon(w.id, Math.max(3, w.tier));
          p.slots[p.slot] ? (p.slots[p.slot] = nw) : (p.slots[0] = nw);
          this.refreshSlots();
          this.spark(pk.x, pk.y - 8, '#ffd35c', 20, 1.2);
          this.toast('赌赢了！' + nw.name + ' [' + SK.TIER_NAMES[nw.tier] + '] DPS ' + SK.weaponStats(nw).dps);
        } else {
          SK.Sound.deny();
          this.toast('赌输了…什么都没有');
        }
        done();
      } else if (pk.evType === 'well') {
        if (Math.random() < 0.5) {
          p.heal(3);
          this.floatText(p.x, p.y - 16, '+3 HP', '#7dff9a');
          this.toast('许愿井：回复 3 点生命');
        } else {
          p.addEnergy(140);
          this.floatText(p.x, p.y - 16, '+能量', '#7ad8ff');
          this.toast('许愿井：回复能量');
        }
        this.spark(pk.x, pk.y - 8, '#7ad8ff', 16, 1);
        done();
      }
    }

    /* ==================== 天赋选择 ==================== */
    openTalents(title, cb) {
      const p = this.player;
      if (!p) return;
      this._talentCb = cb || null;
      this._rerolls = 0;
      this._talentTitle = title || '选择天赋';
      this.rollTalentOptions();
      this.showScreen('scrTalent');
      SK.Sound.level();
    }

    rollTalentOptions() {
      const pool = SK.TALENTS.slice();
      const picks = [];
      while (picks.length < 3 && pool.length) {
        picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      this._talentPicks = picks;
      this.el.talentTitle.textContent = this._talentTitle || '选择天赋';
      const list = this.el.talentList;
      list.innerHTML = '';
      picks.forEach((t, i) => {
        const card = document.createElement('div');
        card.className = 'tcard';
        const tag = document.createElement('div');
        tag.className = 'tag'; tag.textContent = t.tag;
        const nm = document.createElement('div');
        nm.className = 'nm'; nm.textContent = t.name;
        const ds = document.createElement('div');
        ds.className = 'ds'; ds.textContent = t.desc;
        card.appendChild(tag); card.appendChild(nm); card.appendChild(ds);
        card.addEventListener('click', () => this.chooseTalent(i));
        list.appendChild(card);
      });
      const btn = this.el.btnReroll;
      if (btn) {
        const cost = 15 + (this._rerolls || 0) * 10;
        this._rerollCost = cost;
        const ok = this.player.coins >= cost;
        btn.textContent = '换一批（' + cost + ' 金币）';
        btn.style.opacity = ok ? '1' : '.45';
        btn.style.pointerEvents = ok ? 'auto' : 'none';
      }
    }

    rerollTalents() {
      const cost = this._rerollCost || 15;
      if (!this.player || this.player.coins < cost) { SK.Sound.deny(); return; }
      this.player.coins -= cost;
      this._rerolls = (this._rerolls || 0) + 1;
      SK.Sound.buy();
      this.cache.coins = null;
      this.rollTalentOptions();
    }

    chooseTalent(i) {
      const t = this._talentPicks && this._talentPicks[i];
      if (!t) return;
      this.player.pickTalent(t);
      this.buildHud();
      this.toast('天赋：' + t.name + ' — ' + t.desc);
      SK.Sound.buy();
      const cb = this._talentCb;
      this._talentCb = null;
      this.showScreen(null);
      this.state = 'play';
      this.last = 0;
      if (cb) cb();
    }

    /* ==================== 宝箱 / 掉落 ==================== */
    // 宝箱开出三选一：武器 / 血瓶 / 能量
    openChest(pk) {
      const r = Math.random();
      if (r < 0.45) {
        this.dropWeapon(pk.x, pk.y - 8);
        this.toast('宝箱：武器');
      } else if (r < 0.78) {
        this.dropPickup('hp', pk.x, pk.y - 8, {});
        this.toast('宝箱：血瓶');
      } else {
        this.dropPickup('energy', pk.x, pk.y - 8, {});
        this.toast('宝箱：能量');
      }
    }

    /* ==================== BOSS 宝箱 ==================== */
    openBossChest(pk) {
      const key = this.room && this.room.bossKey;
      const wid = SK.BOSS_WEAPONS[key] || 'greatsword';
      const w = SK.makeWeapon(wid, 4, true);
      this.dropWeapon(pk.x, pk.y - 10, w);
      this.toast('BOSS 宝箱：' + w.name + '（传说）');
      for (let i = 0; i < 6; i++) {
        this.dropPickup('coin', pk.x + SK.rand(-22, 22), pk.y + SK.rand(-18, 18), { value: 2 });
      }
      this.dropPickup('hp', pk.x - 16, pk.y + 12, {});
      this.dropPickup('energy', pk.x + 16, pk.y + 12, {});
    }

    /* ==================== HUD ==================== */
    buildHud() {
      const p = this.player;
      if (!p) return;
      const hp = this.el.hpPips, ar = this.el.armorPips;
      hp.innerHTML = ''; ar.innerHTML = '';
      for (let i = 0; i < p.maxHp; i++) hp.appendChild(document.createElement('i'));
      for (let i = 0; i < p.maxArmor; i++) ar.appendChild(document.createElement('i'));
      this.cache = {};
      this.refreshSlots();
      this.updateHud(true);
    }

    refreshSlots() {
      const p = this.player;
      if (!p) return;
      this.el.slotEls.forEach((el, i) => {
        const w = p.slots[i];
        el.querySelector('.nm').textContent = w ? w.name : '--';
        el.querySelector('.en').textContent = w ? (w.energy > 0 ? w.energy : '-') : '-';
        el.classList.toggle('cur', i === p.slot);
        el.style.color = '';
        if (w) el.querySelector('.nm').style.color = i === p.slot ? '#ffe9a8' : (w.tier > 1 ? w.tierColor : '#dfe7f5');
      });
    }

    setHint(txt) {
      if (this.cache.hint === txt) return;
      this.cache.hint = txt;
      this.el.hintTag.textContent = txt;
    }

    toast(msg) {
      this.el.toast.textContent = msg;
      this.el.toast.classList.add('show');
      if (this._toastTimer) clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => this.el.toast.classList.remove('show'), 1900);
    }

    updateHud(force) {
      const p = this.player;
      if (!p) return;
      // HUD 不需要 60fps：限流到 ~15Hz，避免每帧写 DOM 触发重排
      const now = this.time;
      if (!force && now - (this._hudT || 0) < 0.066) return;
      this._hudT = now;
      const c = this.cache;
      const hp = Math.ceil(p.hp), arm = Math.ceil(p.armor);
      if (force || c.hp !== hp) {
        c.hp = hp;
        Array.from(this.el.hpPips.children).forEach((n, i) => n.classList.toggle('on', i < hp));
      }
      if (force || c.arm !== arm) {
        c.arm = arm;
        Array.from(this.el.armorPips.children).forEach((n, i) => n.classList.toggle('on', i < arm));
      }
      const en = Math.round(p.energy);
      if (force || c.en !== en) {
        c.en = en;
        this.el.energyFill.style.width = Math.max(0, (p.energy / p.maxEnergy) * 70) + 'px';
        this.el.energyTxt.textContent = en;
      }
      if (force || c.coins !== p.coins) {
        c.coins = p.coins;
        this.el.coinTag.querySelector('b').textContent = p.coins;
      }
      if (force || c.floor !== this.floorNum) {
        c.floor = this.floorNum;
        this.el.floorTag.textContent = this.floorNum + 'F ' + SK.Art.biome(this.floorNum).name;
      }
      const dr = p.dashCharges + (p.dashCharges < p.dashChargeMax ? p.dashRegen / (p.perk.dash2 ? 0.85 : 1) : 0);
      const dw = Math.round((dr / p.dashChargeMax) * 40);
      if (force || c.dash !== dw) { c.dash = dw; this.el.dashFill.style.width = dw + 'px'; }
      // 武器槽
      const sig = p.slots.map((w) => (w ? w.name + w.dmg + w.energy : '-')).join('|') + '#' + p.slot;
      if (force || c.slots !== sig) { c.slots = sig; this.refreshSlots(); }
      // Boss 血条
      const b = this.boss;
      if (b && !b.dead) {
        this.el.bossBar.classList.add('show');
        if (c.bossName !== b.name) { c.bossName = b.name; this.el.bossName.textContent = b.name; }
        this.el.bossFill.style.width = Math.max(0, (b.hp / b.maxHp) * 100) + '%';
      } else {
        this.el.bossBar.classList.remove('show');
      }
    }

    /* ==================== 主循环 ==================== */
    loop(ts) {
      requestAnimationFrame(this.loop);
      // 任何一帧抛异常都不能让它每帧刷屏、把浏览器拖死
      try {
        this.tick(ts);
      } catch (err) {
        this.errCount = (this.errCount || 0) + 1;
        if (this.errCount <= 3) console.error('[游戏循环异常]', err);
        if (this.errCount > 60) this.state = 'halted';
      }
    }

    tick(ts) {
      if (this.state === 'halted') return;
      // 高刷屏（120/144Hz）没必要 144 次/秒地重画这个世界，封顶 ~72fps
      if (this._gate && ts - this._gate < 12) return;
      this._gate = ts;
      if (!this.last) this.last = ts;
      let dt = (ts - this.last) / 1000;
      this.last = ts;
      if (!(dt > 0)) dt = 0.016;
      if (dt > 0.06) dt = 0.06;

      // 帧率自适应：持续掉帧就砍特效
      this.fpsAvg = this.fpsAvg ? this.fpsAvg * 0.94 + (1 / Math.max(0.001, dt)) * 0.06 : 60;
      if (this.fpsAvg < 42) { if (!this.lowFx) this.lowFx = true; }
      else if (this.fpsAvg > 52) { if (this.lowFx) this.lowFx = false; }

      if (this.hitStop > 0) {
        this.hitStop -= dt;
        dt *= 0.22;
      }
      this.time += dt;
      SK.Sound.newFrame();

      if (this.state === 'play') this.update(dt);
      else if (this.state === 'dead') {
        this.deadT -= dt;
        this.updateFx(dt, 1);
        this.updateCamera(dt);
        if (this.deadT <= 0) {
          const rec = SK.Save.report(this.floorNum, false);
          const t = Math.round((Date.now() - this.startedAt) / 1000);
          this.el.overStats.innerHTML = this.statHtml([
            ['到达楼层', this.floorNum], ['击杀', this.killCount], ['金币', this.player ? this.player.coins : 0], ['用时', t + 's']
          ]);
          this.showScreen('scrOver');
          if (rec) this.el.recTag.textContent = '最佳记录：第 ' + rec + ' 层';
        }
      } else if (this.state === 'title' || this.state === 'title_sel') {
        // 标题界面下缓慢漂移的粒子
        if (Math.random() < 0.06) {
          this.particles.push({
            x: this.cam.x + SK.rand(0, VIEW_W), y: this.cam.y + SK.rand(0, VIEW_H),
            vx: SK.rand(-6, 6), vy: SK.rand(-14, -4),
            life: 2.4, maxLife: 2.4, color: SK.chance(0.5) ? '#6fd8ff' : '#ffd35c', size: SK.rand(1, 2), grav: 0
          });
        }
        this.updateFx(dt, 1);
      }

      // 按键
      if (SK.Input.pressed('Escape')) {
        if (this.state === 'play') this.showScreen('scrPause');
        else if (this.state === 'pause') this.resume();
      }
      if (this.state === 'title_sel' && SK.Input.pressed('Enter')) this.startRun(this.charIndex);
      if (this.state === 'title' && (SK.Input.pressed('Enter') || SK.Input.pressed('Space'))) {
        this.showScreen('scrChar');
      }
      if (SK.Input.pressed('F3')) this.showDebug = !this.showDebug;

      // 菜单/暂停/结算界面下世界几乎不变，降到 ~20fps 渲染，别白烧显卡
      const menu = this.state === 'title' || this.state === 'title_sel' || this.state === 'pause' ||
        this.state === 'over' || this.state === 'win' || this.state === 'talent';
      if (menu) {
        this._skip = (this._skip || 0) + 1;
        if (this._skip % 3 !== 0) { SK.Input.endFrame(); return; }
      }

      this.render();
      SK.Input.endFrame();
    }

    update(dt) {
      const p = this.player;
      if (!p) return;
      p.update(dt, this);

      const es = this.enemies;
      for (let i = es.length - 1; i >= 0; i--) {
        const e = es[i];
        if (e.dead) { es.splice(i, 1); continue; }
        e.update(dt, this);
      }
      // 敌人互推
      for (let i = 0; i < es.length; i++) {
        for (let j = i + 1; j < es.length; j++) {
          const a = es[i], b = es[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const d = Math.hypot(dx, dy) || 1;
          const min = a.r + b.r;
          if (d < min) {
            const push = ((min - d) / d) * 0.5;
            a.x -= dx * push; a.y -= dy * push;
            b.x += dx * push; b.y += dy * push;
          }
        }
      }

      SK.updateBullets(this, dt);

      this.pickupCheck();
      if (SK.Input.pressed('KeyE') || SK.Input.pressed('KeyF')) this.doInteract();
      for (const pk of this.room.pickups) pk.update(dt, this);

      this.updateFx(dt);
      this.updateWarnings(dt);
      this.updateRoom(dt);
      this.updateCamera(dt);
      this.updateHud();

      // 里程碑天赋（清 5 间房）—— 等这一帧做完再弹窗
      if (this.pendingTalent && !this._talentCb && this.state === 'play') {
        const t = this.pendingTalent;
        this.pendingTalent = null;
        this.openTalents(t, null);
      }
    }

    updateFx(dt, freeze) {
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const q = this.particles[i];
        q.life -= dt;
        if (q.life <= 0) { this.particles.splice(i, 1); continue; }
        if (!q.ring) {
          q.x += q.vx * dt;
          q.y += q.vy * dt;
          q.vy += (q.grav || 0) * dt;
          q.vx *= Math.pow(0.05, dt);
        }
      }
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.life -= dt;
        f.y += f.vy * dt;
        f.vy *= Math.pow(0.15, dt);
        if (f.life <= 0) this.floats.splice(i, 1);
      }
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        this.lasers[i].life -= dt;
        if (this.lasers[i].life <= 0) this.lasers.splice(i, 1);
      }
      if (this.shakeT > 0) {
        this.shakeT -= dt;
        this.shakeAmt *= Math.pow(0.02, dt);
        if (this.shakeT <= 0) this.shakeAmt = 0;
      }
    }

    /* ==================== 小地图 ==================== */
    drawRoomIcon(g, type, cx, cy, lit) {
      const W = '#ffffff', Y = '#ffd35c', G = '#5ee08a', P = '#c9a0ff', R = '#ff6a7a';
      if (type === 'boss') {
        g.fillStyle = lit ? R : 'rgba(255,120,140,.6)';
        g.fillRect(cx - 3, cy - 3, 6, 5);
        g.fillRect(cx - 2, cy + 2, 4, 1);
        g.fillStyle = '#2a0a12';
        g.fillRect(cx - 2, cy - 2, 2, 2);
        g.fillRect(cx + 1, cy - 2, 2, 2);
      } else if (type === 'treasure') {
        g.fillStyle = lit ? Y : 'rgba(255,211,92,.55)';
        g.fillRect(cx - 3, cy - 1, 6, 4);
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.fillRect(cx - 3, cy, 6, 1);
        g.fillStyle = lit ? '#fff0a8' : 'rgba(255,240,168,.5)';
        g.fillRect(cx - 1, cy + 1, 2, 2);
      } else if (type === 'shop') {
        g.fillStyle = lit ? G : 'rgba(94,224,138,.55)';
        g.beginPath(); g.arc(cx, cy, 3, 0, SK.TAU); g.fill();
        g.fillStyle = 'rgba(0,0,0,.45)';
        g.beginPath(); g.arc(cx, cy, 1.2, 0, SK.TAU); g.fill();
      } else if (type === 'elite') {
        g.fillStyle = lit ? '#ff9a5a' : 'rgba(255,154,90,.55)';
        g.fillRect(cx - 3, cy + 2, 6, 1.5);
        g.fillRect(cx - 1, cy - 3, 2, 5);
      } else if (type === 'shrine') {
        g.fillStyle = lit ? P : 'rgba(201,160,255,.55)';
        g.fillRect(cx - 1, cy - 3, 2, 6);
        g.fillRect(cx - 3, cy - 1, 6, 2);
      } else if (type === 'start') {
        g.fillStyle = lit ? W : 'rgba(255,255,255,.5)';
        g.fillRect(cx - 2, cy - 2, 4, 4);
        g.fillStyle = 'rgba(0,0,0,.5)';
        g.fillRect(cx - 1, cy - 1, 2, 2);
      } else {
        g.fillStyle = lit ? 'rgba(180,200,230,.75)' : 'rgba(140,160,190,.45)';
        g.fillRect(cx - 1, cy - 1, 2, 2);
      }
    }

    drawMinimap(g) {
      const f = this.floor;
      if (!f || !this.room || !f.rooms.length) return;
      const CW = 13, CH = 10, GAP = 3;
      const w = f.gw * CW + (f.gw - 1) * GAP;
      const h = f.gh * CH + (f.gh - 1) * GAP;
      const ox = SK.VIEW_W - w - 8, oy = 25;
      const fill = {
        start: '#3a6ea0', normal: '#39435a', treasure: '#6a5518',
        shop: '#1e4a34', shrine: '#3a2a52', elite: '#523020', boss: '#5a1c26'
      };
      g.save();
      g.fillStyle = 'rgba(6,9,15,.80)';
      g.fillRect(ox - 5, oy - 5, w + 10, h + 10);
      g.strokeStyle = 'rgba(90,120,170,.5)';
      g.lineWidth = 1;
      g.strokeRect(ox - 4.5, oy - 4.5, w + 9, h + 9);

      const cell = (r) => ({ x: ox + r.gx * (CW + GAP), y: oy + r.gy * (CH + GAP) });

      // 连接线
      g.strokeStyle = 'rgba(120,150,200,.45)';
      g.lineWidth = 1.5;
      for (const room of f.rooms) {
        for (const nb of room.adj) {
          if (room.gx > nb.room.gx || room.gy > nb.room.gy) continue;
          const a = cell(room), b = cell(nb.room);
          g.beginPath();
          g.moveTo(a.x + CW / 2, a.y + CH / 2);
          g.lineTo(b.x + CW / 2, b.y + CH / 2);
          g.stroke();
        }
      }
      // 房间格子 + 图标
      for (const room of f.rooms) {
        const p = cell(room);
        const seen = room.visited;
        g.fillStyle = seen ? (fill[room.type] || fill.normal) : '#232b3a';
        g.fillRect(p.x, p.y, CW, CH);
        g.strokeStyle = seen ? 'rgba(0,0,0,.5)' : 'rgba(96,112,146,.5)';
        g.lineWidth = 1;
        g.strokeRect(p.x + 0.5, p.y + 0.5, CW - 1, CH - 1);
        this.drawRoomIcon(g, room.type, p.x + CW / 2, p.y + CH / 2, seen);
        if (room.cleared && room.type === 'normal') {
          g.fillStyle = 'rgba(0,0,0,.35)';
          g.fillRect(p.x + 1, p.y + 1, CW - 2, CH - 2);
        }
      }
      // 当前房间
      const cur = cell(this.room);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1.5;
      g.strokeRect(cur.x - 1.5, cur.y - 1.5, CW + 3, CH + 3);
      if (Math.sin(this.time * 6) > -0.2) {
        g.fillStyle = '#ffffff';
        g.fillRect(cur.x + CW - 4, cur.y + 2, 2, 2);
      }
      // 图例改为 DOM（canvas 里 5px 中文放大后糊成一团）
      g.restore();
    }

    snapCamera() {
      if (!this.room || !this.player) return;
      const r = this.room.rect;
      this.cam.x = SK.clamp(this.player.x - VIEW_W / 2, r.x, r.x + r.w - VIEW_W);
      this.cam.y = SK.clamp(this.player.y - VIEW_H / 2, r.y, r.y + r.h - VIEW_H);
    }

    updateCamera(dt) {
      const p = this.player;
      if (!p || !this.room) return;
      const r = this.room.rect;
      const ax = Math.cos(p.aimAng) * 16, ay = Math.sin(p.aimAng) * 10;
      let tx = p.x + ax - VIEW_W / 2;
      let ty = p.y + ay - VIEW_H / 2;
      tx = SK.clamp(tx, r.x, r.x + r.w - VIEW_W);
      ty = SK.clamp(ty, r.y, r.y + r.h - VIEW_H);
      const k = Math.min(1, dt * 9);
      this.cam.x += (tx - this.cam.x) * k;
      this.cam.y += (ty - this.cam.y) * k;
    }

    /* ==================== 渲染 ==================== */
    render() {
      const g = this.ctx;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      const biome = SK.Art.biome(this.floorNum);
      g.fillStyle = biome.void;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      if (!this.floor || !this.player) return;

      let sx = 0, sy = 0;
      if (this.shakeT > 0 && this.shakeAmt > 0.2) {
        sx = SK.rand(-this.shakeAmt, this.shakeAmt);
        sy = SK.rand(-this.shakeAmt, this.shakeAmt);
      }
      g.save();
      g.translate(Math.round(-this.cam.x + sx), Math.round(-this.cam.y + sy));

      const floor = this.floor;
      const solidAt = (tx, ty) => this.solidTile(tx, ty);
      const blockAt = (tx, ty) => {
        if (tx < 0 || ty < 0 || tx >= floor.tw || ty >= floor.th) return false;
        return floor.grid[ty * floor.tw + tx] === T.BLOCK;
      };

      // 房间地面
      for (const room of floor.rooms) {
        const r = room.rect;
        if (r.x + r.w < this.cam.x - 32 || r.x > this.cam.x + VIEW_W + 32) continue;
        if (r.y + r.h < this.cam.y - 32 || r.y > this.cam.y + VIEW_H + 32) continue;
        if (!room.ground) room.ground = SK.Art.renderGround(room, biome, solidAt, blockAt);
        g.drawImage(room.ground, r.x, r.y);
      }

      // 门
      for (const d of floor.doors) {
        const r = d.rect;
        if (r.x + 64 < this.cam.x || r.x - 32 > this.cam.x + VIEW_W) continue;
        if (r.y + 64 < this.cam.y || r.y - 32 > this.cam.y + VIEW_H) continue;
        SK.Art.drawDoor(g, d, biome, this.time);
      }

      // 掉落物
      if (this.room) for (const pk of this.room.pickups) SK.Art.drawPickup(g, pk, this.time);

      // BOSS 预警区
      if (this.warnings.length) this.drawWarnings(g);

      // 敌人
      for (const e of this.enemies) SK.Art.drawEnemy(g, e, this.time);

      // 玩家
      if (this.player && !this.player.dead) SK.Art.drawPlayer(g, this.player, this.time);

      // 子弹
      for (const b of this.bullets) SK.Art.drawBullet(g, b);

      // 激光
      for (const l of this.lasers) SK.Art.drawBullet(g, { x: l.x, y: l.y, tx: l.tx, ty: l.ty, r: l.r, color: l.color, kind: 'laser' });

      // 粒子
      for (const q of this.particles) {
        if (q.ring) {
          const k = 1 - q.life / q.maxLife;
          g.globalAlpha = Math.max(0, 1 - k);
          g.strokeStyle = q.color;
          g.lineWidth = 3 * (1 - k) + 1;
          g.beginPath(); g.arc(q.x, q.y, q.size + k * 60, 0, SK.TAU); g.stroke();
          g.globalAlpha = 1;
        } else SK.Art.drawParticle(g, q);
      }

      // 伤害数字
      g.font = 'bold 7px monospace';
      g.textAlign = 'center';
      for (const f of this.floats) {
        g.globalAlpha = Math.min(1, f.life / f.maxLife * 1.6);
        g.fillStyle = '#000000';
        g.fillText(f.text, f.x + 0.6, f.y + 0.6);
        g.fillStyle = f.color;
        g.fillText(f.text, f.x, f.y);
        g.globalAlpha = 1;
      }
      g.textAlign = 'left';

      g.restore();

      // 暗角（渐变缓存，别每帧新建）
      if (!this.lowFx) {
        if (!this._vg) {
          this._vg = g.createRadialGradient(VIEW_W / 2, VIEW_H / 2, 120, VIEW_W / 2, VIEW_H / 2, 300);
          this._vg.addColorStop(0, 'rgba(0,0,0,0)');
          this._vg.addColorStop(1, 'rgba(0,0,0,.42)');
        }
        g.fillStyle = this._vg;
        g.fillRect(0, 0, VIEW_W, VIEW_H);
      }

      // 小地图
      if (this.state === 'play' || this.state === 'dead' || this.state === 'pause') {
        this.drawMinimap(g);
        this.updateWeaponTip();
      } else if (this.el.wtip) {
        this.el.wtip.classList.remove('show');
      }

      // F3 性能读数
      if (this.showDebug) {
        g.font = 'bold 8px monospace';
        g.textAlign = 'left';
        const lines = [
          'FPS ' + Math.round(this.fpsAvg || 0) + (this.lowFx ? ' (low)' : ''),
          'enemies ' + this.enemies.length + '  bullets ' + this.bullets.length,
          'particles ' + this.particles.length + '  floats ' + this.floats.length
        ];
        g.fillStyle = 'rgba(0,0,0,.6)';
        g.fillRect(4, VIEW_H - 40, 120, 36);
        g.fillStyle = '#9ef8ff';
        lines.forEach((s, i) => g.fillText(s, 7, VIEW_H - 28 + i * 10));
      }
    }
  }

  /* ==================== 启动 ==================== */
  window.addEventListener('load', () => {
    const game = new Game();
    window.SK.game = game;
    game.showScreen('scrTitle');
  });
})();
