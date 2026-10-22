'use strict';
/* ==========================================================================
   60秒：地堡余生  —  模块 1/4
   工具 · 音效合成 · 数据表 · 程序化房屋生成
   ========================================================================== */

var Util = (function () {
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function mulberry32(a) {
    a = a >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randInt(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.min(arr.length - 1, Math.floor(rng() * arr.length))]; }
  function shuffle(rng, arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function splitInt(total, n, minEach, rng) {
    var out = [], i, left;
    for (i = 0; i < n; i++) out.push(minEach);
    left = total - n * minEach;
    while (left > 0) { out[Math.floor(rng() * n) % n]++; left--; }
    return out;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function dist(ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
  return {
    clamp: clamp, mulberry32: mulberry32, randInt: randInt, pick: pick,
    shuffle: shuffle, splitInt: splitInt, esc: esc, dist: dist
  };
})();

/* -------------------------------------------------------------------------- */
var Sfx = (function () {
  var ctx = null, master = null, muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { } }
      return ctx;
    }
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.32;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(freq, dur, type, vol, freqTo) {
    if (muted || !ensure()) return;
    try {
      var o = ctx.createOscillator(), g = ctx.createGain(), t0 = ctx.currentTime;
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, t0);
      if (freqTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.16, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.03);
    } catch (e) { }
  }

  function noise(dur, vol, cutoff) {
    if (muted || !ensure()) return;
    try {
      var len = Math.floor(ctx.sampleRate * dur);
      var buf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      var src = ctx.createBufferSource(); src.buffer = buf;
      var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff || 900;
      var g = ctx.createGain(); g.gain.value = vol || 0.2;
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      src.connect(f); f.connect(g); g.connect(master);
      src.start();
    } catch (e) { }
  }

  return {
    ensure: ensure,
    isMuted: function () { return muted; },
    setMuted: function (v) { muted = !!v; },
    siren: function () {
      for (var i = 0; i < 3; i++) {
        (function (k) {
          setTimeout(function () { tone(400 + k * 70, 0.55, 'sawtooth', 0.1, 720 + k * 70); }, k * 430);
        })(i);
      }
    },
    tick: function (urgent) { tone(urgent ? 1180 : 760, urgent ? 0.09 : 0.05, 'square', urgent ? 0.13 : 0.07); },
    pickup: function () { tone(880, 0.11, 'sine', 0.16, 1420); },
    grab: function () { noise(0.07, 0.1, 1800); },
    deny: function () { tone(180, 0.16, 'sawtooth', 0.12, 110); },
    hurt: function () { tone(150, 0.22, 'sawtooth', 0.13, 70); },
    click: function () { tone(520, 0.04, 'square', 0.05); },
    card: function () { tone(320, 0.06, 'square', 0.07, 420); },
    nuke: function () { noise(2.4, 0.4, 420); tone(70, 2.0, 'sine', 0.22, 26); },
    win: function () { tone(523, 0.16, 'triangle', 0.16); setTimeout(function () { tone(659, 0.16, 'triangle', 0.16); }, 150); setTimeout(function () { tone(784, 0.3, 'triangle', 0.16); }, 300); },
    lose: function () { tone(300, 0.3, 'sine', 0.14, 150); setTimeout(function () { tone(180, 0.6, 'sine', 0.14, 70); }, 260); }
  };
})();

/* -------------------------------------------------------------------------- */
var Data = (function () {

  var ITEMS = {
    water: { name: '饮用水', emoji: '💧', kind: 'resource', weight: 11, desc: '罐头之外的命根子' },
    food: { name: '罐头', emoji: '🥫', kind: 'resource', weight: 12, desc: '一天的饱' },
    choco: { name: '巧克力', emoji: '🍫', kind: 'resource', weight: 5, desc: '热量，也是安慰' },
    radio: { name: '收音机', emoji: '📻', kind: 'gear', weight: 5, desc: '能听见地面上的事' },
    map: { name: '地图', emoji: '🗺️', kind: 'gear', weight: 4, desc: '外出时少走冤枉路' },
    rifle: { name: '猎枪', emoji: '🔫', kind: 'gear', weight: 3, desc: '对变异蟑螂和陌生人都有效' },
    mask: { name: '防毒面具', emoji: '☢️', kind: 'gear', weight: 3, desc: '过滤辐射尘' },
    tools: { name: '工具箱', emoji: '🔧', kind: 'gear', weight: 4, desc: '修一切漏的东西' },
    flash: { name: '手电筒', emoji: '🔦', kind: 'gear', weight: 4, desc: '地堡下面很黑' },
    firstaid: { name: '急救包', emoji: '🩹', kind: 'consumable', weight: 5, desc: '止血、消炎、缝针', effect: '治好「受伤」· 最伤的人体力 +32' },
    meds: { name: '药片', emoji: '💊', kind: 'consumable', weight: 4, desc: '退烧，治咳嗽', effect: '治好「生病」· 体力 +6' },
    cards: { name: '扑克牌', emoji: '🃏', kind: 'consumable', weight: 4, desc: '打发时间，顺便维系感情', effect: '全家人体力 +7' },
    teddy: { name: '泰迪熊', emoji: '🧸', kind: 'consumable', weight: 4, desc: '蒂米抱着睡得着', effect: '蒂米体力 +16；他不在就全家 +5' },
    smokes: { name: '香烟', emoji: '🚬', kind: 'consumable', weight: 4, desc: '硬通货', effect: '最虚弱的人体力 +9' },
    soap: { name: '香皂', emoji: '🧼', kind: 'consumable', weight: 3, desc: '这时候谁还需要香皂？', effect: '全家人体力 +4' },
    fish: { name: '金鱼', emoji: '🐟', kind: 'consumable', weight: 2, desc: '一条不会抱怨的室友', effect: '全家人体力 +5' }
  };

  var FAMILY = [
    { id: 'ted', name: '泰德', role: '爸爸', emoji: '🧔', shirt: '#c96f4a', pants: '#4a5560', hair: '#3b2a20', skin: '#e8b98e' },
    { id: 'dolores', name: '多洛雷斯', role: '妈妈', emoji: '👩', shirt: '#3f7d78', pants: '#3b4450', hair: '#5b3a24', skin: '#eec2a0' },
    { id: 'mary', name: '玛丽·简', role: '女儿', emoji: '👧', shirt: '#eda833', pants: '#5a4a6b', hair: '#8a5a2b', skin: '#f2cba8' },
    { id: 'timmy', name: '蒂米', role: '儿子', emoji: '👦', shirt: '#8bb174', pants: '#44515f', hair: '#c9a05a', skin: '#f0c8a4' }
  ];

  var BROADCASTS = [
    '本台仍在播音。这说明还有人在上面。',
    '国民警卫队称，正在向本区域调配物资。请保持耐心。',
    '请不要外出。请不要外出。请不要外出。',
    '专家提醒：辐射尘会渗进通风口，请用湿布封堵。',
    '军方通告：救援队预计在两周内抵达。请预留口粮。',
    '今日气温宜人，适合待在地堡里。',
    '有报告称，本区域的变异昆虫数量正在上升。',
    '如果你能听见这段广播，说明你的收音机还有电。',
    '请为邻居留一杯水。开玩笑的。',
    '卫生部建议：每日饮水不少于一杯。一杯就够了。',
    '关于地面的谣言，请不要相信。也请不要太不相信。',
    '本台将在信号消失前持续播音。'
  ];

  var ROOM_NAMES = [['客厅', '厨房', '儿童房'], ['主卧', '走廊', '浴室']];

  return { ITEMS: ITEMS, FAMILY: FAMILY, BROADCASTS: BROADCASTS, ROOM_NAMES: ROOM_NAMES };
})();

/* 全局快捷引用（同一次脚本内已定义） */
var ITEMS = Data.ITEMS;
var FAMILY = Data.FAMILY;
var BROADCASTS = Data.BROADCASTS;

/* --------------------------------------------------------------------------
   房屋生成：3 列 × 2 行的房间网格 + 随机门位 + 随机家具 + 可达性检查
   -------------------------------------------------------------------------- */
var House = (function () {
  var COLS = 40, ROWS = 25, CELL = 24;

  var FURN = {
    sofa: { w: 3, h: 2, color: '#4f7d78', kind: 'sofa' },
    table: { w: 2, h: 2, color: '#b8895a', kind: 'table' },
    tv: { w: 2, h: 1, color: '#5c544a', kind: 'tv' },
    plant: { w: 1, h: 1, color: '#7fa05f', kind: 'plant' },
    shelf: { w: 3, h: 1, color: '#8b6d4f', kind: 'shelf' },
    chair: { w: 1, h: 1, color: '#a8764f', kind: 'chair' },
    bed: { w: 3, h: 3, color: '#c9a2a0', kind: 'bed' },
    crib: { w: 2, h: 2, color: '#d9b7a1', kind: 'bed' },
    wardrobe: { w: 2, h: 2, color: '#8b6d4f', kind: 'shelf' },
    stove: { w: 2, h: 2, color: '#cfc9bd', kind: 'stove' },
    fridge: { w: 2, h: 2, color: '#e3e9e4', kind: 'fridge' },
    counter: { w: 3, h: 1, color: '#c9c2b6', kind: 'counter' },
    tub: { w: 3, h: 2, color: '#e9eef0', kind: 'tub' },
    toilet: { w: 1, h: 2, color: '#eef2f4', kind: 'toilet' },
    desk: { w: 2, h: 2, color: '#b8895a', kind: 'desk' }
  };

  var ROOM_FURN = {
    '客厅': ['sofa', 'table', 'tv', 'plant', 'chair'],
    '厨房': ['stove', 'fridge', 'counter', 'table'],
    '儿童房': ['crib', 'bed', 'shelf', 'chair', 'plant'],
    '主卧': ['bed', 'wardrobe', 'desk', 'plant'],
    '走廊': ['shelf', 'plant', 'chair'],
    '浴室': ['tub', 'toilet', 'shelf']
  };

  var FLOOR = ['#e6cfa9', '#e3c9a1', '#e4d7bf', '#ded0b6', '#e9d8b8', '#dcd8cc'];

  function cellFree(cells, x, y) {
    return x >= 0 && y >= 0 && x < COLS && y < ROWS && !cells[y][x].b;
  }

  function generate(seed) {
    var rng = Util.mulberry32((seed >>> 0) || 12345);
    var cells = [], x, y, i, j;
    for (y = 0; y < ROWS; y++) {
      cells[y] = [];
      for (x = 0; x < COLS; x++) cells[y][x] = { b: false, room: -1, deco: null };
    }

    /* 房间尺寸（内宽 38 = w0+1+w1+1+w2，内高 23 = h0+1+h1） */
    var cw = Util.splitInt(36, 3, 11, rng);
    var chh = Util.splitInt(22, 2, 10, rng);
    var cx = [], cy = [], acc = 1;
    for (i = 0; i < 3; i++) { cx.push(acc); acc += cw[i] + 1; }
    acc = 1;
    for (i = 0; i < 2; i++) { cy.push(acc); acc += chh[i] + 1; }

    var rooms = [];
    for (j = 0; j < 2; j++) {
      for (i = 0; i < 3; i++) {
        rooms.push({
          idx: j * 3 + i, i: i, j: j,
          x0: cx[i], y0: cy[j], w: cw[i], h: chh[j],
          name: Data.ROOM_NAMES[j][i], floor: FLOOR[j * 3 + i]
        });
      }
    }
    rooms.forEach(function (r) {
      for (var yy = r.y0; yy < r.y0 + r.h; yy++)
        for (var xx = r.x0; xx < r.x0 + r.w; xx++) cells[yy][xx].room = r.idx;
    });

    /* 外墙 */
    for (x = 0; x < COLS; x++) { cells[0][x].b = true; cells[ROWS - 1][x].b = true; }
    for (y = 0; y < ROWS; y++) { cells[y][0].b = true; cells[y][COLS - 1].b = true; }

    /* 内墙（列分隔 + 行分隔） */
    for (i = 0; i < 2; i++) {
      var sx = cx[i] + cw[i];
      for (y = 1; y < ROWS - 1; y++) cells[y][sx].b = true;
    }
    var sy = cy[1] - 1;
    for (x = 1; x < COLS - 1; x++) cells[sy][x].b = true;

    /* 门洞：每对相邻房间至少有一扇 */
    var doors = [];
    for (i = 0; i < 2; i++) {
      var sx2 = cx[i] + cw[i];
      for (j = 0; j < 2; j++) {
        var dy = Util.randInt(rng, cy[j] + 1, cy[j] + chh[j] - 2);
        cells[dy][sx2].b = false; cells[dy + 1][sx2].b = false;
        doors.push({ x: sx2, y: dy }); doors.push({ x: sx2, y: dy + 1 });
      }
    }
    for (i = 0; i < 3; i++) {
      var dx = Util.randInt(rng, cx[i] + 1, cx[i] + cw[i] - 2);
      cells[sy][dx].b = false; cells[sy][dx + 1].b = false;
      doors.push({ x: dx, y: sy }); doors.push({ x: dx + 1, y: sy });
    }

    /* 门洞周边保持通畅 */
    var clear = {};
    doors.forEach(function (d) {
      for (var oy = -1; oy <= 1; oy++)
        for (var ox = -1; ox <= 1; ox++) clear[(d.x + ox) + ',' + (d.y + oy)] = 1;
    });

    /* 家具 */
    var furniture = [];
    rooms.forEach(function (r) {
      var order = Util.shuffle(rng, ROOM_FURN[r.name] || ['table']);
      var want = Util.randInt(rng, 2, 3), placed = 0, tries = 0;
      while (placed < want && tries < 60) {
        tries++;
        var kind = order[(placed + tries) % order.length];
        var def = FURN[kind];
        if (!def) continue;
        if (def.w > r.w - 2 || def.h > r.h - 2) continue;
        var px = Util.randInt(rng, r.x0 + 1, r.x0 + r.w - def.w - 1);
        var py = Util.randInt(rng, r.y0 + 1, r.y0 + r.h - def.h - 1);
        var ok = true, yy, xx;
        for (yy = py; yy < py + def.h && ok; yy++)
          for (xx = px; xx < px + def.w && ok; xx++)
            if (cells[yy][xx].b || cells[yy][xx].deco || clear[xx + ',' + yy]) ok = false;
        if (!ok) continue;
        var f = { kind: def.kind, x: px, y: py, w: def.w, h: def.h, color: def.color };
        furniture.push(f);
        for (yy = py; yy < py + def.h; yy++)
          for (xx = px; xx < px + def.w; xx++) { cells[yy][xx].b = true; cells[yy][xx].deco = f; }
        placed++;
      }
    });

    /* 出生点：随机房间里的空地 */
    var spawnRoom = rooms[Util.randInt(rng, 0, rooms.length - 1)];
    function freeInRoom(r) {
      var out = [];
      for (var yy = r.y0; yy < r.y0 + r.h; yy++)
        for (var xx = r.x0; xx < r.x0 + r.w; xx++)
          if (!cells[yy][xx].b) out.push({ x: xx, y: yy });
      return out;
    }
    var cand = freeInRoom(spawnRoom);
    if (!cand.length) {
      for (i = 0; i < rooms.length && !cand.length; i++) cand = freeInRoom(rooms[i]);
    }
    if (!cand.length) { /* 极端兜底：清空一个格子 */
      cand = [{ x: 1, y: 1 }];
      cells[1][1].b = false; cells[1][1].deco = null;
    }
    /* 优先选四周都通敞的格子，别让泰德一出生就卡在柜子角 */
    var openCand = cand.filter(function (c) {
      return !cells[c.y - 1][c.x].b && !cells[c.y + 1][c.x].b &&
        !cells[c.y][c.x - 1].b && !cells[c.y][c.x + 1].b;
    });
    if (openCand.length) cand = openCand;
    var spawn = cand[Math.floor(rng() * cand.length) % cand.length];

    /* 从出生点做 BFS，只使用可达的空地 */
    var seen = {}, queue = [[spawn.x, spawn.y]], reach = {};
    seen[spawn.x + ',' + spawn.y] = 1;
    while (queue.length) {
      var cur = queue.shift();
      reach[cur[0] + ',' + cur[1]] = 1;
      var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (i = 0; i < 4; i++) {
        var nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1], k = nx + ',' + ny;
        if (!cellFree(cells, nx, ny) || seen[k]) continue;
        seen[k] = 1; queue.push([nx, ny]);
      }
    }

    var freeReach = [];
    for (y = 1; y < ROWS - 1; y++)
      for (x = 1; x < COLS - 1; x++)
        if (!cells[y][x].b && reach[x + ',' + y]) freeReach.push({ x: x, y: y });

    var taken = {};
    taken[spawn.x + ',' + spawn.y] = 1;
    function takeCell(pool, filter) {
      var list = pool.filter(function (c) {
        var k = c.x + ',' + c.y;
        return !taken[k] && (!filter || filter(c));
      });
      if (!list.length) return null;
      var c = list[Math.floor(rng() * list.length) % list.length];
      taken[c.x + ',' + c.y] = 1;
      return { x: c.x, y: c.y };
    }

    /* 地堡入口：离出生点较远的房间 */
    function roomCenterDist(r) {
      return Util.dist(r.x0 + r.w / 2, r.y0 + r.h / 2, spawn.x, spawn.y);
    }
    var farRooms = rooms.slice().sort(function (a, b) { return roomCenterDist(b) - roomCenterDist(a); });
    var hatch = null;
    for (i = 0; i < farRooms.length && !hatch; i++) {
      if (farRooms[i].idx === spawnRoom.idx && farRooms.length > 1) continue;
      var pool = freeReach.filter(function (c) { return rooms[farRooms[i].idx] && c.x >= farRooms[i].x0 && c.x < farRooms[i].x0 + farRooms[i].w && c.y >= farRooms[i].y0 && c.y < farRooms[i].y0 + farRooms[i].h; });
      var pickCell = takeCell(pool);
      if (pickCell) hatch = { x: pickCell.x, y: pickCell.y, room: farRooms[i].name };
    }
    if (!hatch) {
      var alt = takeCell(freeReach);
      hatch = { x: alt.x, y: alt.y, room: '走廊' };
    }

    /* 家人：不同房间 */
    var famRooms = Util.shuffle(rng, rooms.filter(function (r) { return r.idx !== spawnRoom.idx; }));
    while (famRooms.length < 3) famRooms = famRooms.concat(Util.shuffle(rng, rooms));
    var family = [];
    var kids = FAMILY.filter(function (f) { return f.id !== 'ted'; });
    for (i = 0; i < kids.length; i++) {
      var room = famRooms[i % famRooms.length];
      var spots = freeReach.filter(function (c) {
        return c.x >= room.x0 && c.x < room.x0 + room.w && c.y >= room.y0 && c.y < room.y0 + room.h;
      });
      var s = takeCell(spots) || takeCell(freeReach);
      if (!s) s = { x: hatch.x, y: hatch.y };
      family.push({ id: kids[i].id, x: s.x, y: s.y, room: room.name, following: false });
    }

    /* 物资 */
    var pool = [];
    Object.keys(ITEMS).forEach(function (k) {
      for (var n = 0; n < ITEMS[k].weight; n++) pool.push(k);
    });
    var items = [];
    var count = Util.randInt(rng, 23, 27);
    var forced = ['water', 'water', 'water', 'food', 'food', 'food'];
    for (i = 0; i < count; i++) {
      var c = takeCell(freeReach, function (cc) {
        return Util.dist(cc.x, cc.y, spawn.x, spawn.y) > 2.5;
      });
      if (!c) break;
      var key = i < forced.length ? forced[i] : Util.pick(rng, pool);
      items.push({ key: key, x: c.x, y: c.y, taken: false, bob: rng() * 6.283 });
    }

    return {
      seed: seed, cols: COLS, rows: ROWS, cell: CELL,
      cells: cells, rooms: rooms, furniture: furniture, doors: doors,
      spawn: spawn, hatch: hatch, family: family, items: items,
      reach: reach, freeReach: freeReach,
      isBlocked: function (cx, cy) {
        if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return true;
        return !!cells[cy][cx].b;
      },
      hitBox: function (px, py, r) {
        var x0 = Math.floor((px - r) / CELL), x1 = Math.floor((px + r) / CELL);
        var y0 = Math.floor((py - r) / CELL), y1 = Math.floor((py + r) / CELL);
        for (var y = y0; y <= y1; y++)
          for (var x = x0; x <= x1; x++)
            if (this.isBlocked(x, y)) return true;
        return false;
      }
    };
  }

  return { generate: generate, COLS: COLS, ROWS: ROWS, CELL: CELL, FURN: FURN };
})();
