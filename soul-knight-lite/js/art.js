/* ============================================================
   art.js —— 像素精灵 + 程序化绘制（全部跑在 384x216 低分辨率画布上，
   所以用圆/矩形画出来的东西天然就是"像素风"）
   ============================================================ */
(function () {
  'use strict';
  const SK = window.SK, TAU = SK.TAU, TILE = SK.TILE;
  const Art = (SK.Art = {});

  /* ======================= 精灵工厂 ======================= */
  Art.makeSprite = function (rows, pal) {
    const w = rows[0].length, h = rows.length;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < w; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        g.fillStyle = col;
        g.fillRect(x, y, 1, 1);
      }
    }
    return c;
  };

  /* ======================= 角色精灵 ======================= */
  const BODY = [
    '....hhhh....',
    '...hhhhhh...',
    '...hffffh...',
    '...fEfEf....',
    '...ffffff...',
    '..bbbbbbbb..',
    '.bbbbbbbbbb.',
    '.bbbbbbbbbb.',
    '..bbbbbbbb..',
    '..bbbbbbbb..',
    '...bbbbbb...',
    '...bb..bb...',
    '...bb..bb...',
    '..lll..lll..'
  ];
  const BODY2 = [
    '....hhhh....',
    '...hhhhhh...',
    '...hffffh...',
    '...fEfEf....',
    '...ffffff...',
    '..bbbbbbbb..',
    '.bbbbbbbbbb.',
    '.bbbbbbbbbb.',
    '..bbbbbbbb..',
    '..bbbbbbbb..',
    '...bbbbbb...',
    '..bbb..bbb..',
    '..bb....bb..',
    '.lll....lll.'
  ];

  const spriteCache = {};
  Art.playerSprite = function (charId, pal, frame) {
    const k = charId + '#' + frame;
    if (!spriteCache[k]) {
      spriteCache[k] = Art.makeSprite(frame ? BODY2 : BODY, {
        h: pal.h, f: pal.f, E: '#241a2e', b: pal.b, l: pal.l
      });
    }
    return spriteCache[k];
  };

  /* ======================= 生物群系配色 ======================= */
  Art.BIOMES = [
    {
      key: 'moss', name: '苔洞',
      void: '#070b08',
      floor: ['#3a3f33', '#353a2f', '#3f4439', '#33382d'],
      speck: '#4b5142', speck2: '#252a20',
      cap: '#232a1c', capHi: '#7d9469', capDark: '#141a0f',
      face: '#1b2013', faceHi: '#4a5a2e', faceDark: '#0d110a',
      bCap: '#4a4436', bHi: '#b0a37c', bDark: '#221e18',
      accent: '#7be08f'
    },
    {
      key: 'lava', name: '熔岩',
      void: '#100706',
      floor: ['#41302a', '#3c2c26', '#46352e', '#382822'],
      speck: '#543a2f', speck2: '#241715',
      cap: '#2a1a16', capHi: '#a3664f', capDark: '#180d0b',
      face: '#1d100d', faceHi: '#6b3a2e', faceDark: '#0e0605',
      bCap: '#4a3a30', bHi: '#c09a5e', bDark: '#221812',
      accent: '#ff8a45'
    },
    {
      key: 'frost', name: '霜殿',
      void: '#060a12',
      floor: ['#33435c', '#2e3d55', '#384963', '#2b3a50'],
      speck: '#46608a', speck2: '#1c2738',
      cap: '#1e2736', capHi: '#7f9cc6', capDark: '#121925',
      face: '#141b28', faceHi: '#465a78', faceDark: '#0a0e15',
      bCap: '#3a4658', bHi: '#a8c0e0', bDark: '#1a2029',
      accent: '#7ad8ff'
    }
  ];
  Art.biome = function (n) { return Art.BIOMES[Math.min(Art.BIOMES.length - 1, Math.max(0, n - 1))]; };

  /* ======================= 地面预渲染 ======================= */
  // solidAt(tx,ty)/blockAt(tx,ty) 为世界图块坐标
  Art.renderGround = function (room, biome, solidAt, blockAt) {
    const W = SK.ROOM_PW, H = SK.ROOM_PH;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const bx = room.gx * SK.ROOM_W, by = room.gy * SK.ROOM_H;

    g.fillStyle = biome.void;
    g.fillRect(0, 0, W, H);

    /* ---------- 地板：2x2 图块的石板 ---------- */
    for (let ty = 0; ty < SK.ROOM_H; ty++) {
      for (let tx = 0; tx < SK.ROOM_W; tx++) {
        const wx = bx + tx, wy = by + ty;
        if (solidAt(wx, wy)) continue;
        const px = tx * TILE, py = ty * TILE;
        const sx = wx >> 1, sy = wy >> 1;
        const n = SK.hash2(sx * 3 + 117, sy * 7 + 53);
        g.fillStyle = biome.floor[(n * biome.floor.length) | 0];
        g.fillRect(px, py, TILE, TILE);

        // 石板缝（每 2 格）
        if ((wx & 1) === 0) {
          g.fillStyle = 'rgba(0,0,0,.24)';
          g.fillRect(px, py, 1, TILE);
          g.fillStyle = 'rgba(255,255,255,.045)';
          g.fillRect(px + 1, py, 1, TILE);
        }
        if ((wy & 1) === 0) {
          g.fillStyle = 'rgba(0,0,0,.24)';
          g.fillRect(px, py, TILE, 1);
          g.fillStyle = 'rgba(255,255,255,.045)';
          g.fillRect(px, py + 1, TILE, 1);
        }

        // 斑驳
        const n2 = SK.hash2(wx * 13 + 7, wy * 29 + 11);
        if (n2 > 0.74) {
          g.fillStyle = n2 > 0.93 ? biome.speck2 : biome.speck;
          const ox = 2 + ((n2 * 97) | 0) % 11;
          const oy = 2 + ((n2 * 173) | 0) % 11;
          g.fillRect(px + ox, py + oy, n2 > 0.88 ? 3 : 2, 2);
          if (n2 > 0.96) g.fillRect(px + ox - 2, py + oy + 3, 4, 1);
        }
        // 裂纹
        const n3 = SK.hash2(wx * 31 + 5, wy * 17 + 23);
        if (n3 > 0.955) {
          g.fillStyle = 'rgba(0,0,0,.26)';
          g.fillRect(px + 3, py + 5, 4, 1);
          g.fillRect(px + 6, py + 6, 1, 3);
          g.fillRect(px + 7, py + 8, 3, 1);
        }
      }
    }

    /* ---------- 地面色斑（苔藓 / 岩浆痕 / 霜迹） ---------- */
    const prng = new SK.RNG((room.gx * 7919 + room.gy * 104729 + 17) >>> 0);
    const patches = 4 + prng.int(0, 3);
    for (let i = 0; i < patches; i++) {
      const cx = prng.range(3, SK.ROOM_W - 3) * TILE;
      const cy = prng.range(3, SK.ROOM_H - 3) * TILE;
      const rad = prng.range(34, 86);
      const col = prng.chance(0.55) ? biome.accent : biome.speck2;
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, rad);
      grd.addColorStop(0, rgba(col, 0.55));
      grd.addColorStop(0.65, rgba(col, 0.22));
      grd.addColorStop(1, rgba(col, 0));
      g.globalAlpha = 0.34;
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
    // 苔藓小簇
    for (let i = 0; i < 22; i++) {
      const cx = prng.int(2, SK.ROOM_W - 3) * TILE + prng.int(0, 12);
      const cy = prng.int(2, SK.ROOM_H - 3) * TILE + prng.int(0, 12);
      if (solidAt(bx + (cx / TILE | 0), by + (cy / TILE | 0))) continue;
      g.fillStyle = rgba(biome.accent, 0.34);
      g.fillRect(cx, cy, prng.int(2, 5), prng.int(1, 2));
      if (prng.chance(0.5)) g.fillRect(cx + 1, cy - 2, 2, 2);
    }

    /* ---------- 墙脚阴影 ---------- */
    for (let ty = 0; ty < SK.ROOM_H; ty++) {
      for (let tx = 0; tx < SK.ROOM_W; tx++) {
        const wx = bx + tx, wy = by + ty;
        if (solidAt(wx, wy)) continue;
        const px = tx * TILE, py = ty * TILE;
        if (solidAt(wx, wy - 1)) {
          g.fillStyle = 'rgba(0,0,0,.34)';
          g.fillRect(px, py, TILE, 4);
          g.fillStyle = 'rgba(0,0,0,.15)';
          g.fillRect(px, py + 4, TILE, 3);
        }
        if (solidAt(wx - 1, wy)) { g.fillStyle = 'rgba(0,0,0,.20)'; g.fillRect(px, py, 3, TILE); }
        if (solidAt(wx + 1, wy)) { g.fillStyle = 'rgba(0,0,0,.20)'; g.fillRect(px + TILE - 3, py, 3, TILE); }
        if (solidAt(wx, wy + 1)) { g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(px, py + TILE - 2, TILE, 2); }
      }
    }

    /* ---------- 墙 ---------- */
    for (let ty = 0; ty < SK.ROOM_H; ty++) {
      for (let tx = 0; tx < SK.ROOM_W; tx++) {
        const wx = bx + tx, wy = by + ty;
        if (!solidAt(wx, wy) || blockAt(wx, wy)) continue;
        const px = tx * TILE, py = ty * TILE;
        const upS = solidAt(wx, wy - 1), dnS = solidAt(wx, wy + 1);
        const lfS = solidAt(wx - 1, wy), rtS = solidAt(wx + 1, wy);
        const n = SK.hash2(wx * 3 + 1, wy * 5 + 2);

        g.fillStyle = biome.cap;
        g.fillRect(px, py, TILE, TILE);

        if (dnS) {
          // 顶面：石砖质感
          g.fillStyle = 'rgba(255,255,255,.055)';
          if (n > 0.42) g.fillRect(px + 2, py + 3, TILE - 4, 2);
          g.fillStyle = 'rgba(0,0,0,.30)';
          g.fillRect(px + ((n * 12) | 0), py, 1, TILE);
          g.fillRect(px, py + ((n * 9) | 0) + 6, TILE, 1);
        } else {
          // 朝向房间的立面
          g.fillStyle = biome.face;
          g.fillRect(px, py + 5, TILE, TILE - 5);
          g.fillStyle = biome.faceHi;
          g.fillRect(px, py + 5, TILE, 1.5);
          g.fillStyle = biome.faceDark;
          g.fillRect(px, py + TILE - 1, TILE, 1);
          g.fillStyle = 'rgba(0,0,0,.30)';
          g.fillRect(px + 4 + ((n * 8) | 0), py + 7, 1, TILE - 9);
        }
        if (!upS) {
          g.fillStyle = biome.capHi;
          g.fillRect(px, py, TILE, 2);
          g.fillStyle = 'rgba(255,255,255,.10)';
          g.fillRect(px, py, TILE, 0.5);
        }
        // 面向房间的侧边亮棱
        if (!lfS) { g.fillStyle = biome.capHi; g.fillRect(px, py, 2, TILE); }
        if (!rtS) { g.fillStyle = biome.capHi; g.fillRect(px + TILE - 2, py, 2, TILE); }
        // 苔藓点缀
        if (!dnS && n > 0.78) {
          g.fillStyle = biome.accent;
          g.globalAlpha = 0.32;
          g.fillRect(px + 3 + ((n * 9) | 0), py + 10, 5, 2);
          g.globalAlpha = 1;
        }
      }
    }

    /* ---------- 障碍块 ---------- */
    for (let ty = 0; ty < SK.ROOM_H; ty++) {
      for (let tx = 0; tx < SK.ROOM_W; tx++) {
        const wx = bx + tx, wy = by + ty;
        if (!blockAt(wx, wy)) continue;
        const px = tx * TILE, py = ty * TILE;
        const upB = blockAt(wx, wy - 1), dnB = blockAt(wx, wy + 1);
        const lfB = blockAt(wx - 1, wy), rtB = blockAt(wx + 1, wy);

        // 投影（落在相邻地板上）
        if (!dnB) { g.fillStyle = 'rgba(0,0,0,.34)'; g.fillRect(px, py + TILE, TILE, 3); }
        if (!rtB) { g.fillStyle = 'rgba(0,0,0,.24)'; g.fillRect(px + TILE, py + 1, 3, TILE); }

        // 身体
        g.fillStyle = biome.bDark;
        g.fillRect(px, py, TILE, TILE);
        g.fillStyle = biome.bCap;
        g.fillRect(px + (lfB ? 0 : 1), py + (upB ? 0 : 1),
          TILE - (lfB ? 0 : 1) - (rtB ? 0 : 2), TILE - (upB ? 0 : 1) - (dnB ? 0 : 2));

        if (!upB) { g.fillStyle = biome.bHi; g.fillRect(px + 1, py + 1, TILE - 3, 2); }
        if (!dnB) { g.fillStyle = biome.bDark; g.fillRect(px + 1, py + TILE - 3, TILE - 3, 3); }
        if (!lfB) { g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(px + 1, py + 1, 1.5, TILE - 4); }
        if (!rtB) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(px + TILE - 3, py + 1, 2, TILE - 3); }

        const n = SK.hash2(wx + 31, wy + 17);
        g.fillStyle = 'rgba(0,0,0,.22)';
        g.fillRect(px + 3 + ((n * 7) | 0), py + 5, 2, 3);
        g.fillRect(px + 6 + ((n * 5) | 0), py + 9, 3, 1);
        if (n > 0.62) {
          g.fillStyle = biome.accent;
          g.globalAlpha = 0.3;
          g.fillRect(px + 2 + ((n * 5) | 0), py + 2, 4, 2);
          g.globalAlpha = 1;
        }
      }
    }
    return c;
  };

  /* ======================= 小工具 ======================= */
  function blob(g, x, y, rx, ry, col) {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, 0, 0, TAU);
    g.fill();
  }
  Art.blob = blob;
  function rrect(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x, y, w, h); }
  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  Art.rgba = rgba;

  /* ======================= 玩家 ======================= */
  Art.drawPlayer = function (g, p, t) {
    const spr = Art.playerSprite(p.charId, p.pal, ((p.walkT || 0) % 2) | 0);
    const bob = p.moving ? Math.round(Math.sin(p.walkPhase * 12) * 1) : 0;
    const f = p.facing < 0 ? -1 : 1;
    const x = Math.round(p.x), y = Math.round(p.y);

    // 影子
    g.fillStyle = 'rgba(0,0,0,.36)';
    g.beginPath(); g.ellipse(x, y + 7, 5.5, 2.2, 0, 0, TAU); g.fill();
    // 脚下的微光，帮助一眼认出自己（渐变预建一次）
    if (!Art._glow) {
      const c = document.createElement('canvas');
      c.width = 36; c.height = 20;
      const cg = c.getContext('2d');
      const rg = cg.createRadialGradient(18, 10, 1, 18, 10, 17);
      rg.addColorStop(0, 'rgba(200,235,255,.20)');
      rg.addColorStop(1, 'rgba(200,235,255,0)');
      cg.fillStyle = rg;
      cg.fillRect(0, 0, 36, 20);
      Art._glow = c;
    }
    g.drawImage(Art._glow, x - 18, y - 5);

    // 蓄力环
    if (p.weapon && p.weapon.charge && p.charge > 0.02) {
      const r = SK.clamp(p.charge / p.weapon.charge.time, 0, 1);
      g.save();
      g.strokeStyle = 'rgba(20,30,44,.8)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(x, y, 13, 0, TAU); g.stroke();
      g.strokeStyle = r >= 0.99 ? '#fff6b0' : ('rgba(' + Math.round(120 + r * 135) + ',' + Math.round(200 + r * 40) + ',255,.95)');
      g.lineWidth = 2;
      g.beginPath(); g.arc(x, y, 13, -Math.PI / 2, -Math.PI / 2 + TAU * r); g.stroke();
      if (r >= 0.99) {
        g.globalAlpha = 0.35 + Math.sin(t * 24) * 0.25;
        g.fillStyle = '#fff6b0';
        g.beginPath(); g.arc(x, y, 15, 0, TAU); g.fill();
        g.globalAlpha = 1;
      }
      g.restore();
    }

    // 冲刺残影
    if (p.dashTime > 0) {
      g.globalAlpha = 0.3;
      g.fillStyle = '#8fe0ff';
      for (let i = 1; i <= 3; i++) {
        const bx2 = x - p.dashDirX * i * 5, by2 = y - p.dashDirY * i * 5;
        g.beginPath(); g.ellipse(bx2, by2, 4.6, 5.6, 0, 0, TAU); g.fill();
      }
      g.globalAlpha = 1;
    }

    g.save();
    g.translate(x, y + bob);
    g.scale(f, 1);
    if (p.hurtT > 0 && ((p.hurtT * 30) | 0) % 2 === 0) g.globalAlpha = 0.5;
    if (p.invuln > 0 && p.dashTime <= 0 && ((p.invuln * 16) | 0) % 2 === 0) g.globalAlpha = 0.75;
    g.drawImage(spr, -6, -9);
    g.globalAlpha = 1;
    g.restore();

    // 武器
    if (p.weapon) Art.drawHeldWeapon(g, p, t);
  };

  /* 手持武器（跟随瞄准方向） */
  Art.drawHeldWeapon = function (g, p, t) {
    const def = p.weapon;
    const ang = p.aimAng;
    const hx = p.x + Math.cos(ang) * 3, hy = p.y + 1 + Math.sin(ang) * 2;
    g.save();
    g.translate(hx, hy);
    if (p.swinging > 0) {
      // 近战挥砍轨迹
      const sw = 1 - p.swinging / p.swingDur;
      const arc = def.arc || 1.8;
      const a0 = ang - arc / 2 + arc * sw * 0.55;
      g.save();
      g.rotate(a0);
      g.globalAlpha = 0.3 + 0.5 * (1 - sw);
      g.strokeStyle = def.trail || '#dff4ff';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, 0, (def.reach || 18), -0.55, 0.55);
      g.stroke();
      g.globalAlpha = 1;
      g.restore();
    }
    g.rotate(ang);
    if (ang > Math.PI / 2 || ang < -Math.PI / 2) g.scale(1, -1);
    Art.weaponShape(g, def, 1);
    g.restore();

    // 枪口火焰
    if (p.muzzle > 0 && def.kind === 'ranged') {
      const d = (def.reach || 9) + 2;
      const mx = hx + Math.cos(ang) * d, my = hy + Math.sin(ang) * d;
      const s = p.muzzle / 0.06;
      g.globalAlpha = Math.min(1, s);
      g.fillStyle = '#fff3b0';
      g.beginPath();
      g.moveTo(mx + Math.cos(ang) * 4 * s, my + Math.sin(ang) * 4 * s);
      g.lineTo(mx + Math.cos(ang + 1.9) * 3 * s, my + Math.sin(ang + 1.9) * 3 * s);
      g.lineTo(mx + Math.cos(ang - 1.9) * 3 * s, my + Math.sin(ang - 1.9) * 3 * s);
      g.closePath(); g.fill();
      g.fillStyle = '#ffc93c';
      g.beginPath(); g.arc(mx, my, 2.2 * s, 0, TAU); g.fill();
      g.globalAlpha = 1;
    }
  };

  /* 武器外形（原点在握把，+x 指向枪口） */
  Art.weaponShape = function (g, def, s) {
    const k = def.icon || 'gun';
    g.scale(s, s);
    if (k === 'gun') {
      rrect(g, -1, -2, 4, 4, '#3a3a4a');
      rrect(g, 2, -1.5, 8, 3, '#8a94a8');
      rrect(g, 8, -1, 3, 2, '#c8d4e8');
    } else if (k === 'smg') {
      rrect(g, -1, -2, 5, 4, '#2f3340');
      rrect(g, 3, -1.5, 7, 3, '#6f7a8c');
      rrect(g, 1, 1.5, 2, 4, '#4a5262');
      rrect(g, 9, -1, 2, 2, '#9fb0c8');
    } else if (k === 'shotgun') {
      rrect(g, -2, -2, 6, 4, '#5a3a24');
      rrect(g, 3, -2, 11, 2, '#8a94a8');
      rrect(g, 3, 0, 11, 1.5, '#6b7688');
      rrect(g, 2, 1.5, 2, 3, '#3f2a1a');
    } else if (k === 'rifle') {
      rrect(g, -3, -2, 7, 4, '#3f2a1a');
      rrect(g, 4, -1.5, 13, 3, '#7a8496');
      rrect(g, 14, -1, 3, 2, '#c8d4e8');
      rrect(g, 6, -4, 4, 2.5, '#4a5568');
    } else if (k === 'laser') {
      rrect(g, -1, -2, 5, 4, '#2a2f42');
      rrect(g, 4, -2, 10, 4, '#5a6a92');
      rrect(g, 5, -1, 8, 1.5, '#7ef0ff');
      rrect(g, 12, -2.5, 2, 5, '#9ef8ff');
    } else if (k === 'rpg') {
      rrect(g, -3, -3, 9, 6, '#3f5232');
      rrect(g, 6, -2.5, 9, 5, '#5a6a42');
      rrect(g, 14, -2, 3, 4, '#c84a2a');
      rrect(g, 2, 2, 2, 4, '#2a3020');
    } else if (k === 'staff') {
      rrect(g, -1, -1, 12, 2, '#6a4a2a');
      g.fillStyle = '#8a5ad0';
      g.beginPath(); g.arc(12, 0, 3, 0, TAU); g.fill();
      g.fillStyle = '#d8b0ff';
      g.beginPath(); g.arc(12, -0.5, 1.5, 0, TAU); g.fill();
    } else if (k === 'bow') {
      g.strokeStyle = '#8a6a3a';
      g.lineWidth = 2;
      g.beginPath(); g.arc(0, 0, 8, -1.15, 1.15); g.stroke();
      g.strokeStyle = '#d8d8c0';
      g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(3.2, -7.3); g.lineTo(3.2, 7.3); g.stroke();
    } else if (k === 'sword') {
      rrect(g, -1, -1.5, 4, 3, '#3a3a4a');
      rrect(g, 2, -2.5, 2, 5, '#c8a040');
      rrect(g, 4, -1, 12, 2, '#c8d8e8');
      rrect(g, 4, -1, 12, 0.8, '#ffffff');
    } else if (k === 'spear') {
      rrect(g, -1, -1, 16, 2, '#7a5a3a');
      g.fillStyle = '#c8d8e8';
      g.beginPath(); g.moveTo(22, 0); g.lineTo(15, -3); g.lineTo(15, 3); g.closePath(); g.fill();
    } else if (k === 'greatsword') {
      rrect(g, -1, -2, 5, 4, '#3a2a1a');
      rrect(g, 3, -3, 2, 6, '#a88030');
      rrect(g, 5, -2.5, 14, 5, '#b8c8d8');
      rrect(g, 5, -2.5, 14, 1.5, '#ffffff');
    } else if (k === 'fist') {
      g.fillStyle = '#f2c79a';
      g.beginPath(); g.arc(2, 0, 2.5, 0, TAU); g.fill();
    } else if (k === 'orb') {
      g.fillStyle = '#7ad8ff';
      g.beginPath(); g.arc(6, 0, 3, 0, TAU); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(6, -0.8, 1.2, 0, TAU); g.fill();
    } else {
      rrect(g, 0, -1.5, 7, 3, '#8a94a8');
    }
  };

  /* ======================= 敌人 ======================= */
  function drawEnemyBody(g, e, t) {
    const f = (e.ai === 'ranged' || e.ai === 'chase') ? (e.face || 1) : 1;
    const fx = e.x, fy = e.y;
    switch (e.sprite) {
      case 'slime': {
        const sq = 1 + Math.sin((e.hopT || 0) * 9) * 0.1;
        const rx = e.r * (1.18 / sq), ry = e.r * (0.94 * sq);
        g.fillStyle = '#15240f';
        g.beginPath(); g.ellipse(fx, fy + 1, rx + 1.4, ry + 1.4, 0, 0, TAU); g.fill();
        g.fillStyle = e.color;
        g.beginPath(); g.ellipse(fx, fy + 1, rx, ry, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.35;
        g.fillStyle = e.color2 || '#ffffff';
        g.beginPath(); g.ellipse(fx - rx * 0.32, fy - ry * 0.4 + 1, rx * 0.4, ry * 0.26, -0.4, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#14200f';
        g.fillRect(fx - 3.5, fy - 1, 2, 3); g.fillRect(fx + 1.5, fy - 1, 2, 3);
        break;
      }
      case 'bat': {
        const wing = Math.sin(t * 16 + e.seed) * 3;
        g.fillStyle = '#2e2240';
        g.beginPath();
        g.moveTo(fx - 2, fy); g.lineTo(fx - e.r - 5, fy - 4 + wing); g.lineTo(fx - e.r - 1, fy + 4); g.closePath(); g.fill();
        g.beginPath();
        g.moveTo(fx + 2, fy); g.lineTo(fx + e.r + 5, fy - 4 + wing); g.lineTo(fx + e.r + 1, fy + 4); g.closePath(); g.fill();
        g.fillStyle = '#1a1226';
        g.beginPath(); g.ellipse(fx, fy, e.r * 0.9, e.r * 1.05, 0, 0, TAU); g.fill();
        blob(g, fx, fy, e.r * 0.72, e.r * 0.85, e.color);
        g.fillStyle = '#ffe066';
        g.fillRect(fx - 2.5, fy - 1.5, 1.8, 2); g.fillRect(fx + 1, fy - 1.5, 1.8, 2);
        g.fillStyle = '#ffffff';
        g.fillRect(fx - 1.2, fy + 3, 1, 1.6); g.fillRect(fx + 0.6, fy + 3, 1, 1.6);
        break;
      }
      case 'goblin': {
        const bob = Math.sin(t * 8 + e.seed) * 0.8;
        const yb = fy + bob;
        // 腿
        g.fillStyle = '#33240f';
        g.fillRect(fx - 3.5, yb + 3, 3, 5);
        g.fillRect(fx + 0.5, yb + 3, 3, 5);
        // 身体
        g.fillStyle = '#1d2609';
        g.beginPath(); g.ellipse(fx, yb + 1, 5.6, 5.8, 0, 0, TAU); g.fill();
        g.fillStyle = e.color;
        g.beginPath(); g.ellipse(fx, yb + 1, 4.8, 5, 0, 0, TAU); g.fill();
        // 头
        g.fillStyle = '#1d2609';
        g.beginPath(); g.arc(fx, yb - 6, 5.9, 0, TAU); g.fill();
        g.fillStyle = e.color2;
        g.beginPath(); g.arc(fx, yb - 6, 5.1, 0, TAU); g.fill();
        // 耳朵
        g.beginPath(); g.moveTo(fx - 4.6, yb - 8); g.lineTo(fx - 8.6, yb - 11.5); g.lineTo(fx - 5.4, yb - 4); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(fx + 4.6, yb - 8); g.lineTo(fx + 8.6, yb - 11.5); g.lineTo(fx + 5.4, yb - 4); g.closePath(); g.fill();
        // 眼睛
        g.fillStyle = '#fff8d8';
        g.fillRect(fx - 3.4, yb - 7.4, 2.4, 2.6);
        g.fillRect(fx + 1, yb - 7.4, 2.4, 2.6);
        g.fillStyle = '#3a1a08';
        g.fillRect(fx - 2.8, yb - 6.9, 1.3, 1.6);
        g.fillRect(fx + 1.6, yb - 6.9, 1.3, 1.6);
        // 牙
        g.fillStyle = '#fff8d8';
        g.fillRect(fx - 1.5, yb - 2.6, 1.4, 1.8);
        g.fillRect(fx + 0.4, yb - 2.6, 1.4, 1.8);
        // 木棍
        g.save(); g.translate(fx, yb); g.scale(f, 1); g.rotate(-0.55 + Math.sin(t * 8) * 0.12);
        g.fillStyle = '#5a3a1a'; g.fillRect(4, -8, 2.2, 11);
        g.fillStyle = '#8a8a9a'; g.fillRect(3, -10, 4.2, 3);
        g.restore();
        break;
      }
      case 'archer': {
        const bob = Math.sin(t * 6 + e.seed) * 0.7;
        g.fillStyle = '#1b2b33';
        g.fillRect(fx - 4.5, fy - 2 + bob, 9, 9);
        g.fillStyle = e.color;
        g.fillRect(fx - 4, fy - 1 + bob, 8, 8);
        g.fillStyle = e.color2;
        g.fillRect(fx - 4, fy - 9 + bob, 8, 7);
        g.fillStyle = '#241a2e';
        g.fillRect(fx - 3, fy - 6.5 + bob, 6, 2.5);
        g.fillStyle = '#ffcf3a';
        g.fillRect(fx - 2.5, fy - 6.5 + bob, 1.6, 2);
        g.fillRect(fx + 1, fy - 6.5 + bob, 1.6, 2);
        g.save(); g.translate(fx, fy); g.scale(f, 1);
        g.strokeStyle = '#b08040'; g.lineWidth = 1.8;
        g.beginPath(); g.arc(3, 0, 7.5, -1.1, 1.1); g.stroke();
        g.strokeStyle = '#e8e0c0'; g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(6.4, -6.6); g.lineTo(6.4, 6.6); g.stroke();
        if (e.telegraph > 0) {
          g.strokeStyle = 'rgba(255,220,90,.9)'; g.lineWidth = 1;
          g.beginPath(); g.moveTo(-3, 0); g.lineTo(13, 0); g.stroke();
        }
        g.restore();
        break;
      }
      case 'bomber': {
        const pulse = e.fuse > 0 ? 1 + Math.sin(t * 34) * 0.18 : 1;
        const bob = Math.sin(t * 14 + e.seed) * 1.2;
        g.fillStyle = '#24120a';
        g.beginPath(); g.ellipse(fx, fy + 1 + bob, e.r * pulse + 1.2, e.r * pulse + 1.2, 0, 0, TAU); g.fill();
        g.fillStyle = e.fuse > 0 ? (Math.sin(t * 34) > 0 ? '#ff5a3a' : '#ffd35c') : e.color;
        g.beginPath(); g.ellipse(fx, fy + 1 + bob, e.r * pulse, e.r * pulse, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffe066';
        g.fillRect(fx - 3.5, fy - 2 + bob, 2.4, 2.6); g.fillRect(fx + 1.1, fy - 2 + bob, 2.4, 2.6);
        g.fillStyle = '#8a6a4a';
        g.fillRect(fx - 1, fy - e.r - 3 + bob, 2, 3);
        break;
      }
      case 'knight': {
        const bob = Math.sin(t * 5 + e.seed) * 0.5;
        g.fillStyle = '#1d222c';
        g.fillRect(fx - 7, fy - 5 + bob, 14, 12);
        g.fillStyle = e.color;
        g.fillRect(fx - 6, fy - 4 + bob, 11, 10);
        g.fillStyle = e.color2;
        g.fillRect(fx - 5, fy - 11 + bob, 10, 7);
        g.fillStyle = '#101820';
        g.fillRect(fx - 4, fy - 9 + bob, 8, 3.5);
        g.fillStyle = '#ff6a4a';
        g.fillRect(fx - 3, fy - 8.5 + bob, 2, 2);
        g.fillRect(fx + 1, fy - 8.5 + bob, 2, 2);
        g.save(); g.translate(fx, fy); g.scale(f, 1);
        g.fillStyle = '#48505f'; g.fillRect(-10, -7, 4, 12);
        g.fillStyle = '#8a94a8'; g.fillRect(-9, -6, 2, 10);
        g.fillStyle = '#c8d4e8'; g.fillRect(-10, -7, 4, 1.5);
        g.restore();
        break;
      }
      case 'bossSlime': {
        const b = Math.sin(t * 3) * 2;
        const rx = e.r * 1.06, ry = e.r * 0.86;
        g.fillStyle = '#0d1a0e';
        g.beginPath(); g.ellipse(fx, fy + 2 + b, rx + 2.5, ry + 2.5, 0, 0, TAU); g.fill();
        g.fillStyle = e.color;
        g.beginPath(); g.ellipse(fx, fy + 2 + b, rx, ry, 0, 0, TAU); g.fill();
        g.globalAlpha = 0.32;
        g.fillStyle = '#ffffff';
        g.beginPath(); g.ellipse(fx - rx * 0.34, fy - ry * 0.42 + b, rx * 0.34, ry * 0.24, -0.4, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#101e0e';
        g.beginPath(); g.ellipse(fx - 7, fy - 2 + b, 3.4, 4.6, 0, 0, TAU); g.fill();
        g.beginPath(); g.ellipse(fx + 7, fy - 2 + b, 3.4, 4.6, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffe066';
        g.fillRect(fx - 8, fy - 3.5 + b, 2.4, 2.4); g.fillRect(fx + 5.6, fy - 3.5 + b, 2.4, 2.4);
        g.fillStyle = '#ffcc33';
        g.fillRect(fx - 9, fy - e.r - 5 + b, 18, 3);
        g.fillRect(fx - 9, fy - e.r - 9 + b, 3.5, 4.5);
        g.fillRect(fx - 1.75, fy - e.r - 10 + b, 3.5, 5.5);
        g.fillRect(fx + 5.5, fy - e.r - 9 + b, 3.5, 4.5);
        g.fillStyle = '#fff0a8';
        g.fillRect(fx - 1, fy - e.r - 9 + b, 2, 2);
        break;
      }
      case 'bossGolem': {
        const b = Math.sin(t * 2) * 1;
        g.fillStyle = '#150f0c';
        g.fillRect(fx - e.r - 1, fy - e.r + b, e.r * 2 + 2, e.r * 2 + 2);
        g.fillStyle = e.color;
        g.fillRect(fx - e.r + 1, fy - e.r + 1 + b, e.r * 2 - 2, e.r * 2 - 2);
        g.fillStyle = e.color2;
        g.fillRect(fx - e.r + 2, fy - e.r + 2 + b, 8, 6);
        g.fillRect(fx + e.r - 11, fy - e.r + 2 + b, 8, 6);
        g.fillRect(fx - e.r + 2, fy + e.r - 9 + b, e.r * 2 - 4, 4);
        g.fillStyle = '#ff7a3a';
        g.fillRect(fx - 2, fy - 4 + b, 4, 10);
        g.fillRect(fx - 8, fy + 2 + b, 16, 2.5);
        g.fillRect(fx - 6, fy - 9 + b, 2, 4);
        g.fillStyle = Math.sin(t * 8) > 0 ? '#ffdd55' : '#ff8a3a';
        g.fillRect(fx - 9, fy - e.r + 9 + b, 5, 4);
        g.fillRect(fx + 4, fy - e.r + 9 + b, 5, 4);
        break;
      }
      case 'bossMage': {
        const b = Math.sin(t * 2.4) * 2;
        g.fillStyle = '#0d0715';
        g.beginPath();
        g.moveTo(fx - e.r - 1, fy + e.r + 1);
        g.lineTo(fx, fy - e.r - 1 + b);
        g.lineTo(fx + e.r + 1, fy + e.r + 1);
        g.closePath(); g.fill();
        g.fillStyle = e.color;
        g.beginPath();
        g.moveTo(fx - e.r + 2, fy + e.r);
        g.lineTo(fx, fy - e.r + 3 + b);
        g.lineTo(fx + e.r - 2, fy + e.r);
        g.closePath(); g.fill();
        g.fillStyle = e.color2;
        g.beginPath(); g.ellipse(fx, fy - e.r * 0.45 + b, 7.5, 8.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#08040e';
        g.beginPath(); g.ellipse(fx, fy - e.r * 0.3 + b, 5, 5.5, 0, 0, TAU); g.fill();
        g.fillStyle = '#9ef8ff';
        g.fillRect(fx - 3.5, fy - e.r * 0.35 + b, 2.2, 2.6);
        g.fillRect(fx + 1.3, fy - e.r * 0.35 + b, 2.2, 2.6);
        const oa = t * 1.6;
        const ox = fx + Math.cos(oa) * 19, oy = fy + Math.sin(oa) * 11 - 4;
        g.fillStyle = '#8a4aff';
        g.beginPath(); g.arc(ox, oy, 4.2, 0, TAU); g.fill();
        g.fillStyle = '#e6d0ff';
        g.beginPath(); g.arc(ox, oy, 1.9, 0, TAU); g.fill();
        break;
      }
      default: {
        blob(g, fx, fy, e.r, e.r, e.color || '#c05a5a');
      }
    }
  }

  function drawEnemyBar(g, e) {
    if (e.hp >= e.maxHp || e.type === 'boss' || e.maxHp <= 0) return;
    const w = Math.max(11, e.r * 2);
    const y = e.y - e.r - 7;
    g.fillStyle = 'rgba(0,0,0,.6)';
    g.fillRect(e.x - w / 2, y, w, 2.5);
    g.fillStyle = e.hp / e.maxHp > 0.4 ? '#6ee06e' : '#ff6a5a';
    g.fillRect(e.x - w / 2, y, w * (e.hp / e.maxHp), 2.5);
  }

  Art.drawEnemy = function (g, e, t) {
    // 影子
    g.fillStyle = 'rgba(0,0,0,.30)';
    g.beginPath(); g.ellipse(e.x, e.y + e.r * 0.85, e.r * 0.85, 2.4, 0, 0, TAU); g.fill();

    // 攻击前摇预警：红环 + 朝向扇形 + 感叹号
    if (e.atkState === 'windup') {
      const k = SK.clamp(1 - e.atkT / (e.windupT || 0.42), 0, 1);
      g.save();
      g.strokeStyle = 'rgba(255,80,80,' + (0.35 + k * 0.55) + ')';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(e.x, e.y, e.r + 4 + k * 7, 0, TAU); g.stroke();
      const dir = e.face > 0 ? 0 : Math.PI;
      g.fillStyle = 'rgba(255,90,90,' + (0.16 + k * 0.26) + ')';
      g.beginPath();
      g.moveTo(e.x, e.y);
      g.arc(e.x, e.y, e.r + 15, dir - 0.65, dir + 0.65);
      g.closePath(); g.fill();
      g.fillStyle = '#ff6a6a';
      g.fillRect(e.x - 1, e.y - e.r - 13, 2, 5);
      g.fillRect(e.x - 1, e.y - e.r - 7, 2, 2);
      g.restore();
    }

    drawEnemyBody(g, e, t);

    // 受击白闪：低透明度白影盖一层（不用 ctx.filter，那玩意在 Chromium 上很拖性能）
    if (e.flash > 0.05) {
      g.globalAlpha = Math.min(e.isBoss ? 0.26 : 0.46, e.flash * 0.9);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(e.x, e.y - 1, e.r * 0.98, e.r * 0.94, 0, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    drawEnemyBar(g, e);
  };

  /* ======================= 子弹 ======================= */
  Art.drawBullet = function (g, b) {
    const x = b.x, y = b.y;
    if (b.kind === 'laser') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = b.color; g.lineWidth = b.r * 1.8;
      g.beginPath(); g.moveTo(b.tx, b.ty); g.lineTo(x, y); g.stroke();
      g.strokeStyle = '#ffffff'; g.lineWidth = b.r * 0.6;
      g.beginPath(); g.moveTo(b.tx, b.ty); g.lineTo(x, y); g.stroke();
      g.restore();
      return;
    }
    if (b.kind === 'rocket') {
      g.save(); g.translate(x, y); g.rotate(Math.atan2(b.vy, b.vx));
      g.fillStyle = '#ffb03a';
      g.beginPath(); g.moveTo(-6, -1.5); g.lineTo(0, -2.5); g.lineTo(0, 2.5); g.lineTo(-6, 1.5); g.closePath(); g.fill();
      g.fillStyle = '#c8d4e8';
      g.fillRect(-2, -2.5, 8, 5);
      g.fillStyle = '#ff5a3a';
      g.beginPath(); g.moveTo(6, -2); g.lineTo(10, 0); g.lineTo(6, 2); g.closePath(); g.fill();
      g.restore();
      return;
    }
    if (b.kind === 'arrow') {
      g.save(); g.translate(x, y); g.rotate(Math.atan2(b.vy, b.vx));
      g.fillStyle = '#e8e0c0'; g.fillRect(-7, -1, 12, 2);
      g.fillStyle = '#c8d8e8';
      g.beginPath(); g.moveTo(7, 0); g.lineTo(2, -2.5); g.lineTo(2, 2.5); g.closePath(); g.fill();
      g.restore();
      return;
    }
    if (b.kind === 'orb') {
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = b.color; g.globalAlpha = 0.45;
      g.beginPath(); g.arc(x, y, b.r * 2.5, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(x, y, b.r * 0.85, 0, TAU); g.fill();
      g.globalCompositeOperation = 'source-over';
      return;
    }
    if (b.kind === 'wave') {
      g.fillStyle = b.color;
      g.globalAlpha = 0.7;
      g.beginPath(); g.arc(x, y, b.r, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, b.r, 0, TAU); g.stroke();
      return;
    }
    // basic
    if (b.glow) {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.28;
      g.fillStyle = b.color;
      g.beginPath(); g.arc(x, y, b.r * 2.1, 0, TAU); g.fill();
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    // 深色描边，保证在任何地面上都看得清
    g.fillStyle = b.friendly ? 'rgba(30,24,10,.55)' : 'rgba(24,8,12,.6)';
    g.beginPath(); g.arc(x, y, b.r + 1, 0, TAU); g.fill();
    g.fillStyle = b.color;
    g.beginPath(); g.arc(x, y, b.r, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.95)';
    g.beginPath(); g.arc(x, y, b.r * 0.45, 0, TAU); g.fill();
  };

  /* ======================= 掉落 / 道具 ======================= */
  Art.drawPickup = function (g, p, t) {
    const bob = Math.sin(t * 4 + (p.seed || 0)) * 1.4;
    const x = p.x, y = p.y + bob;
    switch (p.kind) {
      case 'coin': {
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.beginPath(); g.ellipse(p.x, p.y + 4, 3, 1.4, 0, 0, TAU); g.fill();
        g.fillStyle = '#8a5a10';
        g.beginPath(); g.ellipse(x, y + 1, 3, 3, 0, 0, TAU); g.fill();
        g.fillStyle = '#ffc531';
        g.beginPath(); g.ellipse(x, y, 2.6, 2.8, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff0a8';
        g.fillRect(x - 1, y - 1.5, 1.5, 2);
        break;
      }
      case 'hp': {
        g.fillStyle = 'rgba(0,0,0,.3)';
        g.beginPath(); g.ellipse(p.x, p.y + 4, 3, 1.4, 0, 0, TAU); g.fill();
        g.fillStyle = '#6b1220';
        g.fillRect(x - 3, y - 2, 6, 5); g.fillRect(x - 2, y - 3, 4, 7);
        g.fillStyle = '#ff4a64';
        g.fillRect(x - 2.5, y - 1.5, 5, 4); g.fillRect(x - 1.5, y - 2.5, 3, 6);
        g.fillStyle = '#ffb0c0';
        g.fillRect(x - 2, y - 1.5, 1.5, 1.5);
        break;
      }
      case 'energy': {
        g.fillStyle = 'rgba(120,220,255,.25)';
        g.beginPath(); g.arc(x, y, 5.8, 0, TAU); g.fill();
        g.fillStyle = '#6fd8ff';
        g.beginPath(); g.arc(x, y, 3.2, 0, TAU); g.fill();
        g.fillStyle = '#e0f8ff';
        g.beginPath(); g.arc(x - 1, y - 1, 1.5, 0, TAU); g.fill();
        break;
      }
      case 'weapon': {
        g.fillStyle = 'rgba(0,0,0,.34)';
        g.beginPath(); g.ellipse(x, p.y + 7, 7, 2.5, 0, 0, TAU); g.fill();
        g.fillStyle = p.tierColor || '#8fd8ff';
        g.globalAlpha = 0.2 + Math.sin(t * 5) * 0.06;
        g.beginPath(); g.arc(x, y, 10, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.save(); g.translate(x - 6, y); g.rotate(-0.35);
        Art.weaponShape(g, p.def, 0.72);
        g.restore();
        break;
      }
      case 'chest': {
        const open = p.opened;
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.ellipse(x, p.y + 8, 11, 3.4, 0, 0, TAU); g.fill();
        g.fillStyle = '#2c1a08';
        g.fillRect(x - 10, p.y - 2, 20, 11);
        g.fillStyle = '#8a5a24';
        g.fillRect(x - 9, p.y - 2, 18, 10);
        g.fillStyle = '#c8962e';
        g.fillRect(x - 9, p.y + 3, 18, 2);
        if (!open) {
          g.fillStyle = '#6b3a10';
          g.fillRect(x - 10, p.y - 9, 20, 8);
          g.fillStyle = '#a06a28';
          g.fillRect(x - 9, p.y - 8, 18, 6);
          g.fillStyle = '#ffd35c';
          g.fillRect(x - 2, p.y - 3, 4, 5);
          g.fillStyle = '#fff6cc';
          g.fillRect(x - 1, p.y - 2, 1.5, 2);
        } else {
          g.fillStyle = 'rgba(255,220,120,.45)';
          g.beginPath(); g.ellipse(x, p.y - 4, 9, 3, 0, 0, TAU); g.fill();
        }
        break;
      }
      case 'portal': {
        const r = 12 + Math.sin(t * 3) * 1.6;
        g.save();
        g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) {
          g.strokeStyle = ['rgba(120,220,255,.9)', 'rgba(180,140,255,.6)', 'rgba(255,255,255,.55)'][i];
          g.lineWidth = 2.2 - i * 0.5;
          g.beginPath();
          g.arc(x, y, r - i * 3.6, t * (1.4 + i * 0.5), t * (1.4 + i * 0.5) + 4.4);
          g.stroke();
        }
        g.restore();
        g.fillStyle = 'rgba(150,215,255,.16)';
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
        g.fillStyle = 'rgba(220,245,255,.9)';
        g.beginPath(); g.arc(x, y, 2.6 + Math.sin(t * 5) * 0.8, 0, TAU); g.fill();
        break;
      }
      case 'shelf': {
        // 石头底座
        g.fillStyle = 'rgba(0,0,0,.42)';
        g.beginPath(); g.ellipse(x, p.y + 8, 10, 3.2, 0, 0, TAU); g.fill();
        g.fillStyle = '#2c2a24';
        g.fillRect(x - 8, p.y + 1, 16, 7);
        g.fillStyle = '#57524a';
        g.fillRect(x - 7, p.y + 2, 14, 5);
        g.fillStyle = '#8a8272';
        g.fillRect(x - 7, p.y + 2, 14, 1.4);
        // 光柱
        g.globalAlpha = 0.16 + Math.sin(t * 4) * 0.05;
        g.fillStyle = '#ffd35c';
        g.fillRect(x - 6, p.y - 16, 12, 17);
        g.globalAlpha = 1;
        // 商品
        const it = p.item ? p.item.kind : 'hp';
        if (it === 'hp') {
          g.fillStyle = '#6b1220';
          g.fillRect(x - 4, p.y - 11, 8, 6); g.fillRect(x - 3, p.y - 13, 6, 10);
          g.fillStyle = '#ff4a64';
          g.fillRect(x - 3, p.y - 10, 6, 5); g.fillRect(x - 2, p.y - 12, 4, 9);
          g.fillStyle = '#ffb0c0';
          g.fillRect(x - 2, p.y - 11, 2, 2);
        } else if (it === 'talent') {
          g.fillStyle = 'rgba(201,160,255,.3)';
          g.beginPath(); g.arc(x, p.y - 9, 8, 0, TAU); g.fill();
          g.fillStyle = '#c9a0ff';
          g.beginPath();
          g.moveTo(x, p.y - 16); g.lineTo(x + 5, p.y - 9);
          g.lineTo(x, p.y - 2); g.lineTo(x - 5, p.y - 9);
          g.closePath(); g.fill();
          g.fillStyle = '#ffffff';
          g.fillRect(x - 1, p.y - 10, 2, 3);
        } else if (it === 'energy') {
          g.fillStyle = 'rgba(120,220,255,.3)';
          g.beginPath(); g.arc(x, p.y - 9, 7, 0, TAU); g.fill();
          g.fillStyle = '#6fd8ff';
          g.beginPath(); g.arc(x, p.y - 9, 4, 0, TAU); g.fill();
          g.fillStyle = '#e0f8ff';
          g.beginPath(); g.arc(x - 1.2, p.y - 10.2, 1.8, 0, TAU); g.fill();
        } else {
          g.save(); g.translate(x - 6, p.y - 10); g.rotate(-0.3);
          Art.weaponShape(g, p.def || { icon: 'gun' }, 0.7);
          g.restore();
        }
        // 价格牌
        g.fillStyle = 'rgba(8,10,16,.78)';
        g.fillRect(x - 9, p.y + 9, 18, 6);
        g.fillStyle = '#ffd35c';
        g.font = 'bold 6px monospace';
        g.textAlign = 'center';
        g.fillText(p.price + '', x, p.y + 14);
        g.textAlign = 'left';
        break;
      }
      case 'bosschest': {
        const open = p.opened;
        // 光柱
        g.globalAlpha = 0.16 + Math.sin(t * 3) * 0.05;
        g.fillStyle = '#ffd35c';
        g.fillRect(x - 14, p.y - 34, 28, 40);
        g.globalAlpha = 1;
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.beginPath(); g.ellipse(x, p.y + 10, 15, 4.4, 0, 0, TAU); g.fill();
        g.fillStyle = '#3a1c08';
        g.fillRect(x - 14, p.y - 3, 28, 14);
        g.fillStyle = '#c8962e';
        g.fillRect(x - 13, p.y - 2, 26, 12);
        g.fillStyle = '#7a5210';
        g.fillRect(x - 13, p.y + 4, 26, 2);
        if (!open) {
          g.fillStyle = '#5a3208';
          g.fillRect(x - 14, p.y - 13, 28, 11);
          g.fillStyle = '#e8b83a';
          g.fillRect(x - 13, p.y - 12, 26, 9);
          g.fillStyle = '#fff0a8';
          g.fillRect(x - 13, p.y - 12, 26, 2);
          g.fillStyle = '#fff';
          g.fillRect(x - 3, p.y - 6, 6, 7);
          g.fillStyle = '#c8962e';
          g.fillRect(x - 1, p.y - 4, 2, 3);
        } else {
          g.fillStyle = 'rgba(255,220,120,.55)';
          g.beginPath(); g.ellipse(x, p.y - 6, 13, 4, 0, 0, TAU); g.fill();
        }
        // 标记：BOSS 宝箱
        g.fillStyle = '#ff5a6e';
        g.fillRect(x - 2, p.y - 20, 4, 5);
        g.fillRect(x - 1, p.y - 24, 2, 3);
        break;
      }
      case 'event': {
        const et = p.evType || 'well';
        g.fillStyle = 'rgba(0,0,0,.4)';
        g.beginPath(); g.ellipse(x, p.y + 9, 12, 3.6, 0, 0, TAU); g.fill();
        if (et === 'smith') {
          // 铁砧
          g.fillStyle = '#2a2a30'; g.fillRect(x - 9, p.y + 2, 18, 7);
          g.fillStyle = '#5a5a66'; g.fillRect(x - 8, p.y + 3, 16, 5);
          g.fillStyle = '#8a8a96'; g.fillRect(x - 8, p.y + 3, 16, 1.5);
          g.fillStyle = '#3a2a1a'; g.fillRect(x - 2, p.y - 6, 4, 8);
          g.fillStyle = '#9aa4b4'; g.fillRect(x - 6, p.y - 10, 12, 4);
          g.fillStyle = '#ff9a3a'; g.fillRect(x + 3, p.y - 12, 3, 3);
        } else if (et === 'statue') {
          // 石像
          g.fillStyle = '#3a3a46';
          g.fillRect(x - 7, p.y - 16, 14, 22);
          g.fillStyle = '#5c5c6e';
          g.fillRect(x - 6, p.y - 15, 12, 20);
          g.fillStyle = '#7a7a92';
          g.fillRect(x - 5, p.y - 14, 10, 3);
          g.fillStyle = '#c9a0ff';
          g.fillRect(x - 2, p.y - 11, 4, 4);
          g.fillRect(x - 3, p.y - 6, 6, 2);
        } else if (et === 'gambler') {
          // 赌桌 + 骰子
          g.fillStyle = '#2c3a24'; g.fillRect(x - 10, p.y - 2, 20, 9);
          g.fillStyle = '#3f5a30'; g.fillRect(x - 9, p.y - 1, 18, 7);
          g.fillStyle = '#f0ead8';
          g.fillRect(x - 5, p.y - 10, 7, 7);
          g.fillStyle = '#1a1a1a';
          g.fillRect(x - 4, p.y - 9, 2, 2); g.fillRect(x - 1, p.y - 6, 2, 2); g.fillRect(x - 4, p.y - 8, 2, 2);
          g.fillStyle = '#ff6a6a';
          g.fillRect(x + 3, p.y - 9, 5, 7);
          g.fillStyle = '#ffd35c';
          g.fillRect(x + 4, p.y - 8, 3, 5);
        } else {
          // 许愿井
          g.fillStyle = '#2a2a30';
          g.fillRect(x - 10, p.y - 4, 20, 10);
          g.fillStyle = '#4a4a56';
          g.fillRect(x - 9, p.y - 3, 18, 8);
          g.fillStyle = '#12161c';
          g.fillRect(x - 6, p.y - 2, 12, 5);
          g.fillStyle = 'rgba(120,216,255,.7)';
          g.fillRect(x - 5, p.y + 1, 10, 2);
          g.fillStyle = '#6b6b7a';
          g.fillRect(x - 10, p.y - 5, 20, 2);
        }
        // 价格牌
        const price = { smith: 30, statue: 35, gambler: 20, well: 10 }[et] || 10;
        g.fillStyle = 'rgba(8,10,16,.8)';
        g.fillRect(x - 8, p.y + 11, 16, 6);
        g.fillStyle = '#ffd35c';
        g.font = 'bold 6px monospace';
        g.textAlign = 'center';
        g.fillText(price + '', x, p.y + 16);
        g.textAlign = 'left';
        break;
      }
      case 'shrine': {
        const pk2 = Math.sin(t * 2.2) * 1.2;
        g.fillStyle = 'rgba(0,0,0,.38)';
        g.beginPath(); g.ellipse(x, p.y + 9, 11, 3.4, 0, 0, TAU); g.fill();
        // 底座
        g.fillStyle = '#241a33';
        g.fillRect(x - 9, p.y + 2, 18, 8);
        g.fillStyle = '#4a3a68';
        g.fillRect(x - 8, p.y + 3, 16, 6);
        // 悬浮符文
        g.globalAlpha = 0.22 + Math.sin(t * 3) * 0.08;
        g.fillStyle = '#b98aff';
        g.beginPath(); g.arc(x, p.y - 8 + pk2, 12, 0, TAU); g.fill();
        g.globalAlpha = 1;
        g.fillStyle = '#d0b0ff';
        g.beginPath();
        g.moveTo(x, p.y - 20 + pk2);
        g.lineTo(x + 6, p.y - 8 + pk2);
        g.lineTo(x, p.y + 2 + pk2);
        g.lineTo(x - 6, p.y - 8 + pk2);
        g.closePath(); g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath(); g.arc(x, p.y - 8 + pk2, 2.2, 0, TAU); g.fill();
        break;
      }
      default:
        blob(g, x, y, 3, 3, '#ffffff');
    }
  };

  /* ======================= 门 ======================= */
  Art.drawDoor = function (g, door, biome, t) {
    const r = door.rect;
    const horiz = door.dir === 'n' || door.dir === 's';
    const locked = door.locked;

    // 通道地面
    g.fillStyle = 'rgba(0,0,0,.42)';
    g.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);

    // 门框（左右/上下石柱）
    g.fillStyle = biome.capDark;
    if (horiz) {
      g.fillRect(r.x, r.y, 3, r.h);
      g.fillRect(r.x + r.w - 3, r.y, 3, r.h);
      g.fillStyle = biome.capHi;
      g.fillRect(r.x, r.y, 1.5, r.h);
      g.fillRect(r.x + r.w - 3, r.y, 1.5, r.h);
    } else {
      g.fillRect(r.x, r.y, r.w, 3);
      g.fillRect(r.x, r.y + r.h - 3, r.w, 3);
      g.fillStyle = biome.capHi;
      g.fillRect(r.x, r.y, r.w, 1.5);
      g.fillRect(r.x, r.y + r.h - 3, r.w, 1.5);
    }

    if (locked) {
      // 栅栏
      g.fillStyle = 'rgba(190,40,60,.85)';
      const n = 4;
      for (let i = 0; i < n; i++) {
        if (horiz) g.fillRect(r.x + 4 + i * ((r.w - 8) / (n - 1)), r.y + 3, 2.5, r.h - 6);
        else g.fillRect(r.x + 3, r.y + 4 + i * ((r.h - 8) / (n - 1)), r.w - 6, 2.5);
      }
      g.fillStyle = 'rgba(255,90,110,.5)';
      if (horiz) { g.fillRect(r.x + 2, r.y + r.h / 2 - 1, r.w - 4, 2); }
      else { g.fillRect(r.x + r.w / 2 - 1, r.y + 2, 2, r.h - 4); }
      // 呼吸光
      g.globalAlpha = 0.18 + Math.sin(t * 5) * 0.1;
      g.fillStyle = '#ff5a6e';
      g.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
      g.globalAlpha = 1;
    } else {
      // 开着的门：地面发光 + 朝外的箭头
      g.globalAlpha = 0.22 + Math.sin(t * 3) * 0.1;
      g.fillStyle = biome.accent;
      g.fillRect(r.x + 3, r.y + 3, r.w - 6, r.h - 6);
      g.globalAlpha = 1;
      g.fillStyle = biome.accent;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const ax = door.dir === 'e' ? 1 : door.dir === 'w' ? -1 : 0;
      const ay = door.dir === 's' ? 1 : door.dir === 'n' ? -1 : 0;
      const pulse = 1.5 + Math.sin(t * 4) * 0.7;
      g.beginPath();
      g.moveTo(cx + ax * (5 + pulse), cy + ay * (5 + pulse));
      g.lineTo(cx + ax * 1 - ay * 4, cy + ay * 1 - ax * 4);
      g.lineTo(cx + ax * 1 + ay * 4, cy + ay * 1 + ax * 4);
      g.closePath();
      g.fill();
    }
  };

  /* ======================= 粒子 ======================= */
  Art.drawParticle = function (g, p) {
    const a = p.life / p.maxLife;
    g.globalAlpha = Math.max(0, Math.min(1, a));
    g.fillStyle = p.color;
    const s = p.size * (0.4 + a * 0.8);
    g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    g.globalAlpha = 1;
  };

  /* ======================= 角色卡缩略图 ======================= */
  Art.charThumb = function (charDef) {
    const c = document.createElement('canvas');
    c.width = 38; c.height = 45;
    const g = c.getContext('2d');
    g.imageSmoothingEnabled = false;
    const spr = Art.playerSprite(charDef.id, charDef.pal, 0);
    g.save();
    g.translate(19, 33);
    g.scale(2.6, 2.6);
    g.drawImage(spr, -6, -9);
    g.restore();
    return c;
  };
})();
