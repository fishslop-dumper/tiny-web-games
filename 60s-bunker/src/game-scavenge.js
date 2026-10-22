'use strict';
/* ==========================================================================
   60秒：地堡余生  —  模块 2/4
   第一幕：60 秒抢物资（Canvas）
   ========================================================================== */

var Scav = (function () {
  var CELL = 24, W = 960, H = 600;
  var SPEED = 134, GRAB_TIME = 0.42;
  var EMOJI_FONT = '13px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  var UI_FONT = 'bold 12px "Trebuchet MS","Microsoft YaHei",sans-serif';
  var KIND_COLOR = { resource: '#e0a13a', gear: '#3f7d78', consumable: '#c96f4a', comfort: '#8bb174', trade: '#8b6d4f', junk: '#9a938a' };

  var st = null, house = null, bg = null, canvas = null;
  var keys = {}, ptr = { down: false, x: 0, y: 0 }, onEnd = null;

  /* ---------------- 启动 ---------------- */
  function start(seed, cb) {
    house = House.generate(seed);
    onEnd = cb;
    keys = {}; ptr.down = false;
    var sp = house.spawn;
    var px = (sp.x + 0.5) * CELL, py = (sp.y + 0.5) * CELL;

    house.family.forEach(function (f) {
      f.px = (f.x + 0.5) * CELL;
      f.py = (f.y + 0.5) * CELL;
      f.dir = 1; f.walk = 0;
    });

    st = {
      seed: seed, t: 60, over: false, paused: false, clock: 0,
      px: px, py: py, dir: 1, walk: 0, moving: false,
      trail: [{ x: px, y: py, t: 0 }],
      following: [], grabbed: [],
      grabP: 0, grabTarget: null,
      nearItem: null, nearFam: null, nearHatch: false,
      actionDown: false, actionPress: false, enterPress: false,
      lastSec: 60, msg: '', msgT: 0
    };
    buildBg();
    Sfx.siren();
  }

  function state() { return st; }
  function houseRef() { return house; }
  function isPaused() { return !!(st && st.paused); }
  function togglePause() {
    if (!st || st.over) return;
    st.paused = !st.paused;
    Sfx.click();
    return st.paused;
  }

  /* ---------------- 更新 ---------------- */
  function update(dt) {
    if (!st || st.over || st.paused) return;
    st.clock += dt;
    st.msgT = Math.max(0, st.msgT - dt);

    st.t = Math.max(0, st.t - dt);
    var sec = Math.ceil(st.t);
    if (sec !== st.lastSec) {
      st.lastSec = sec;
      if (sec <= 10 && sec > 0) Sfx.tick(true);
    }

    move(dt);
    followers(dt);
    interact(dt);

    if (st.t <= 0) finish(st.nearHatch);
  }

  function move(dt) {
    var ix = 0, iy = 0;
    if (keys['a'] || keys['arrowleft']) ix -= 1;
    if (keys['d'] || keys['arrowright']) ix += 1;
    if (keys['w'] || keys['arrowup']) iy -= 1;
    if (keys['s'] || keys['arrowdown']) iy += 1;

    if (ix || iy) {
      ptr.down = false;
      var len = Math.sqrt(ix * ix + iy * iy) || 1;
      ix /= len; iy /= len;
    } else if (ptr.down) {
      var dx = ptr.x - st.px, dy = ptr.y - st.py, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 5) { ix = dx / d; iy = dy / d; } else ptr.down = false;
    }

    st.moving = !!(ix || iy);
    if (!st.moving) { st.walk *= 0.9; return; }

    var R = 8;
    var nx = st.px + ix * SPEED * dt;
    if (!house.hitBox(nx, st.py, R)) st.px = nx;
    var ny = st.py + iy * SPEED * dt;
    if (!house.hitBox(st.px, ny, R)) st.py = ny;

    st.px = Util.clamp(st.px, CELL * 0.6, W - CELL * 0.6);
    st.py = Util.clamp(st.py, CELL * 0.6, H - CELL * 0.6);
    if (Math.abs(ix) > 0.15) st.dir = ix > 0 ? 1 : -1;
    st.walk += dt * 11;

    var last = st.trail[st.trail.length - 1];
    if (!last || Util.dist(last.x, last.y, st.px, st.py) > 1.5) {
      st.trail.push({ x: st.px, y: st.py, t: st.clock });
    }
    while (st.trail.length > 90) st.trail.shift();
  }

  function sampleTrail(time) {
    var tr = st.trail;
    if (!tr.length) return { x: st.px, y: st.py };
    if (time <= tr[0].t) return { x: tr[0].x, y: tr[0].y };
    for (var i = tr.length - 1; i >= 0; i--) {
      if (tr[i].t <= time) {
        if (i === tr.length - 1) return { x: tr[i].x, y: tr[i].y };
        var a = tr[i], b = tr[i + 1];
        var span = (b.t - a.t) || 0.016, k = (time - a.t) / span;
        return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
      }
    }
    return { x: tr[0].x, y: tr[0].y };
  }

  function followers(dt) {
    house.family.forEach(function (f, i) {
      if (!f.following) return;
      var tgt = sampleTrail(st.clock - (0.20 + 0.14 * i));
      var dx = tgt.x - f.px, dy = tgt.y - f.py, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.5) {
        var sp = Math.min(d, 260 * dt);
        f.px += (dx / d) * sp; f.py += (dy / d) * sp;
        f.walk += sp * 0.12;
        if (Math.abs(dx) > 0.4) f.dir = dx > 0 ? 1 : -1;
      }
    });
  }

  function interact(dt) {
    var press = st.actionPress; st.actionPress = false;
    var enter = st.enterPress; st.enterPress = false;

    var nearItem = null, bestI = 1e9;
    house.items.forEach(function (it) {
      if (it.taken) return;
      var d = Util.dist(st.px, st.py, (it.x + 0.5) * CELL, (it.y + 0.5) * CELL);
      if (d < 27 && d < bestI) { bestI = d; nearItem = it; }
    });
    var nearFam = null, bestF = 1e9;
    house.family.forEach(function (f) {
      if (f.following) return;
      var d = Util.dist(st.px, st.py, f.px, f.py);
      if (d < 34 && d < bestF) { bestF = d; nearFam = f; }
    });
    st.nearItem = nearItem;
    st.nearFam = nearFam;

    if (nearFam && (press || st.actionDown)) {
      nearFam.following = true;
      st.following.push(nearFam.id);
      st.msg = famName(nearFam.id) + ' 跟上来了！';
      st.msgT = 1.6;
      st.grabP = 0; st.grabTarget = null;
      Sfx.pickup(); Sfx.click();
    } else if (nearItem && st.actionDown) {
      if (st.grabTarget !== nearItem) { st.grabTarget = nearItem; st.grabP = 0; Sfx.grab(); }
      st.grabP += dt / GRAB_TIME;
      if (st.grabP >= 1) {
        nearItem.taken = true;
        st.grabbed.push(nearItem.key);
        st.grabP = 0; st.grabTarget = null;
        st.msg = '拿到 ' + ITEMS[nearItem.key].emoji + ' ' + ITEMS[nearItem.key].name;
        st.msgT = 1.2;
        Sfx.pickup();
      }
    } else {
      st.grabTarget = null;
      st.grabP = Math.max(0, st.grabP - dt * 4);
    }

    var hd = Util.dist(st.px, st.py, (house.hatch.x + 0.5) * CELL, (house.hatch.y + 0.5) * CELL);
    st.nearHatch = hd < 30;
    if (st.nearHatch && (enter || keys['e'])) finish(true);
  }

  function famName(id) {
    for (var i = 0; i < FAMILY.length; i++) if (FAMILY[i].id === id) return FAMILY[i].name;
    return '家人';
  }
  function famDef(id) {
    for (var i = 0; i < FAMILY.length; i++) if (FAMILY[i].id === id) return FAMILY[i];
    return FAMILY[0];
  }

  function finish(success) {
    if (!st || st.over) return;
    st.over = true;
    st.success = success;
    Sfx.nuke();
    var res = {
      success: success, seed: st.seed, tLeft: st.t,
      grabbed: st.grabbed.slice(), family: st.following.slice(),
      total: house.items.length
    };
    if (onEnd) onEnd(res);
  }

  /* ---------------- 静态房屋预渲染 ---------------- */
  function buildBg() {
    if (typeof document === 'undefined' || !document.createElement) return;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext && c.getContext('2d');
    if (!g) return;
    var x, y;
    g.fillStyle = '#171310';
    g.fillRect(0, 0, W, H);

    /* 地板 */
    for (y = 0; y < house.rows; y++) {
      for (x = 0; x < house.cols; x++) {
        var c2 = house.cells[y][x];
        if (c2.b && !c2.deco) continue;
        var room = house.rooms[c2.room];
        g.fillStyle = (c2.room >= 0 && room) ? room.floor : '#d9c9a8';
        g.fillRect(x * CELL, y * CELL, CELL, CELL);
        if ((x + y) % 2 === 0) {
          g.fillStyle = 'rgba(255,255,255,0.05)';
          g.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
      }
    }
    /* 门洞门槛 */
    g.fillStyle = 'rgba(140,105,70,0.35)';
    house.doors.forEach(function (d) { g.fillRect(d.x * CELL, d.y * CELL, CELL, CELL); });

    /* 墙体 */
    function wallish(xx, yy) {
      if (xx < 0 || yy < 0 || xx >= house.cols || yy >= house.rows) return true;
      var cc = house.cells[yy][xx];
      return cc.b && !cc.deco;
    }
    for (y = 0; y < house.rows; y++) {
      for (x = 0; x < house.cols; x++) {
        if (!wallish(x, y)) continue;
        var X = x * CELL, Y = y * CELL;
        g.fillStyle = '#2b2219';
        g.fillRect(X, Y, CELL, CELL);
        g.fillStyle = '#4a3a2c';
        if (!wallish(x, y - 1)) g.fillRect(X, Y, CELL, 4);
        if (!wallish(x, y + 1)) g.fillRect(X, Y + CELL - 3, CELL, 3);
        if (!wallish(x - 1, y)) g.fillRect(X, Y, 3, CELL);
        if (!wallish(x + 1, y)) g.fillRect(X + CELL - 3, Y, 3, CELL);
      }
    }

    /* 房间名 */
    g.textAlign = 'left'; g.textBaseline = 'top';
    g.font = 'bold 11px "Trebuchet MS","Microsoft YaHei",sans-serif';
    house.rooms.forEach(function (r) {
      g.fillStyle = 'rgba(70,50,32,0.30)';
      g.fillText(r.name, r.x0 * CELL + 5, r.y0 * CELL + 4);
    });

    /* 家具 */
    house.furniture.forEach(function (f) { drawFurn(g, f); });

    bg = c;
  }

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
    g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
    g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y);
    g.closePath();
  }

  function drawFurn(g, f) {
    var x = f.x * CELL + 1, y = f.y * CELL + 1, w = f.w * CELL - 2, h = f.h * CELL - 2;
    g.fillStyle = 'rgba(0,0,0,0.20)';
    roundRect(g, x + 2, y + 3, w, h, 4); g.fill();
    g.fillStyle = f.color;
    roundRect(g, x, y, w, h, 4); g.fill();
    g.strokeStyle = 'rgba(45,32,22,0.55)'; g.lineWidth = 1.5;
    roundRect(g, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 4); g.stroke();

    var dark = 'rgba(45,32,22,0.35)', light = 'rgba(255,255,255,0.35)';
    if (f.kind === 'sofa') {
      g.fillStyle = dark; roundRect(g, x + 3, y + 3, w - 6, h * 0.34, 3); g.fill();
      g.strokeStyle = dark; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x + w / 2, y + h * 0.36); g.lineTo(x + w / 2, y + h - 3); g.stroke();
    } else if (f.kind === 'table') {
      g.fillStyle = 'rgba(255,255,255,0.25)'; roundRect(g, x + 6, y + 6, w - 12, h - 12, 3); g.fill();
    } else if (f.kind === 'tv') {
      g.fillStyle = '#2e2a25'; roundRect(g, x + 4, y + 4, w - 8, h - 12, 3); g.fill();
      g.fillStyle = light; g.fillRect(x + 6, y + 6, 4, 3);
      g.strokeStyle = dark; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 6, y + h - 6); g.lineTo(x + 9, y + h); g.stroke();
    } else if (f.kind === 'plant') {
      g.fillStyle = '#7a5a3a'; g.fillRect(x + w / 2 - 4, y + h - 9, 8, 8);
      g.fillStyle = f.color;
      for (var i = 0; i < 3; i++) {
        g.beginPath(); g.arc(x + w / 2 + (i - 1) * 5, y + h / 2 - 3 - (i === 1 ? 4 : 0), 4, 0, 6.283); g.fill();
      }
    } else if (f.kind === 'shelf') {
      g.strokeStyle = dark; g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(x + 4, y + h / 2); g.lineTo(x + w - 4, y + h / 2);
      g.moveTo(x + 4, y + h - 5); g.lineTo(x + w - 4, y + h - 5);
      g.stroke();
    } else if (f.kind === 'chair') {
      g.fillStyle = dark; g.fillRect(x + 3, y + 2, w - 6, 4);
    } else if (f.kind === 'bed') {
      g.fillStyle = 'rgba(255,255,255,0.6)'; roundRect(g, x + 4, y + 4, w - 8, h * 0.26, 3); g.fill();
      g.fillStyle = 'rgba(120,150,170,0.45)';
      roundRect(g, x + 3, y + h * 0.32, w - 6, h * 0.62, 3); g.fill();
    } else if (f.kind === 'stove') {
      g.fillStyle = '#4a443c';
      for (var b = 0; b < 4; b++) {
        g.beginPath();
        g.arc(x + 9 + (b % 2) * (w - 18), y + 9 + Math.floor(b / 2) * (h - 18), 4, 0, 6.283);
        g.fill();
      }
    } else if (f.kind === 'fridge') {
      g.strokeStyle = dark; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + 3, y + h * 0.38); g.lineTo(x + w - 3, y + h * 0.38); g.stroke();
      g.fillStyle = dark; g.fillRect(x + w - 8, y + 8, 2, 8);
      g.fillRect(x + w - 8, y + h * 0.5, 2, 8);
    } else if (f.kind === 'counter') {
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(x + 2, y + 2, w - 4, 4);
      g.fillStyle = dark; g.fillRect(x + 4, y + h - 6, w - 8, 2);
    } else if (f.kind === 'tub') {
      g.fillStyle = 'rgba(160,200,210,0.55)';
      g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2 - 6, h / 2 - 5, 0, 0, 6.283); g.fill();
    } else if (f.kind === 'toilet') {
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + 2, y + 2, w - 4, h * 0.34);
      g.fillStyle = 'rgba(180,210,215,0.8)';
      g.beginPath(); g.ellipse(x + w / 2, y + h * 0.66, w / 2 - 4, h * 0.28, 0, 0, 6.283); g.fill();
    } else if (f.kind === 'desk') {
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 3, y + 3, w - 6, 3);
      g.strokeStyle = dark; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x + 4, y + h - 6); g.lineTo(x + w - 4, y + h - 6); g.stroke();
    }
  }

  /* ---------------- 每帧渲染 ---------------- */
  function render(g) {
    if (!st || !g) return;
    g.clearRect(0, 0, W, H);
    if (bg) g.drawImage(bg, 0, 0);
    drawHatch(g);
    drawItems(g);
    drawPeople(g);
    drawHints(g);
    if (st.t < 10.5) drawAlarm(g);
    if (st.msgT > 0) drawToast(g);
  }

  function drawHatch(g) {
    var hx = (house.hatch.x + 0.5) * CELL, hy = (house.hatch.y + 0.5) * CELL;
    var s = 30;
    g.save();
    g.translate(hx, hy);
    g.fillStyle = '#171310';
    g.fillRect(-s / 2, -s / 2, s, s);
    g.strokeStyle = '#3a2f24'; g.lineWidth = 2;
    g.strokeRect(-s / 2, -s / 2, s, s);
    g.strokeStyle = '#6b5b4c'; g.lineWidth = 1.6;
    for (var i = -8; i <= 8; i += 5) {
      g.beginPath(); g.moveTo(-6, i); g.lineTo(6, i); g.stroke();
    }
    var pulse = 0.5 + 0.5 * Math.sin(st.clock * 4);
    g.strokeStyle = 'rgba(237,168,51,' + (0.28 + 0.5 * pulse) + ')';
    g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, s * 0.6 + pulse * 5, 0, 6.283); g.stroke();
    g.restore();
    g.font = UI_FONT; g.textAlign = 'center'; g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(20,14,10,0.55)';
    g.fillText('避 难 所', hx + 1, hy - s / 2 - 3);
    g.fillStyle = '#eda833';
    g.fillText('避 难 所', hx, hy - s / 2 - 4);
  }

  function drawItems(g) {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    house.items.forEach(function (it) {
      if (it.taken) return;
      var cx = (it.x + 0.5) * CELL, cy = (it.y + 0.5) * CELL;
      var bob = Math.sin(st.clock * 2.6 + it.bob) * 1.4;
      var d = ITEMS[it.key];
      var col = KIND_COLOR[d.kind] || '#8b6d4f';
      g.fillStyle = 'rgba(0,0,0,0.16)';
      roundRect(g, cx - 9.5, cy - 9.5 + bob + 2, 19, 19, 4); g.fill();
      g.fillStyle = '#fcf6e8';
      roundRect(g, cx - 9.5, cy - 9.5 + bob, 19, 19, 4); g.fill();
      g.strokeStyle = col; g.lineWidth = 2;
      roundRect(g, cx - 9.5, cy - 9.5 + bob, 19, 19, 4); g.stroke();
      g.font = '13px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
      g.fillStyle = '#241c16';
      g.fillText(d.emoji, cx, cy + bob + 1);
      if (it === st.grabTarget && st.grabP > 0.02) ring(g, cx, cy, 16, st.grabP);
      else if (it === st.nearItem) {
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.arc(cx, cy + bob, 14, 0, 6.283); g.stroke();
      }
    });
  }

  function ring(g, cx, cy, r, p) {
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(cx, cy, r, 0, 6.283); g.stroke();
    g.strokeStyle = '#eda833'; g.lineWidth = 3.5;
    g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + 6.283 * p); g.stroke();
  }

  function drawPeople(g) {
    house.family.forEach(function (f, i) {
      if (!f.following) return;
      drawPerson(g, f.px, f.py, famDef(f.id), 0.86, f.walk, f.dir);
    });
    house.family.forEach(function (f, i) {
      if (f.following) return;
      drawPerson(g, f.px, f.py, famDef(f.id), 0.86, 0, f.dir || 1);
      var bob = Math.sin(st.clock * 3 + i) * 2;
      g.fillStyle = f === st.nearFam ? '#eda833' : 'rgba(244,233,210,0.92)';
      roundRect(g, f.px - 6, f.py - 30 + bob, 12, 13, 3); g.fill();
      g.fillStyle = '#241c16';
      g.font = 'bold 10px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('!', f.px, f.py - 23 + bob);
    });
    drawPerson(g, st.px, st.py, famDef('ted'), 1, st.walk, st.dir);
    /* 玩家标记：头顶的小三角 */
    var bobY = Math.sin(st.clock * 4) * 1.6;
    g.fillStyle = 'rgba(20,14,10,0.30)';
    g.beginPath();
    g.moveTo(st.px + 1, st.py - 25 + bobY);
    g.lineTo(st.px - 4, st.py - 33 + bobY);
    g.lineTo(st.px + 6, st.py - 33 + bobY);
    g.closePath(); g.fill();
    g.fillStyle = '#d8503c';
    g.beginPath();
    g.moveTo(st.px, st.py - 26 + bobY);
    g.lineTo(st.px - 5, st.py - 34 + bobY);
    g.lineTo(st.px + 5, st.py - 34 + bobY);
    g.closePath(); g.fill();
    /* 背包里的东西 */
    if (st.grabbed.length) {
      var bx = st.px - 12 * st.dir, by = st.py - 2;
      g.fillStyle = '#6b4f33';
      roundRect(g, bx - 12, by - 6, 9, 11, 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#f4e9d2';
      g.font = 'bold 7px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(st.grabbed.length > 9 ? 9 : st.grabbed.length), bx - 7.5, by);
    }
  }

  function drawPerson(g, px, py, def, s, walk, dir) {
    g.fillStyle = 'rgba(0,0,0,0.24)';
    g.beginPath(); g.ellipse(px, py + 9.5 * s, 9 * s, 4 * s, 0, 0, 6.283); g.fill();

    var swing = Math.sin(walk || 0) * 3.2 * s;
    g.strokeStyle = def.pants; g.lineWidth = 3.2 * s; g.lineCap = 'round';
    g.beginPath(); g.moveTo(px - 2 * s, py + 3 * s); g.lineTo(px - 2 * s - swing, py + 9.5 * s); g.stroke();
    g.beginPath(); g.moveTo(px + 2 * s, py + 3 * s); g.lineTo(px + 2 * s + swing, py + 9.5 * s); g.stroke();

    g.fillStyle = def.shirt;
    roundRect(g, px - 6 * s, py - 7 * s, 12 * s, 12 * s, 3.2 * s); g.fill();
    g.strokeStyle = 'rgba(30,20,14,0.35)'; g.lineWidth = 1; g.stroke();

    g.fillStyle = def.skin;
    g.beginPath(); g.arc(px, py - 10.5 * s, 5.6 * s, 0, 6.283); g.fill();
    g.fillStyle = def.hair;
    g.beginPath(); g.arc(px, py - 11.6 * s, 5.6 * s, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    g.fillStyle = '#2a2018';
    g.beginPath(); g.arc(px + 2.1 * s * dir, py - 10.4 * s, 1.15 * s, 0, 6.283); g.fill();
  }

  function drawHints(g) {
    var text = null;
    if (st.nearHatch) text = '按  E  钻进避难所';
    else if (st.nearFam) text = '按 空格 让 ' + famName(st.nearFam.id) + ' 跟上你';
    else if (st.nearItem) text = '按住 空格 抓取 ' + ITEMS[st.nearItem.key].name;
    if (!text) return;
    g.font = UI_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var w = g.measureText(text).width + 30;
    var x = W / 2 - w / 2, y = H - 46;
    g.fillStyle = 'rgba(20,14,10,0.86)';
    roundRect(g, x, y, w, 30, 4); g.fill();
    g.strokeStyle = 'rgba(237,168,51,0.85)'; g.lineWidth = 2;
    roundRect(g, x, y, w, 30, 4); g.stroke();
    g.fillStyle = '#f4e9d2';
    g.fillText(text, W / 2, y + 16);
  }

  function drawToast(g) {
    if (!st.msg) return;
    var a = Math.min(1, st.msgT * 2);
    g.globalAlpha = a;
    g.font = 'bold 15px "Trebuchet MS","Microsoft YaHei",sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    var w = g.measureText(st.msg).width + 34;
    g.fillStyle = 'rgba(237,168,51,0.94)';
    roundRect(g, W / 2 - w / 2, 16, w, 32, 4); g.fill();
    g.fillStyle = '#241c16';
    g.fillText(st.msg, W / 2, 33);
    g.globalAlpha = 1;
  }

  function drawAlarm(g) {
    var k = Util.clamp((10.5 - st.t) / 10.5, 0, 1);
    var pulse = 0.5 + 0.5 * Math.sin(st.clock * 9);
    var a = 0.10 + 0.18 * k * pulse;
    var grad = g.createRadialGradient(W / 2, H / 2, H * 0.22, W / 2, H / 2, H * 0.78);
    grad.addColorStop(0, 'rgba(180,30,20,0)');
    grad.addColorStop(1, 'rgba(180,30,20,' + a.toFixed(3) + ')');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
  }

  /* ---------------- 输入 ---------------- */
  function onKey(e, down) {
    var k = (e.key || '').toLowerCase();
    if (e.code === 'Space') k = ' ';
    if (k === 'esc') return;
    var watch = [' ', 'e', 'w', 'a', 's', 'd', 'p', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    if (watch.indexOf(k) >= 0) e.preventDefault();
    if (!st) return;
    keys[k] = down;
    if (down) {
      if (k === ' ') { st.actionDown = true; if (!st._spaceHeld) { st.actionPress = true; st._spaceHeld = true; } }
      if (k === 'e') st.enterPress = true;
    } else {
      if (k === ' ') { st.actionDown = false; st._spaceHeld = false; }
    }
  }

  function attach(canvasEl) {
    canvas = canvasEl;
    if (canvas) {
      canvas.addEventListener('mousedown', function (e) {
        if (!st || st.over) return;
        var r = canvas.getBoundingClientRect();
        ptr.down = true;
        ptr.x = (e.clientX - r.left) * (W / (r.width || W));
        ptr.y = (e.clientY - r.top) * (H / (r.height || H));
      });
      canvas.addEventListener('mousemove', function (e) {
        if (!ptr.down) return;
        var r = canvas.getBoundingClientRect();
        ptr.x = (e.clientX - r.left) * (W / (r.width || W));
        ptr.y = (e.clientY - r.top) * (H / (r.height || H));
      });
      if (typeof window !== 'undefined') {
        window.addEventListener('mouseup', function () { ptr.down = false; });
      }
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', function (e) { onKey(e, true); });
      window.addEventListener('keyup', function (e) { onKey(e, false); });
      window.addEventListener('blur', function () { keys = {}; ptr.down = false; if (st) { st.actionDown = false; st._spaceHeld = false; } });
    }
  }

  return {
    start: start, update: update, render: render, attach: attach,
    state: state, houseRef: houseRef, togglePause: togglePause, isPaused: isPaused,
    W: W, H: H, CELL: CELL
  };
})();
