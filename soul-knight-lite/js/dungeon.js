/* ============================================================
   dungeon.js —— 楼层 / 房间 / 门 / 障碍 / 刷怪计划
   ============================================================ */
(function () {
  'use strict';
  const SK = window.SK;
  const RW = SK.ROOM_W, RH = SK.ROOM_H, T = SK.T;

  const DIRS = [
    { k: 'n', dx: 0, dy: -1 },
    { k: 'e', dx: 1, dy: 0 },
    { k: 's', dx: 0, dy: 1 },
    { k: 'w', dx: -1, dy: 0 }
  ];
  SK.DIRS = DIRS;

  SK.roomRect = function (gx, gy) {
    return { x: gx * SK.ROOM_PW, y: gy * SK.ROOM_PH, w: SK.ROOM_PW, h: SK.ROOM_PH };
  };

  /* ======================= 障碍布局 ======================= */
  const LAYOUTS = [
    // 0 空场地
    function () { return []; },
    // 1 四根柱子
    function () { return [[5, 4], [6, 4], [5, 5], [6, 5]]; },
    // 2 L 型墙
    function () { return [[8, 3], [8, 4], [8, 5], [9, 5], [10, 5]]; },
    // 3 竖条
    function () { return [[8, 3], [8, 4], [8, 5], [8, 6], [8, 7]]; },
    // 4 横条
    function () { return [[4, 5], [5, 5], [6, 5], [7, 5], [8, 5], [9, 5]]; },
    // 5 双岛
    function () { return [[10, 4], [11, 4], [10, 5], [11, 5], [4, 3], [5, 3]]; },
    // 6 对角碎块
    function () { return [[6, 3], [7, 3], [9, 6], [10, 6], [4, 6], [4, 7]]; },
    // 7 内侧方框（中间留空）
    function () {
      const out = [];
      for (let i = 0; i < 5; i++) { out.push([9, 3 + i]); out.push([9, 3]); }
      out.push([10, 3], [11, 3], [11, 4], [11, 5], [11, 6], [10, 6]);
      return out;
    },
    // 8 长墙 + 缺口
    function () { return [[7, 4], [7, 5], [7, 6], [8, 6], [9, 6], [4, 4], [4, 5]]; },
    // 9 三角
    function () { return [[10, 3], [11, 4], [10, 5], [9, 4], [5, 4], [4, 5]]; },
    // 10 稀疏点阵
    function () { return [[5, 3], [7, 5], [9, 3], [5, 7], [9, 7], [11, 5]]; }
  ];

  function buildLayout(rng, room) {
    const patIndex = room.type === 'boss' ? 0 : rng.int(0, LAYOUTS.length - 1);
    const base = LAYOUTS[patIndex]();
    const out = [];
    const seen = new Set();
    const push = (x, y) => {
      if (x < 2 || y < 2 || x > RW - 3 || y > RH - 3) return;
      const k = x + ',' + y;
      if (seen.has(k)) return;
      seen.add(k);
      out.push([x, y]);
    };
    for (const [x, y] of base) {
      push(x, y);
      push(RW - 1 - x, y);
      push(x, RH - 1 - y);
      push(RW - 1 - x, RH - 1 - y);
    }
    return out;
  }

  /* ======================= 生成刷怪计划 ======================= */
  const POOLS = [
    ['slime', 'slime', 'bat', 'goblin'],
    ['slime', 'bat', 'goblin', 'archer', 'bomber', 'goblin'],
    ['bat', 'goblin', 'archer', 'bomber', 'knight', 'slime']
  ];

  function spawnSpots(rng, room) {
    const cx = SK.ROOM_PW / 2, cy = SK.ROOM_PH / 2;
    const spots = [];
    const mode = rng.int(0, 2);
    const tryPush = (x, y) => {
      const tx = Math.round(x / SK.TILE), ty = Math.round(y / SK.TILE);
      if (tx < 3 || ty < 3 || tx > RW - 4 || ty > RH - 4) return;
      // 别贴着门
      for (const d of DIRS) {
        if (!room.doors[d.k]) continue;
        const dr = room.doors[d.k].rect;
        const ddx = Math.abs(x + room.rect.x - (dr.x + dr.w / 2));
        const ddy = Math.abs(y + room.rect.y - (dr.y + dr.h / 2));
        if (ddx < 52 && ddy < 52) return;
      }
      for (const s of spots) if (SK.dist(s.x, s.y, x, y) < 34) return;
      spots.push({ x: room.rect.x + x, y: room.rect.y + y });
    };

    if (mode === 0) {
      const n = 6;
      const off = rng.range(0, SK.TAU);
      for (let i = 0; i < n; i++) {
        const a = off + (i / n) * SK.TAU;
        tryPush(cx + Math.cos(a) * 118, cy + Math.sin(a) * 72);
      }
    } else if (mode === 1) {
      for (let i = 0; i < 3; i++) {
        tryPush(cx - 130 + rng.range(-16, 16), cy - 60 + i * 56);
        tryPush(cx + 130 + rng.range(-16, 16), cy - 60 + i * 56);
      }
    } else {
      const pts = [[-120, -66], [120, -66], [-120, 66], [120, 66], [0, -78], [0, 78], [-150, 0], [150, 0]];
      for (const [ox, oy] of pts) tryPush(cx + ox, cy + oy);
    }
    return spots;
  }

  SK.enemyPool = function (floorNum) {
    return POOLS[Math.min(POOLS.length - 1, Math.max(0, floorNum - 1))];
  };

  /* ======================= 生成一层 ======================= */
  SK.genFloor = function (num, seed) {
    const rng = new SK.RNG(seed || (Date.now() ^ (num * 7919)));
    const GW = 5, GH = 4;
    const tw = GW * RW, th = GH * RH;
    const grid = new Uint8Array(tw * th);
    const floor = {
      num: num,
      gw: GW, gh: GH, tw: tw, th: th,
      grid: grid,
      rooms: [],
      doors: [],
      doorMap: new Int16Array(tw * th).fill(-1),
      rng: rng,
      biome: SK.Art.biome(num),
      clearedRooms: 0,
      totalRooms: 0
    };

    /* ---- 1. 房间拓扑（随机生长一棵连通树）---- */
    const cells = new Map();
    const key = (x, y) => x + ',' + y;
    const startRoom = { gx: 2, gy: 1, type: 'start' };
    cells.set(key(2, 1), startRoom);
    const order = [startRoom];
    const target = 10 + Math.min(3, num);
    let guard = 0;
    while (order.length < target && guard++ < 600) {
      const base = order[rng.int(0, order.length - 1)];
      const dirs = rng.shuffle(DIRS.slice());
      for (const d of dirs) {
        const nx = base.gx + d.dx, ny = base.gy + d.dy;
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        if (cells.has(key(nx, ny))) continue;
        const r = { gx: nx, gy: ny, type: 'normal' };
        cells.set(key(nx, ny), r);
        order.push(r);
        break;
      }
    }

    const all = Array.from(cells.values());
    for (const r of all) {
      r.rect = SK.roomRect(r.gx, r.gy);
      r.doors = { n: null, e: null, s: null, w: null };
      r.enemies = [];
      r.pickups = [];
      r.visited = false;
      r.entered = false;
      r.cleared = false;
      r.locked = false;
      r.spawned = false;
      r.ground = null;
      r.plan = [];
      r.adj = [];
    }
    for (const r of all) {
      for (const d of DIRS) {
        const nb = cells.get(key(r.gx + d.dx, r.gy + d.dy));
        if (nb) r.adj.push({ room: nb, dir: d.k });
      }
    }

    /* ---- 2. BFS 找最远房间做 BOSS 房 ---- */
    const distMap = new Map();
    distMap.set(key(2, 1), 0);
    const queue = [startRoom];
    let far = startRoom, farD = 0;
    while (queue.length) {
      const cur = queue.shift();
      const cd = distMap.get(key(cur.gx, cur.gy));
      if (cd > farD && cur !== startRoom) { farD = cd; far = cur; }
      for (const nb of cur.adj) {
        const k = key(nb.room.gx, nb.room.gy);
        if (distMap.has(k)) continue;
        distMap.set(k, cd + 1);
        queue.push(nb.room);
      }
    }
    far.type = 'boss';
    startRoom.type = 'start';

    /* ---- 3. 特殊房间：宝箱 / 商店 / 祭坛 / 精英，尽量每层都有 ---- */
    const deadEnds = all.filter((r) => r.adj.length === 1 && r !== startRoom && r !== far);
    rng.shuffle(deadEnds);
    const specials = ['treasure', 'shop', 'shrine', 'elite', 'event'];
    let si = 0;
    for (const r of deadEnds) {
      if (si >= specials.length) break;
      r.type = specials[si++];
    }
    // 死胡同不够就从普通房间里补
    for (; si < specials.length; si++) {
      const cand = all.filter((r) => r.type === 'normal');
      if (!cand.length) break;
      rng.pick(cand).type = specials[si];
    }

    /* ---- 4. 铺地砖与墙 ---- */
    for (const r of all) {
      for (let ty = 0; ty < RH; ty++) {
        for (let tx = 0; tx < RW; tx++) {
          const wx = r.gx * RW + tx, wy = r.gy * RH + ty;
          const border = tx === 0 || ty === 0 || tx === RW - 1 || ty === RH - 1;
          grid[wy * tw + wx] = border ? T.WALL : T.FLOOR;
        }
      }
    }

    /* ---- 5. 门 ---- */
    const madeDoors = new Set();
    for (const r of all) {
      for (const d of DIRS) {
        const nb = r.adj.find((a) => a.dir === d.k);
        if (!nb) continue;
        const pairKey = [r.gx, r.gy, nb.room.gx, nb.room.gy].join(',');
        const pairKey2 = [nb.room.gx, nb.room.gy, r.gx, r.gy].join(',');
        if (madeDoors.has(pairKey) || madeDoors.has(pairKey2)) continue;
        madeDoors.add(pairKey);

        const door = { a: r, b: nb.room, dir: d.k, tiles: [], locked: false, rect: null };
        let tiles = [];
        if (d.k === 'e') {
          tiles = [
            [r.gx * RW + RW - 1, r.gy * RH + 9], [r.gx * RW + RW - 1, r.gy * RH + 10],
            [nb.room.gx * RW, nb.room.gy * RH + 9], [nb.room.gx * RW, nb.room.gy * RH + 10]
          ];
          door.rect = { x: (r.gx * RW + RW - 1) * SK.TILE, y: (r.gy * RH + 9) * SK.TILE, w: SK.TILE * 2, h: SK.TILE * 2 };
        } else if (d.k === 'w') {
          tiles = [
            [r.gx * RW, r.gy * RH + 9], [r.gx * RW, r.gy * RH + 10],
            [nb.room.gx * RW + RW - 1, nb.room.gy * RH + 9], [nb.room.gx * RW + RW - 1, nb.room.gy * RH + 10]
          ];
          door.rect = { x: (r.gx * RW) * SK.TILE, y: (r.gy * RH + 9) * SK.TILE, w: SK.TILE * 2, h: SK.TILE * 2 };
        } else if (d.k === 's') {
          tiles = [
            [r.gx * RW + 15, r.gy * RH + RH - 1], [r.gx * RW + 16, r.gy * RH + RH - 1],
            [nb.room.gx * RW + 15, nb.room.gy * RH], [nb.room.gx * RW + 16, nb.room.gy * RH]
          ];
          door.rect = { x: (r.gx * RW + 15) * SK.TILE, y: (r.gy * RH + RH - 1) * SK.TILE, w: SK.TILE * 2, h: SK.TILE * 2 };
        } else {
          tiles = [
            [r.gx * RW + 15, r.gy * RH], [r.gx * RW + 16, r.gy * RH],
            [nb.room.gx * RW + 15, nb.room.gy * RH + RH - 1], [nb.room.gx * RW + 16, nb.room.gy * RH + RH - 1]
          ];
          door.rect = { x: (r.gx * RW + 15) * SK.TILE, y: (r.gy * RH) * SK.TILE, w: SK.TILE * 2, h: SK.TILE * 2 };
        }
        for (const [tx, ty] of tiles) {
          const idx = ty * tw + tx;
          grid[idx] = T.DOOR;
          floor.doorMap[idx] = floor.doors.length;
          door.tiles.push(idx);
        }
        floor.doors.push(door);
        // 双方房间都记录
        r.doors[d.k] = door;
        const opp = { n: 's', s: 'n', e: 'w', w: 'e' }[d.k];
        nb.room.doors[opp] = door;
      }
    }

    /* ---- 6. 障碍 + 刷怪计划 + 道具 ---- */
    for (const r of all) {
      const layout = buildLayout(rng, r);
      for (const [tx, ty] of layout) {
        const idx = (r.gy * RH + ty) * tw + (r.gx * RW + tx);
        if (grid[idx] === T.FLOOR) grid[idx] = T.BLOCK;
      }
      r.obstacles = layout;

      if (r.type === 'normal') {
        const spots = spawnSpots(rng, r);
        const pool = SK.enemyPool(num);
        let n = Math.min(spots.length, 3 + rng.int(0, 2) + Math.floor((num - 1) * 1.5));
        n = Math.max(2, n);
        for (let i = 0; i < n; i++) {
          r.plan.push({ type: rng.pick(pool), x: spots[i].x, y: spots[i].y });
        }
        // 普通房间也有几率放一口小箱
        if (rng.chance(0.26)) r.planChest = true;
      }
      if (r.type === 'elite') {
        // 精英房：一只精英 + 若干小怪，必掉武器
        const spots = spawnSpots(rng, r);
        if (spots.length) {
          r.plan.push({ type: 'knight', x: spots[0].x, y: spots[0].y });
          const pool = SK.enemyPool(num);
          for (let i = 1; i < Math.min(spots.length, 3 + Math.floor(num / 2)); i++) {
            r.plan.push({ type: rng.pick(pool), x: spots[i].x, y: spots[i].y });
          }
        }
      }
      if (r.type === 'start') {
        r.planChest = true;
      }
      if (r.type === 'treasure') {
        r.planChest = true;
        r.planChest2 = true;
      }
      if (r.type === 'shop') {
        r.planShop = true;
      }
      if (r.type === 'shrine') {
        r.planShrine = true;
      }
      if (r.type === 'event') {
        r.planEvent = rng.pick(['smith', 'statue', 'gambler', 'well']);
      }
      if (r.type === 'boss') {
        r.plan.push({ type: 'boss', x: r.rect.x + SK.ROOM_PW / 2, y: r.rect.y + SK.ROOM_PH / 2 + 20 });
      }
    }

    floor.rooms = all;
    floor.start = startRoom;
    floor.boss = far;
    floor.totalRooms = all.length;
    return floor;
  };
})();
