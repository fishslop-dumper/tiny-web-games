/* ============================================================
   weapons.js —— 武器数据 + 开火 / 近战逻辑
   ============================================================ */
(function () {
  'use strict';
  const SK = window.SK;
  const W = (SK.WEAPONS = {});

  SK.TIER_COLORS = ['', '#d8e0ec', '#6ee06e', '#5ab8ff', '#c07aff'];
  SK.TIER_NAMES = ['', '普通', '精良', '稀有', '传说'];

  /* ------------------------------------------------------------
     kind: 'ranged' | 'melee'
     bullet.kind: basic | orb | arrow | rocket | laser | wave
     ------------------------------------------------------------ */
  W.pistol = {
    id: 'pistol', name: '破旧手枪', icon: 'gun', kind: 'ranged', tier: 1, minFloor: 1,
    dmg: 6, cd: 0.18, energy: 0, speed: 340, count: 1, jitter: 0.03, reach: 12,
    bullet: { r: 2.4, color: '#ffe066', kind: 'basic', life: 1.4, glow: true }
  };
  W.smg = {
    id: 'smg', name: '冲锋枪', icon: 'smg', kind: 'ranged', tier: 1, minFloor: 1,
    dmg: 4, cd: 0.085, energy: 1, speed: 360, count: 1, jitter: 0.11, reach: 13,
    bullet: { r: 2.1, color: '#ffd35c', kind: 'basic', life: 1.1, glow: true }
  };
  W.shotgun = {
    id: 'shotgun', name: '霰弹枪', icon: 'shotgun', kind: 'ranged', tier: 1, minFloor: 1,
    dmg: 4, cd: 0.75, energy: 2, speed: 300, count: 6, spread: 0.36, jitter: 0.05, knock: 90, reach: 14,
    bullet: { r: 2.2, color: '#ffb03a', kind: 'basic', life: 0.42, glow: true }
  };
  W.rifle = {
    id: 'rifle', name: '精准步枪', icon: 'rifle', kind: 'ranged', tier: 2, minFloor: 1,
    dmg: 15, cd: 0.64, energy: 2, speed: 640, count: 1, jitter: 0.006, pierce: 2, reach: 18,
    charge: { time: 0.42, mul: 2.1 },
    bullet: { r: 2.6, color: '#9ef8ff', kind: 'basic', life: 1.8, glow: true }
  };
  W.laser = {
    id: 'laser', name: '激光枪', icon: 'laser', kind: 'ranged', tier: 3, minFloor: 2,
    dmg: 13, cd: 0.42, energy: 3, range: 260, reach: 15,
    charge: { time: 0.50, mul: 1.9 },
    bullet: { r: 2.2, color: '#7ef0ff', kind: 'laser' }
  };
  W.rpg = {
    id: 'rpg', name: '火箭筒', icon: 'rpg', kind: 'ranged', tier: 3, minFloor: 2,
    dmg: 20, cd: 1.05, energy: 5, speed: 215, count: 1, reach: 18, knock: 60,
    bullet: { r: 3.4, color: '#ffb03a', kind: 'rocket', life: 2.4, explode: 42, explodeDmg: 14 }
  };
  W.staff = {
    id: 'staff', name: '三叉法杖', icon: 'staff', kind: 'ranged', tier: 1, minFloor: 1,
    dmg: 7, cd: 0.52, energy: 3, speed: 245, count: 3, spread: 0.24, reach: 12,
    bullet: { r: 2.8, color: '#b98aff', kind: 'orb', life: 1.6, glow: true }
  };
  W.frost = {
    id: 'frost', name: '霜之法杖', icon: 'staff', kind: 'ranged', tier: 2, minFloor: 2,
    dmg: 6, cd: 0.34, energy: 2, speed: 285, count: 1, jitter: 0.02, reach: 12, slow: 0.45,
    bullet: { r: 2.8, color: '#8fe0ff', kind: 'orb', life: 1.5, glow: true }
  };
  W.bouncer = {
    id: 'bouncer', name: '弹跳枪', icon: 'gun', kind: 'ranged', tier: 2, minFloor: 1,
    dmg: 8, cd: 0.34, energy: 2, speed: 300, count: 1, jitter: 0.02, reach: 12, bounce: 3,
    bullet: { r: 2.6, color: '#7effc8', kind: 'basic', life: 3.2, glow: true }
  };
  W.bow = {
    id: 'bow', name: '猎弓', icon: 'bow', kind: 'ranged', tier: 1, minFloor: 1,
    dmg: 11, cd: 0.46, energy: 1, speed: 520, count: 1, jitter: 0.01, pierce: 1, reach: 14,
    charge: { time: 0.55, mul: 2.4 },
    bullet: { r: 2.0, color: '#e8e0c0', kind: 'arrow', life: 1.6 }
  };

  /* ---- 近战 ---- */
  W.dagger = {
    id: 'dagger', name: '匕首', icon: 'sword', kind: 'melee', tier: 1, minFloor: 1,
    dmg: 7, cd: 0.17, energy: 0, arc: 1.4, reach: 24, knock: 25, trail: '#dff4ff', deflect: true
  };
  W.sword = {
    id: 'sword', name: '短剑', icon: 'sword', kind: 'melee', tier: 1, minFloor: 1,
    dmg: 9, cd: 0.30, energy: 0, arc: 1.9, reach: 31, knock: 90, trail: '#dff4ff', deflect: true
  };
  W.katana = {
    id: 'katana', name: '太刀', icon: 'sword', kind: 'melee', tier: 2, minFloor: 1,
    dmg: 10, cd: 0.23, energy: 0, arc: 2.4, reach: 35, knock: 60, trail: '#b8e8ff', deflect: true
  };
  W.spear = {
    id: 'spear', name: '长枪', icon: 'spear', kind: 'melee', tier: 1, minFloor: 1,
    dmg: 12, cd: 0.44, energy: 0, arc: 0.72, reach: 46, knock: 70, trail: '#ffe9a8', deflect: true
  };
  W.axe = {
    id: 'axe', name: '战斧', icon: 'greatsword', kind: 'melee', tier: 2, minFloor: 1,
    dmg: 16, cd: 0.50, energy: 0, arc: 2.2, reach: 34, knock: 140, trail: '#ffd9a8', deflect: true
  };
  W.greatsword = {
    id: 'greatsword', name: '巨剑', icon: 'greatsword', kind: 'melee', tier: 2, minFloor: 2,
    dmg: 21, cd: 0.64, energy: 0, arc: 2.5, reach: 37, knock: 190, trail: '#ffd35c', deflect: true
  };
  W.hammer = {
    id: 'hammer', name: '战锤', icon: 'greatsword', kind: 'melee', tier: 3, minFloor: 2,
    dmg: 27, cd: 0.82, energy: 0, arc: 2.7, reach: 39, knock: 290, trail: '#ffe08a', deflect: true
  };
  W.fist = {
    id: 'fist', name: '拳头', icon: 'fist', kind: 'melee', tier: 1, minFloor: 1,
    dmg: 4, cd: 0.26, energy: 0, arc: 1.5, reach: 18, knock: 40, trail: '#ffffff', deflect: false
  };

  /* ---- BOSS 专属掉落（不进普通掉落池） ---- */
  W.slimecannon = {
    id: 'slimecannon', name: '黏液喷射器', icon: 'shotgun', kind: 'ranged', tier: 4, minFloor: 99, boss: true,
    dmg: 7, cd: 0.58, energy: 2, speed: 255, count: 7, spread: 0.52, jitter: 0.06, knock: 70, reach: 14, slow: 0.35,
    bullet: { r: 3, color: '#7dff9e', kind: 'orb', life: 0.5, glow: true }
  };
  W.lavacannon = {
    id: 'lavacannon', name: '熔岩重炮', icon: 'rpg', kind: 'ranged', tier: 4, minFloor: 99, boss: true,
    dmg: 34, cd: 0.95, energy: 6, speed: 235, count: 1, reach: 18, knock: 90,
    charge: { time: 0.7, mul: 2.0 },
    bullet: { r: 4, color: '#ff9a3a', kind: 'rocket', life: 2.4, explode: 54, explodeDmg: 26 }
  };
  W.frostscythe = {
    id: 'frostscythe', name: '霜之镰刀', icon: 'greatsword', kind: 'melee', tier: 4, minFloor: 99, boss: true,
    dmg: 30, cd: 0.55, energy: 0, arc: 2.9, reach: 42, knock: 210, slow: 0.55, trail: '#9ef0ff', deflect: true
  };

  SK.BOSS_WEAPONS = { slimeKing: 'slimecannon', golem: 'lavacannon', mage: 'frostscythe' };

  /* ------------------------------ 武器强度换算 ------------------------------ */
  SK.weaponStats = function (w) {
    if (!w) return null;
    const n = w.count || 1;
    const cd = Math.max(0.01, w.cd);
    const per = w.kind === 'melee' ? w.dmg : w.dmg * n;
    return {
      n: n,
      per: Math.round(per),
      dps: Math.round(per / cd),
      cd: Math.round(cd * 100) / 100,
      energy: w.energy || 0
    };
  };

  /* ------------------------------ 掉落池 ------------------------------ */
  const POOL = ['pistol', 'smg', 'shotgun', 'staff', 'bouncer', 'bow',
    'sword', 'dagger', 'katana', 'spear', 'axe',
    'rifle', 'frost', 'laser', 'greatsword', 'hammer', 'rpg'];

  SK.rollWeapon = function (floor, rng) {
    const r = rng || { next: Math.random };
    const avail = POOL.filter((id) => (W[id].minFloor || 1) <= floor);
    const id = avail[Math.min(avail.length - 1, Math.floor(r.next() * avail.length))];
    // 楼层越深越容易出高档次
    const bonus = floor >= 3 ? 0.42 : floor >= 2 ? 0.2 : 0.06;
    let tier = (W[id].tier || 1) + (r.next() < bonus ? 1 : 0);
    tier = SK.clamp(tier, 1, 4);
    return SK.makeWeapon(id, tier);
  };

  SK.makeWeapon = function (id, tier, noScale) {
    const d = W[id];
    const t = SK.clamp(tier || d.tier || 1, 1, 4);
    const mul = [0, 1, 1.14, 1.3, 1.5][t];
    const w = {
      id: id, def: d,
      name: d.name,
      tier: t,
      tierColor: SK.TIER_COLORS[t],
      kind: d.kind, icon: d.icon,
      dmg: Math.max(1, Math.round(d.dmg * (noScale ? 1 : mul))),
      cd: d.cd, energy: d.energy,
      speed: d.speed, count: d.count || 1,
      spread: d.spread || 0, jitter: d.jitter || 0,
      pierce: d.pierce || 0, knock: d.knock || (d.kind === 'ranged' ? 45 : 0),
      bounce: d.bounce || 0,
      arc: d.arc, reach: d.reach || 16,
      range: d.range || 240,
      slow: d.slow || 0,
      trail: d.trail || '#ffffff',
      deflect: !!d.deflect,
      charge: d.charge || null,
      bullet: d.bullet || null
    };
    if (d.bullet && d.bullet.kind === 'laser') { w.dmg = Math.round(13 * mul); }
    return w;
  };

  /* ------------------------------ 开火 ------------------------------ */
  // ent 需要: x, y, isPlayer；charge 0..1（蓄力武器）
  SK.attack = function (w, ent, ang, game, charge) {
    if (!w) return;
    if (w.kind === 'melee') return melee(w, ent, ang, game);
    return shoot(w, ent, ang, game, charge || 0);
  };

  function shoot(w, ent, ang, game, charge) {
    const m = ent.isPlayer ? ent.mods : null;
    let n = w.count;
    if (n > 1 && m) n += m.extraPellets;
    // 蓄力加成
    const cm = w.charge ? (1 + (w.charge.mul - 1) * charge) : 1;
    for (let i = 0; i < n; i++) {
      let a = ang;
      if (n > 1) a += (i - (n - 1) / 2) * (w.spread || 0.2);
      a += SK.rand(-w.jitter, w.jitter);
      const ox = ent.x + Math.cos(a) * (w.reach || 12) * 0.55;
      const oy = ent.y + Math.sin(a) * (w.reach || 12) * 0.55 - 1;

      if (w.bullet.kind === 'laser') {
        game.beam(ent, a, w, ox, oy, charge);
        continue;
      }
      const b = {
        x: ox, y: oy,
        vx: Math.cos(a) * w.speed * (0.85 + charge * 0.35),
        vy: Math.sin(a) * w.speed * (0.85 + charge * 0.35),
        r: w.bullet.r * (m ? m.bulletSize : 1) * (1 + charge * 0.35),
        dmg: w.dmg * (m ? m.dmgRanged : 1) * cm,
        friendly: !!ent.isPlayer,
        pierce: w.pierce + (m ? m.pierce : 0) + (charge > 0.9 && w.charge ? 1 : 0),
        bounce: w.bounce + (m ? m.bounce : 0),
        life: w.bullet.life || 1.6,
        color: w.bullet.color, kind: w.bullet.kind,
        glow: w.bullet.glow,
        knock: w.knock * (m ? m.knock : 1),
        slow: Math.max(w.slow || 0, m ? m.slowShot : 0),
        split: m ? m.split : 0,
        critPierce: m ? !!m.critPierce : false,
        storm: m ? !!m.storm : false,
        explode: w.bullet.explode || 0, explodeDmg: w.bullet.explodeDmg || 0,
        hitSet: null, trail: w.bullet.kind === 'rocket' ? 1 : 0
      };
      game.addBullet(b);
    }
    ent.muzzle = 0.06;
    if (w.bullet && w.bullet.kind === 'laser') SK.Sound.laser();
    else if (w.icon === 'rpg' || w.icon === 'shotgun') SK.Sound.shootHeavy();
    else if (w.icon === 'smg') SK.Sound.tone(880, 0.05, 'square', 0.04, 500);
    else SK.Sound.shoot();
    // 后坐力
    if (ent.isPlayer) {
      ent.vx -= Math.cos(ang) * (w.icon === 'rpg' ? 70 : w.icon === 'shotgun' ? 34 : 6);
      ent.vy -= Math.sin(ang) * (w.icon === 'rpg' ? 70 : w.icon === 'shotgun' ? 34 : 6);
    }
  }

  function melee(w, ent, ang, game) {
    const m = ent.isPlayer ? ent.mods : null;
    // 三段连击：第三段是收招重击
    const ci = ent.isPlayer ? (ent.comboIdx || 0) % 3 : 0;
    if (ent.isPlayer) {
      ent.comboIdx = ci + 1;
      ent.comboT = 0.85;
    }
    const finisher = ci === 2;
    const s = {
      ang: ang + (ci === 0 ? -0.22 : ci === 1 ? 0.22 : 0),
      arc: w.arc * (m ? m.reach : 1) * (finisher ? 1.3 : 1),
      reach: w.reach * (m ? m.reach : 1) * (finisher ? 1.12 : 1),
      dmg: w.dmg * (m ? m.dmgMelee : 1) * (finisher ? 1.7 : 1),
      life: 0.16, maxLife: 0.16, hit: [],
      knock: w.knock * (m ? m.knock : 1) * (finisher ? 1.6 : 1),
      slow: w.slow || 0,
      stun: (w.stun || 0.32) * (finisher ? 1.7 : 1),
      combo: ci,
      finisher: finisher,
      deflect: w.deflect, trail: w.trail, col: w.tierColor
    };
    if (!ent.swings) ent.swings = [];
    ent.swings.push(s);
    if (ent.swings.length > 3) ent.swings.shift();
    ent.swinging = 0.16;
    ent.swingDur = 0.16;
    SK.Sound.swing();
    if (ent.isPlayer) {
      const push = finisher ? 95 : 45;
      ent.vx += Math.cos(ang) * push;
      ent.vy += Math.sin(ang) * push;
      if (finisher) {
        game.shake(5);
        game.spark(ent.x + Math.cos(ang) * 22, ent.y + Math.sin(ang) * 22, s.trail, 14, 0.9);
        SK.Sound.tone(520, 0.09, 'square', 0.07, 220);
      }
    }
  }

  // 每帧处理近战判定
  SK.updateSwings = function (ent, dt, game) {
    if (!ent.swings || !ent.swings.length) return;
    for (let i = ent.swings.length - 1; i >= 0; i--) {
      const s = ent.swings[i];
      s.life -= dt;
      if (s.life <= 0) { ent.swings.splice(i, 1); continue; }
      const targets = ent.isPlayer ? game.enemies : [game.player];
      for (let j = 0; j < targets.length; j++) {
        const t = targets[j];
        if (!t || t.dead) continue;
        if (s.hit.indexOf(t) >= 0) continue;
        const d = SK.dist(ent.x, ent.y, t.x, t.y);
        if (d > s.reach + t.r) continue;
        const a = SK.angleTo(ent.x, ent.y, t.x, t.y);
        if (Math.abs(SK.angDiff(s.ang, a)) > s.arc / 2 && d > t.r + 4) continue;
        s.hit.push(t);
        const crit = ent.isPlayer && game.rollCrit();
        const dmg = crit ? s.dmg * 2 : s.dmg;
        t.hurt(dmg, a, game, crit);
        if (s.slow) t.slowT = s.slow * 2.4;
        SK.Sound.hit();
        game.spark(t.x, t.y, s.trail, crit ? 12 : 7);
        game.shake(crit ? 3 : 1.6);
        if (s.knock && t.applyKnock) t.applyKnock(a, s.knock);
        // 近战打出硬直：这是近战能贴身的关键
        if (ent.isPlayer && !t.isBoss && t.stunT !== undefined) {
          t.stunT = Math.max(t.stunT, s.stun);
        }
        // 天赋：旋风斩（近战击杀触发）
        if (ent.isPlayer && t.dead && ent.mods.whirl && ent.whirlCd <= 0) {
          ent.whirlCd = 3;
          game.whirl(ent, s.dmg * 0.8);
        }
      }
      // 击落 / 反弹敌方子弹
      if (s.deflect && ent.isPlayer) {
        const canReflect = ent.mods.reflect;
        for (let k = game.bullets.length - 1; k >= 0; k--) {
          const b = game.bullets[k];
          if (b.friendly) continue;
          const d = SK.dist(ent.x, ent.y, b.x, b.y);
          if (d > s.reach + 6) continue;
          const a = SK.angleTo(ent.x, ent.y, b.x, b.y);
          if (Math.abs(SK.angDiff(s.ang, a)) > s.arc / 2) continue;
          game.spark(b.x, b.y, '#ffffff', 5);
          if (canReflect) {
            // 反弹成自己的子弹，朝着原来的挥砍方向飞回去
            b.friendly = true;
            b.vx = Math.cos(s.ang) * 420;
            b.vy = Math.sin(s.ang) * 420;
            b.dmg = Math.max(4, b.dmg * 1.6);
            b.life = 1.1;
            b.hitSet = null;
            b.pierce = 0;
            game.spark(b.x, b.y, '#9ef8ff', 6);
          } else {
            game.bullets.splice(k, 1);
          }
        }
      }
    }
  };

  /* ------------------------------ 光束（激光） ------------------------------ */
  SK.castBeam = function (game, ent, ang, w, ox, oy, charge) {
    const cr = charge || 0;
    const maxD = w.range;
    let ex = ox, ey = oy;
    const step = 4;
    let d = 0;
    while (d < maxD) {
      const nx = ox + Math.cos(ang) * d, ny = oy + Math.sin(ang) * d;
      if (game.solidPx(nx, ny)) break;
      ex = nx; ey = ny;
      d += step;
    }
    // 沿光束命中
    const dx = Math.cos(ang), dy = Math.sin(ang);
    const targets = ent.isPlayer ? game.enemies : [game.player];
    const dmg = w.dmg * (1 + ((w.charge ? w.charge.mul : 1) - 1) * cr);
    for (const t of targets) {
      if (!t || t.dead) continue;
      const px = t.x - ox, py = t.y - oy;
      const proj = px * dx + py * dy;
      if (proj < 0 || proj > d) continue;
      const perp = Math.abs(px * dy - py * dx);
      if (perp > t.r + 4 + cr * 4) continue;
      t.hurt(dmg, ang, game, false);
      game.spark(t.x, t.y, w.bullet.color, 8);
    }
    game.lasers.push({
      x: ox, y: oy, tx: ex, ty: ey, life: 0.13 + cr * 0.1, maxLife: 0.13 + cr * 0.1,
      color: w.bullet.color, r: (w.bullet.r || 2.2) * (1 + cr * 0.9)
    });
    return { ex, ey };
  };
})();
