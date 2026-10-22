/* ============================================================
   entities.js —— 玩家 / 敌人 / 子弹 / 掉落
   ============================================================ */
(function () {
  'use strict';
  const SK = window.SK;

  /* ======================= 角色 ======================= */
  SK.CHARS = [
    {
      id: 'knight', name: '骑士', desc: '护甲厚实，站桩硬刚',
      hp: 8, armor: 8, energy: 150, speed: 112, weapon: 'pistol',
      perkName: '铁壁', perk: { armorFast: true, dmgTake: 0.85 },
      pal: { h: '#c8d4e4', f: '#f2c79a', b: '#4a7ec8', l: '#5a4632' }
    },
    {
      id: 'wizard', name: '法师', desc: '能量充沛，弹幕糊脸',
      hp: 6, armor: 4, energy: 280, speed: 108, weapon: 'staff',
      perkName: '灵泉', perk: { energyFast: true },
      pal: { h: '#8a5ae0', f: '#f2c79a', b: '#6a3ab0', l: '#2a1a3a' }
    },
    {
      id: 'ranger', name: '游侠', desc: '身法灵活，暴击流',
      hp: 7, armor: 5, energy: 200, speed: 126, weapon: 'bow',
      perkName: '鹰眼', perk: { crit: 0.22 },
      pal: { h: '#4caf50', f: '#f2c79a', b: '#3f7a44', l: '#3a3a1a' }
    },
    {
      id: 'rogue', name: '刺客', desc: '双段冲刺，贴脸爆发',
      hp: 6, armor: 4, energy: 180, speed: 120, weapon: 'sword',
      perkName: '疾影', perk: { dash2: true },
      pal: { h: '#3a3a4e', f: '#d8b090', b: '#4a4a62', l: '#22222e' }
    }
  ];

  let uid = 1;

  /* ======================= 天赋（肉鸽成长） =======================
     参考老版本元气骑士：几乎全是「改机制」而不是「加数值」。
     =============================================================== */
  SK.TALENTS = [
    // ---- 弹道改造 ----
    { id: 'bounce', name: '子弹弹射', tag: '弹道', desc: '子弹撞墙会反弹一次', apply(p) { p.mods.bounce += 1; } },
    { id: 'critpierce', name: '暴击穿透', tag: '弹道', desc: '暴击的子弹会继续穿透敌人', apply(p) { p.mods.critPierce = true; } },
    { id: 'split', name: '子弹分裂', tag: '弹道', desc: '子弹命中时 45% 概率向两侧再射出一发', apply(p) { p.mods.split += 0.45; } },
    { id: 'pellets', name: '散弹增加', tag: '弹道', desc: '多发武器的弹丸数 +2', apply(p) { p.mods.extraPellets += 2; } },
    { id: 'heavy', name: '重弹头', tag: '弹道', desc: '子弹变大 35%，击退 +60%', apply(p) { p.mods.bulletSize *= 1.35; p.mods.knock *= 1.6; } },
    { id: 'slowbullet', name: '子弹减速', tag: '控场', desc: '敌方子弹速度 -35%，拾取范围扩大', apply(p) { p.mods.enemySlow *= 0.65; p.mods.magnet += 1; } },

    // ---- 近战 ----
    { id: 'melee_wide', name: '近战扩大', tag: '近战', desc: '挥砍范围 +35%', apply(p) { p.mods.reach *= 1.35; } },
    { id: 'reflect', name: '近战反弹', tag: '近战', desc: '挥砍打掉的子弹会反弹成你的子弹', apply(p) { p.mods.reflect = true; } },
    { id: 'whirl', name: '旋风斩', tag: '近战', desc: '近战击杀时释放环形斩，冷却 3 秒', apply(p) { p.mods.whirl += 1; } },

    // ---- 生存机制 ----
    { id: 'armorbreak', name: '破甲冲击', tag: '生存', desc: '护甲被打破时释放冲击波，伤害并击退周围敌人', apply(p) { p.mods.armorBreak = true; } },
    { id: 'armorfix', name: '破甲修复', tag: '生存', desc: '护甲破碎时立刻恢复 50%，30 秒一次', apply(p) { p.mods.armorFix = true; } },
    { id: 'walkarmor', name: '疾步生甲', tag: '生存', desc: '移动时持续恢复护甲', apply(p) { p.mods.walkArmor += 1; } },
    { id: 'spike', name: '刺盾', tag: '生存', desc: '免疫敌人的身体碰撞伤害', apply(p) { p.mods.noContact = true; } },

    // ---- 击杀特效 ----
    { id: 'corpse', name: '尸爆', tag: '击杀', desc: '敌人死亡时 35% 概率爆炸', apply(p) { p.mods.corpse += 0.35; } },
    { id: 'lifedrop', name: '击败回血', tag: '击杀', desc: '击杀敌人必掉生命球', apply(p) { p.mods.lifeDrop = true; } },
    { id: 'energydrop', name: '击败回蓝', tag: '击杀', desc: '击杀敌人必掉能量球', apply(p) { p.mods.energyDrop = true; } },
    { id: 'frenzy', name: '愈战愈勇', tag: '击杀', desc: '每次击杀叠加攻速，最多 5 层', apply(p) { p.mods.frenzy += 1; } },

    // ---- 暴击 ----
    { id: 'bloodrage', name: '血怒', tag: '暴击', desc: '生命/护甲越低，暴击率和攻速越高', apply(p) { p.mods.bloodRage = true; } },
    { id: 'fullhp', name: '满血暴击', tag: '暴击', desc: '攻击满血敌人必定暴击', apply(p) { p.mods.fullHpCrit = true; } },
    { id: 'storm', name: '雷暴', tag: '暴击', desc: '暴击时在目标处落下闪电', apply(p) { p.mods.storm = true; } },

    // ---- 经济 ----
    { id: 'halfshop', name: '商店半价', tag: '经济', desc: '商店所有商品半价', apply(p) { p.mods.shopHalf = true; } },
    { id: 'greed', name: '贪婪', tag: '经济', desc: '金币 +60%', apply(p) { p.mods.gold *= 1.6; } },
    { id: 'goldarmor', name: '金盾', tag: '经济', desc: '每 100 金币 +1 护甲上限（最多 +3）', apply(p) { p.mods.goldArmor = true; } }
  ];

  /* ======================= 玩家 ======================= */
  SK.Player = class Player {
    constructor(char, x, y) {
      this.id = uid++;
      this.charId = char.id;
      this.char = char;
      this.pal = char.pal;
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.r = 5;
      this.isPlayer = true;
      this.dead = false;

      this.maxHp = char.hp; this.hp = char.hp;
      this.maxArmor = char.armor; this.armor = char.armor;
      this.maxEnergy = char.energy; this.energy = char.energy;
      this.speed = char.speed;
      this.perk = char.perk || {};

      this.coins = 0;
      this.kills = 0;

      this.slots = [SK.makeWeapon(char.weapon, SK.WEAPONS[char.weapon].tier), null];
      this.slot = 0;

      this.aimAng = 0;
      this.facing = 1;
      this.fireCd = 0;
      this.muzzle = 0;
      this.swinging = 0;
      this.swingDur = 1;
      this.walkT = 0;
      this.walkPhase = 0;
      this.moving = false;

      this.dashTime = 0;
      this.dashCd = 0;
      this.dashMax = 0.95;
      this.dashDirX = 1; this.dashDirY = 0;
      this.dashCharges = this.perk.dash2 ? 2 : 1;
      this.dashChargeMax = this.dashCharges;
      this.dashRegen = 0;

      this.invuln = 0;
      this.hurtT = 0;
      this.armorDelay = 0;
      this.noEnergyT = 0;
      this.orbiting = 0;
      this.lifestealAcc = 0;

      // 天赋加成容器
      this.mods = {
        dmgRanged: 1, dmgMelee: 1, reach: 1, speed: 1, rate: 1,
        crit: 0, pierce: 0, regen: 1, gold: 1, lifesteal: 0, thorns: 0,
        dashExtra: 0, dashCd: 1, energyCost: 1, slowShot: 0,
        knock: 1, bulletSize: 1, bounce: 0,
        // 机制型天赋
        critPierce: false, split: 0, extraPellets: 0, enemySlow: 1, magnet: 0,
        reflect: false, whirl: 0, armorBreak: false, armorFix: false,
        walkArmor: 0, noContact: false, corpse: 0, lifeDrop: false,
        energyDrop: false, frenzy: 0, bloodRage: false, fullHpCrit: false,
        storm: false, shopHalf: false, goldArmor: false
      };
      this.talents = [];
      this.charge = 0;
      this.comboIdx = 0;
      this.comboT = 0;
      this.killStreak = 0;
      this.killStreakT = 0;
      this.whirlCd = 0;
      this.armorFixCd = 0;
      this.armorBreakMark = false;
      this.baseMaxArmor = char.armor;
      this.goldArmorBonus = 0;
    }

    pickTalent(t) {
      if (!t) return;
      t.apply(this);
      this.talents.push(t.id);
    }

    onKill(game) {
      this.killStreak = Math.min(9, this.killStreak + 1);
      this.killStreakT = 4;
      if (this.mods.lifesteal > 0) {
        this.lifestealAcc += this.mods.lifesteal;
        if (this.lifestealAcc >= 1) {
          const n = Math.floor(this.lifestealAcc);
          this.lifestealAcc -= n;
          this.heal(n);
          game.floatText(this.x, this.y - 14, '+' + n, '#7dff9a');
        }
      }
    }

    hurtRatio() {
      const hpR = 1 - this.hp / this.maxHp;
      const arR = this.maxArmor > 0 ? 1 - this.armor / this.maxArmor : 0;
      return SK.clamp(Math.max(hpR, arR), 0, 1);
    }

    rateMul() {
      let r = this.mods.rate;
      if (this.mods.frenzy) r *= 1 + Math.min(5, this.killStreak) * 0.07;
      if (this.mods.bloodRage) r *= 1 + this.hurtRatio() * 0.35;
      return r;
    }

    critBonus() {
      let c = this.mods.crit;
      if (this.mods.bloodRage) c += this.hurtRatio() * 0.3;
      return c;
    }

    onArmorBreak(game) {
      if (this.mods.armorBreak) {
        game.shake(5);
        game.explode(this.x, this.y, 48, 16, true);
        SK.Sound.explode();
      }
      if (this.mods.armorFix && this.armorFixCd <= 0) {
        this.armorFixCd = 30;
        this.armor = this.maxArmor * 0.5;
        game.floatText(this.x, this.y - 16, '护甲修复', '#7ad8ff');
        game.spark(this.x, this.y, '#7ad8ff', 12);
      }
    }

    get weapon() { return this.slots[this.slot]; }

    update(dt, game) {
      if (this.dead) return;
      const I = SK.Input;
      const mx = (I.anyDown(['KeyD', 'ArrowRight']) ? 1 : 0) - (I.anyDown(['KeyA', 'ArrowLeft']) ? 1 : 0);
      const my = (I.anyDown(['KeyS', 'ArrowDown']) ? 1 : 0) - (I.anyDown(['KeyW', 'ArrowUp']) ? 1 : 0);
      const len = Math.hypot(mx, my);
      let tx = 0, ty = 0;
      const spd = this.speed * this.mods.speed;
      if (len > 0) { tx = (mx / len) * spd; ty = (my / len) * spd; }
      this.moving = len > 0;

      // ---- 瞄准 ----
      const wm = game.mouseWorld();
      this.aimAng = SK.angleTo(this.x, this.y - 1, wm.x, wm.y);
      if (Math.abs(Math.cos(this.aimAng)) > 0.15) this.facing = Math.cos(this.aimAng) < 0 ? -1 : 1;

      // ---- 冲刺 ----
      this.dashCd -= dt;
      if (this.dashCharges < this.dashChargeMax) {
        this.dashRegen += dt;
        const need = (this.perk.dash2 ? 0.85 : 1.0) * this.mods.dashCd;
        if (this.dashRegen >= need) { this.dashRegen = 0; this.dashCharges++; }
      }
      if (this.dashTime > 0) {
        this.dashTime -= dt;
        this.vx = this.dashDirX * 430;
        this.vy = this.dashDirY * 430;
        this.invuln = Math.max(this.invuln, 0.06);
        if (Math.random() < 0.7) game.spark(this.x, this.y + 2, '#8fe0ff', 1, 0.3);
      } else if (I.pressed('Space') && this.dashCharges > 0) {
        let dx = mx, dy = my;
        if (dx === 0 && dy === 0) { dx = Math.cos(this.aimAng); dy = Math.sin(this.aimAng); }
        const l2 = Math.hypot(dx, dy) || 1;
        this.dashDirX = dx / l2; this.dashDirY = dy / l2;
        this.dashTime = 0.15;
        this.dashCharges--;
        this.dashRegen = 0;
        this.invuln = Math.max(this.invuln, 0.2);
        SK.Sound.dash();
        game.spark(this.x, this.y, '#8fe0ff', 8, 0.6);
      } else {
        // 惯性
        const acc = this.moving ? 16 : 12;
        this.vx += (tx - this.vx) * Math.min(1, dt * acc);
        this.vy += (ty - this.vy) * Math.min(1, dt * acc);
      }

      game.moveEnt(this, dt);

      // 走路动画
      if (this.moving && this.dashTime <= 0) {
        this.walkPhase += dt * 9;
        this.walkT += dt * 9;
      } else {
        this.walkT = 0;
      }

      // ---- 计时器 ----
      if (this.invuln > 0) this.invuln -= dt;
      if (this.hurtT > 0) this.hurtT -= dt;
      if (this.muzzle > 0) this.muzzle -= dt;
      if (this.swinging > 0) this.swinging -= dt;
      if (this.noEnergyT > 0) this.noEnergyT -= dt;

      // ---- 攻击 ----
      this.fireCd -= dt;
      if (this.comboT > 0) {
        this.comboT -= dt;
        if (this.comboT <= 0) this.comboIdx = 0;
      }
      const wp = this.weapon;
      const costOf = (w) => (w.energy > 0 ? Math.max(1, Math.round(w.energy * this.mods.energyCost)) : 0);

      if (wp && wp.charge && wp.kind === 'ranged') {
        // 蓄力武器：按住蓄力，满蓄自动放；提前松手放弱一发
        const ct = wp.charge.time;
        if (I.mouse.down && this.fireCd <= 0) {
          const cost = costOf(wp);
          if (cost > 0 && this.energy < cost) {
            if (this.noEnergyT <= 0) { SK.Sound.deny(); this.noEnergyT = 0.7; game.toast('能量不够！'); }
            this.charge = 0;
          } else {
            this.charge = Math.min(ct, this.charge + dt);
            if (this.charge >= ct) {
              this.energy -= cost;
              this.fireCd = wp.cd / this.rateMul();
              SK.attack(wp, this, this.aimAng, game, 1);
              this.charge = 0;
            }
          }
        } else {
          if (this.charge > 0.12) {
            const r = SK.clamp(this.charge / ct, 0, 1);
            const cost = costOf(wp);
            if (cost > 0 && this.energy >= cost) {
              this.energy -= cost;
              this.fireCd = (wp.cd / this.rateMul()) * 0.5;
              SK.attack(wp, this, this.aimAng, game, r);
            }
          }
          this.charge = 0;
        }
      } else if (wp && I.mouse.down && this.fireCd <= 0) {
        const cost = costOf(wp);
        if (cost > 0 && this.energy < cost) {
          if (this.noEnergyT <= 0) { SK.Sound.deny(); this.noEnergyT = 0.7; game.toast('能量不够！'); }
        } else {
          this.energy -= cost;
          this.fireCd = wp.cd / this.rateMul();
          SK.attack(wp, this, this.aimAng, game, 0);
        }
      }
      // 换武器
      if (I.pressed('KeyQ') || I.pressed('Digit1') || I.pressed('Digit2') || I.mouse.wheel) {
        let next = this.slot;
        if (I.pressed('Digit1')) next = 0;
        else if (I.pressed('Digit2')) next = 1;
        else next = 1 - this.slot;
        if (this.slots[next]) { this.slot = next; this.fireCd = Math.max(this.fireCd, 0.1); this.charge = 0; SK.Sound.tone(600, 0.05, 'square', 0.05); }
      }

      SK.updateSwings(this, dt, game);

      // ---- 能量 / 护甲恢复 ----
      const eRate = (this.perk.energyFast ? 9 : 4.5) * this.mods.regen;
      this.energy = Math.min(this.maxEnergy, this.energy + eRate * dt);
      if (this.armorDelay > 0) this.armorDelay -= dt;
      else if (this.armor < this.maxArmor) {
        this.armor = Math.min(this.maxArmor, this.armor + (this.perk.armorFast ? 2.2 : 1.4) * dt);
      }
      // 疾步生甲：移动时也在回护甲
      if (this.mods.walkArmor && this.moving) {
        this.armor = Math.min(this.maxArmor, this.armor + 1.1 * this.mods.walkArmor * dt);
      }
      // 金盾：每 100 金币 +1 护甲上限
      if (this.mods.goldArmor) {
        const bonus = Math.min(3, Math.floor(this.coins / 100));
        if (bonus !== this.goldArmorBonus) {
          this.maxArmor += bonus - this.goldArmorBonus;
          this.goldArmorBonus = bonus;
        }
      }
      // 连杀计时
      if (this.killStreakT > 0) {
        this.killStreakT -= dt;
        if (this.killStreakT <= 0) this.killStreak = 0;
      }
      if (this.whirlCd > 0) this.whirlCd -= dt;
      if (this.armorFixCd > 0) this.armorFixCd -= dt;
      if (this.orbiting > 0) this.orbiting -= dt;
    }

    hurt(dmg, ang, game) {
      if (this.dead || this.invuln > 0) return false;
      let d = Math.round(dmg * (this.perk.dmgTake || 1));
      this.invuln = 0.75;
      this.hurtT = 0.32;
      this.armorDelay = 3.6;
      const hadArmor = this.armor > 0;
      if (this.armor > 0) {
        const use = Math.min(Math.ceil(this.armor), d);
        this.armor = Math.max(0, this.armor - use);
        d -= use;
        game.spark(this.x, this.y, '#7ad8ff', 8);
      }
      if (hadArmor && this.armor <= 0) this.onArmorBreak(game);
      if (d > 0) {
        this.hp -= d;
        game.spark(this.x, this.y, '#ff5a6e', 10);
        game.floatText(this.x, this.y - 12, '-' + Math.round(d), '#ff8a96');
      }
      if (ang != null) {
        this.vx += Math.cos(ang) * 150;
        this.vy += Math.sin(ang) * 150;
      }
      game.shake(5);
      game.hitStop = Math.max(game.hitStop, 0.06);
      SK.Sound.hurt();
      // 荆棘之甲
      if (this.mods.thorns > 0) {
        for (let i = game.enemies.length - 1; i >= 0; i--) {
          const e = game.enemies[i];
          if (SK.dist(this.x, this.y, e.x, e.y) < 34 + e.r) {
            e.hurt(this.mods.thorns, SK.angleTo(this.x, this.y, e.x, e.y), game, false);
            game.spark(e.x, e.y, '#b8ff9a', 5);
          }
        }
      }
      if (this.hp <= 0) {
        this.hp = 0;
        this.dead = true;
        game.onPlayerDeath();
      }
      return true;
    }

    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
    addEnergy(n) { this.energy = Math.min(this.maxEnergy, this.energy + n); }
    addCoin(n) { this.coins += n; }
    giveWeapon(w) {
      // 优先填空槽，否则替换当前槽；返回被替换下来的旧武器
      let idx;
      if (!this.slots[0]) idx = 0;
      else if (!this.slots[1]) idx = 1;
      else idx = this.slot;
      const old = this.slots[idx] || null;
      this.slots[idx] = w;
      return old;
    }
    swapTo(i) { if (this.slots[i]) this.slot = i; }
  };

  /* ======================= 敌人数据 ======================= */
  const TYPES = (SK.ENEMY_TYPES = {
    slime: {
      hp: 20, spd: 34, r: 7, dmg: 2, ai: 'hop', sprite: 'slime',
      color: '#4ec06a', color2: '#c8ffd4', coins: 2, weight: 3
    },
    bat: {
      hp: 13, spd: 78, r: 6, dmg: 2, ai: 'bat', sprite: 'bat',
      color: '#8a6ad0', coins: 2, weight: 3
    },
    goblin: {
      hp: 28, spd: 54, r: 7, dmg: 3, ai: 'chase', sprite: 'goblin',
      color: '#5e8a36', color2: '#86b84a', coins: 3, weight: 3
    },
    archer: {
      hp: 22, spd: 40, r: 7, dmg: 2, ai: 'ranged', sprite: 'archer',
      color: '#3a6a7a', color2: '#4a9aa0', coins: 4, weight: 2
    },
    bomber: {
      hp: 18, spd: 66, r: 7, dmg: 8, ai: 'bomb', sprite: 'bomber',
      color: '#e0703a', coins: 3, weight: 2
    },
    knight: {
      hp: 56, spd: 42, r: 9, dmg: 5, ai: 'chase', sprite: 'knight',
      color: '#8a94a8', color2: '#c8d4e8', coins: 8, weight: 1, elite: true
    }
  });

  /* ======================= 敌人 ======================= */
  SK.Enemy = class Enemy {
    constructor(type, x, y, floorNum) {
      const d = TYPES[type] || TYPES.slime;
      this.id = uid++;
      this.type = type;
      this.def = d;
      this.sprite = d.sprite;
      this.ai = d.ai;
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.kx = 0; this.ky = 0;
      this.r = d.r;
      this.dead = false;
      this.elite = !!d.elite;

      const f = Math.max(0, (floorNum || 1) - 1);
      this.maxHp = Math.round(d.hp * (1 + 0.55 * f));
      this.hp = this.maxHp;
      this.speed = d.spd * (1 + 0.05 * f);
      this.dmg = d.dmg + Math.floor(f * 0.7);
      this.coins = d.coins + f;
      this.color = d.color;
      this.color2 = d.color2;
      this.baseSpeed = this.speed;

      this.seed = Math.random() * 10;
      this.flash = 0;
      this.hopT = 0;
      this.aiT = SK.rand(0.2, 0.9);
      this.dir = 0;
      this.face = 1;
      this.telegraph = 0;
      this.shootT = SK.rand(0.8, 1.8);
      this.fuse = 0;
      this.slowT = 0;
      this.touchCd = 0;
      this.lungeT = 0;
      this.isBoss = false;
      // 近战攻击状态机
      this.atkState = 'idle';
      this.atkT = SK.rand(0.25, 0.7);
      this.stunT = 0;
      this.windupT = 0.42;
      this.recoverT = 0.45;
      this.atkCd = 0.5;
    }

    applyKnock(ang, force) {
      if (this.isBoss) force *= 0.25;
      this.kx += Math.cos(ang) * force;
      this.ky += Math.sin(ang) * force;
    }

    update(dt, game) {
      if (this.dead) return;
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      if (Math.abs(dx) > 2) this.face = dx < 0 ? -1 : 1;

      this.flash = Math.max(0, this.flash - dt * 6);
      this.touchCd -= dt;
      if (this.slowT > 0) this.slowT -= dt;
      const spd = this.speed * (this.slowT > 0 ? 0.45 : 1);
      this.vx = 0; this.vy = 0;

      // 硬直：被近战打中后完全停手，这是近战能玩的关键反馈
      if (this.stunT > 0) {
        this.stunT -= dt;
        this.flash = Math.max(this.flash, 0.34);
        this.atkState = 'idle';
        this.atkT = Math.max(this.atkT, 0.25);
        this.kx *= Math.pow(0.03, dt);
        this.ky *= Math.pow(0.03, dt);
        game.moveEnt(this, dt);
        return;
      }

      switch (this.ai) {
        case 'hop': {
          this.hopT -= dt;
          this.aiT -= dt;
          if (this.hopT > 0) {
            this.vx = ux * spd * 2.1;
            this.vy = uy * spd * 2.1;
          } else if (this.aiT <= 0) {
            this.aiT = SK.rand(0.55, 1.05);
            this.hopT = 0.34;
            this.dir = Math.atan2(dy, dx);
          }
          break;
        }
        case 'bat': {
          const wob = Math.sin(game.time * 7 + this.seed) * 0.85;
          const a = Math.atan2(dy, dx) + wob;
          this.vx = Math.cos(a) * spd;
          this.vy = Math.sin(a) * spd;
          break;
        }
        case 'chase': {
          // 追击 + 周期性扑咬
          this.aiT -= dt;
          if (this.aiT <= 0) {
            this.aiT = SK.rand(1.3, 2.1);
            this.lungeT = 0.32;
          }
          if (this.lungeT > 0) {
            this.lungeT -= dt;
            this.vx = ux * spd * 2.3;
            this.vy = uy * spd * 2.3;
          } else {
            this.vx = ux * spd;
            this.vy = uy * spd;
          }
          break;
        }
        case 'ranged': {
          this.shootT -= dt;
          const want = 132;
          if (d > want + 20) { this.vx = ux * spd; this.vy = uy * spd; }
          else if (d < want - 34) { this.vx = -ux * spd; this.vy = -uy * spd; }
          else {
            // 侧向绕圈
            const s = Math.sin(game.time * 1.4 + this.seed) > 0 ? 1 : -1;
            this.vx = -uy * spd * 0.9 * s;
            this.vy = ux * spd * 0.9 * s;
          }
          if (this.telegraph > 0) {
            this.telegraph -= dt;
            this.vx *= 0.2; this.vy *= 0.2;
            if (this.telegraph <= 0) {
              game.enemyShot(this.x, this.y - 2, Math.atan2(dy, dx), 165, this.dmg, { color: '#ff9a5a', kind: 'arrow', r: 2.4, life: 2.2 });
              this.shootT = SK.rand(1.3, 2.1);
              this.telegraph = 0;
            }
          } else if (this.shootT <= 0) {
            this.telegraph = 0.34;
          }
          break;
        }
        case 'bomb': {
          if (this.fuse > 0) {
            this.fuse -= dt;
            this.vx *= 0.1; this.vy *= 0.1;
            if (this.fuse <= 0) this.explode(game);
          } else {
            this.vx = ux * spd;
            this.vy = uy * spd;
            if (d < 34) { this.fuse = 0.8; SK.Sound.warn(); }
          }
          break;
        }
        default:
          this.vx = ux * spd;
          this.vy = uy * spd;
      }

      // 速度修正：起手/硬直时几乎不动
      let spd2 = spd;
      if (this.atkState === 'windup') spd2 *= 0.12;
      else if (this.atkState === 'recover') spd2 *= 0.3;
      if (this.atkState !== 'idle') { this.vx *= spd2 / Math.max(1, spd); this.vy *= spd2 / Math.max(1, spd); }

      // 移动
      this.kx *= Math.pow(0.03, dt);
      this.ky *= Math.pow(0.03, dt);
      game.moveEnt(this, dt);

      // ===== 近战攻击状态机：有前摇，可以躲；出手瞬间才判定 =====
      if (this.ai !== 'bomb' && !this.isBoss) {
        if (this.atkState === 'windup') {
          this.atkT -= dt;
          if (this.atkT <= 0) {
            this.atkState = 'strike';
            this.atkT = 0.14;
            if (d < this.r + p.r + 15) {
              p.hurt(this.dmg, Math.atan2(dy, dx), game);
            }
            game.spark(this.x + ux * this.r, this.y + uy * this.r, '#ffb03a', 7, 0.6);
            SK.Sound.swing();
          }
        } else if (this.atkState === 'strike') {
          this.atkT -= dt;
          if (this.atkT <= 0) { this.atkState = 'recover'; this.atkT = this.recoverT; }
        } else if (this.atkState === 'recover') {
          this.atkT -= dt;
          if (this.atkT <= 0) { this.atkState = 'idle'; this.atkT = this.atkCd; }
        } else {
          this.atkT -= dt;
          if (this.atkT <= 0 && d < this.r + p.r + 17 && !p.dead) {
            this.atkState = 'windup';
            this.atkT = this.windupT;
            this.face = dx < 0 ? -1 : 1;
          }
        }
      }

      if (this.stunT > 0) this.stunT -= dt;
    }

    explode(game) {
      game.explode(this.x, this.y, 40, this.dmg * 1.4, false);
      this.die(game, true);
    }

    hurt(dmg, ang, game, crit) {
      if (this.dead) return;
      this.hp -= dmg;
      this.flash = 0.5;
      game.floatText(this.x, this.y - this.r - 3, String(Math.round(dmg)), crit ? '#ffd35c' : '#ffffff');
      if (this.hp <= 0) this.die(game);
    }

    die(game, silent) {
      if (this.dead) return;
      this.dead = true;
      game.enemies.splice(game.enemies.indexOf(this), 1);
      if (!silent) SK.Sound.enemyDie();
      game.spawnDeathBurst(this);
      game.player.kills++;
      game.killCount++;
      game.player.onKill(game);
      // 掉落
      let left = this.coins;
      const n = Math.min(4, Math.max(1, Math.ceil(left / 2)));
      for (let i = 0; i < n; i++) {
        const v = Math.max(1, Math.round(left / (n - i)));
        left -= v;
        game.dropPickup('coin', this.x + SK.rand(-6, 6), this.y + SK.rand(-6, 6), { value: v });
      }
      if (SK.chance(this.elite ? 0.6 : 0.11)) {
        game.dropPickup(SK.chance(0.55) ? 'hp' : 'energy', this.x, this.y, {});
      }
      // 天赋：击败回血 / 回蓝
      const pm = game.player.mods;
      if (pm && pm.lifeDrop) game.dropPickup('hp', this.x + SK.rand(-6, 6), this.y, {});
      if (pm && pm.energyDrop) game.dropPickup('energy', this.x + SK.rand(-6, 6), this.y, {});
      // 天赋：尸爆
      if (pm && pm.corpse > 0 && SK.chance(pm.corpse)) {
        game.explode(this.x, this.y, 36, 13, true);
      }
      if (this.elite) {
        game.dropWeapon(this.x + 8, this.y);
      } else if (SK.chance(0.07)) {
        game.dropWeapon(this.x + 6, this.y);
      }
      if (this.onDeath) this.onDeath(game);
    }
  };

  /* ======================= BOSS ======================= */
  SK.BOSSES = {
    slimeKing: {
      key: 'slimeKing', name: '史莱姆王', sprite: 'bossSlime',
      hp: 300, r: 19, color: '#3fae62', color2: '#8affa8', coins: 55, dmg: 3
    },
    golem: {
      key: 'golem', name: '熔岩守卫', sprite: 'bossGolem',
      hp: 400, r: 18, color: '#8a6a5a', color2: '#c8a488', coins: 65, dmg: 4
    },
    mage: {
      key: 'mage', name: '霜语巫妖', sprite: 'bossMage',
      hp: 380, r: 16, color: '#6a4aa0', color2: '#4a3a70', coins: 75, dmg: 3
    }
  };

  SK.Boss = class Boss extends SK.Enemy {
    constructor(key, x, y, floorNum) {
      const d = SK.BOSSES[key];
      super('slime', x, y, 1);
      this.bossKey = key;
      this.def = d;
      this.type = 'boss';
      this.isBoss = true;
      this.sprite = d.sprite;
      this.ai = 'boss';
      this.r = d.r;
      this.maxHp = Math.round(d.hp * (1 + 0.12 * (floorNum - 1)));
      this.hp = this.maxHp;
      this.coins = d.coins;
      this.dmg = d.dmg;
      this.color = d.color;
      this.color2 = d.color2;
      this.speed = 46;
      this.name = d.name;
      this.act = null;
      this.actT = 1.2;
      this.hopT = 0;
      this.invulnT = 0;
      this.fade = 1;
      this.vx = 0; this.vy = 0;
    }

    update(dt, game) {
      if (this.dead) return;
      const p = game.player;
      const dx = p.x - this.x, dy = p.y - this.y;
      const d = Math.hypot(dx, dy) || 1;
      const ux = dx / d, uy = dy / d;
      this.flash = Math.max(0, this.flash - dt * 6);
      this.touchCd -= dt;
      this.vx = 0; this.vy = 0;
      this.invulnT -= dt;

      // 靠近玩家
      if (!this.act || this.act.name !== 'charge') {
        if (d > 60) { this.vx = ux * this.speed; this.vy = uy * this.speed; }
      }

      if (this.act) this.runAct(dt, game, ux, uy, d);
      else {
        this.actT -= dt;
        if (this.actT <= 0) this.chooseAct(game, d);
      }

      this.kx *= Math.pow(0.002, dt);
      this.ky *= Math.pow(0.002, dt);
      game.moveEnt(this, dt);

      if (this.touchCd <= 0 && d < this.r + p.r) {
        if (p.hurt(this.dmg, Math.atan2(dy, dx), game)) this.touchCd = 0.6;
      }
    }

    chooseAct(game, d) {
      const seq = {
        slimeKing: ['slam', 'spread', 'summon', 'slam'],
        golem: ['charge', 'meteor', 'gapring', 'charge'],
        mage: ['blink', 'orbs', 'frost', 'blink']
      }[this.bossKey];
      if (!this.seq || this.seqIdx == null) { this.seq = seq; this.seqIdx = 0; }
      const name = this.seq[this.seqIdx % this.seq.length];
      this.seqIdx++;
      this.act = { name: name, t: 0, step: 0, fired: 0 };
      this.actT = 0;
      const dur = {
        slam: 1.0, spread: 1.4, summon: 0.7,
        charge: 0.9, meteor: 1.9, gapring: 1.1,
        blink: 0.6, orbs: 1.0, frost: 1.4
      }[name] || 1.0;
      this.act.t = dur;
      SK.Sound.warn();
    }

    runAct(dt, game, ux, uy, d) {
      const a = this.act;
      a.t -= dt;

      // ============ 史莱姆王 ============
      if (a.name === 'slam') {
        if (a.step === 0) {
          if (!a.warned) {
            a.warned = true;
            a.tx = game.player.x; a.ty = game.player.y;
            game.warnZone({ x: a.tx, y: a.ty, r: 54, t: 0.8, dmg: this.dmg + 2 });
          }
          if (a.t <= 0.15) {
            a.step = 1;
            game.shake(8); SK.Sound.explode();
            this.x = a.tx; this.y = a.ty;
            this.radial(game, 10, 150, this.dmg);
            game.spark(this.x, this.y, '#8affa8', 20, 1.3);
            a.t = 0.45;
          }
        } else if (a.t <= 0) this.endAct(1.0);
      } else if (a.name === 'spread') {
        if (a.fired < 3 && a.t < 1.4 - a.fired * 0.42) {
          a.fired++;
          const base = Math.atan2(game.player.y - this.y, game.player.x - this.x);
          for (let i = -2; i <= 2; i++) {
            if (i === 0) continue;   // 中间留缝
            game.enemyShot(this.x, this.y - 2, base + i * 0.18, 175, this.dmg,
              { color: '#9effb8', kind: 'orb', r: 3, life: 2.4 });
          }
          SK.Sound.shootHeavy();
        }
        if (a.t <= 0) this.endAct(1.1);
      } else if (a.name === 'summon') {
        if (!a.fired) {
          a.fired = 1;
          const kinds = ['slime', 'bat', 'goblin'];
          for (let i = 0; i < 2; i++) {
            game.spawnEnemy(kinds[(Math.random() * kinds.length) | 0], this.x + SK.rand(-30, 30), this.y + SK.rand(-20, 20));
          }
          game.spark(this.x, this.y, '#ffffff', 12, 0.9);
          SK.Sound.level();
        }
        if (a.t <= 0) this.endAct(1.3);

        // ============ 熔岩守卫 ============
      } else if (a.name === 'charge') {
        if (a.step === 0) {
          if (!a.warned) {
            a.warned = true;
            a.ang = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            game.warnZone({ kind: 'line', x: this.x, y: this.y, ang: a.ang, len: 260, w: 20, t: 0.75, dmg: this.dmg + 2 });
          }
          if (a.t <= 0.15) {
            a.step = 1; a.t = 0.42;
            SK.Sound.shootHeavy();
          }
        } else if (a.step === 1) {
          this.vx = Math.cos(a.ang) * 330;
          this.vy = Math.sin(a.ang) * 330;
          if (Math.random() < 0.6) game.spark(this.x, this.y + 6, '#ff7a3a', 1, 0.4);
          if (a.t <= 0) {
            a.step = 2; a.t = 0.5;
            game.shake(9); SK.Sound.explode();
            this.radial(game, 8, 130, this.dmg);
          }
        } else if (a.t <= 0) this.endAct(1.0);
      } else if (a.name === 'meteor') {
        if (a.fired < 4 && a.t < 1.9 - a.fired * 0.32) {
          const i = a.fired++;
          const ang = SK.rand(0, SK.TAU), rad = SK.rand(30, 110);
          game.warnZone({
            x: game.player.x + Math.cos(ang) * rad,
            y: game.player.y + Math.sin(ang) * rad,
            r: 34, t: 0.75, dmg: this.dmg + 1
          });
          if (i === 0) SK.Sound.warn();
        }
        if (a.t <= 0) this.endAct(1.2);
      } else if (a.name === 'gapring') {
        if (!a.fired) {
          a.fired = 1;
          const n = 16, gapA = SK.rand(0, SK.TAU);
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * SK.TAU;
            if (Math.abs(SK.angDiff(gapA, ang)) < 0.5) continue;   // 留一个缺口
            game.enemyShot(this.x, this.y, ang, 125, this.dmg, { color: '#ffb03a', kind: 'basic', r: 3.2, life: 3, glow: true });
          }
          SK.Sound.explode();
          game.shake(4);
        }
        if (a.t <= 0) this.endAct(1.3);

        // ============ 霜语巫妖 ============
      } else if (a.name === 'blink') {
        if (a.step === 0) {
          this.fade = Math.max(0, this.fade - dt * 4);
          if (a.t <= 0.2) {
            a.step = 1; a.t = 0.5;
            const ang = SK.rand(0, SK.TAU);
            const rad = SK.rand(70, 110);
            game.spark(this.x, this.y, '#a86aff', 14, 1);
            this.x = SK.clamp(game.player.x + Math.cos(ang) * rad, game.room.rect.x + 32, game.room.rect.x + SK.ROOM_PW - 32);
            this.y = SK.clamp(game.player.y + Math.sin(ang) * rad, game.room.rect.y + 32, game.room.rect.y + SK.ROOM_PH - 32);
            game.spark(this.x, this.y, '#a86aff', 14, 1);
            // 带缺口的环
            const n = 12, gapA = Math.atan2(game.player.y - this.y, game.player.x - this.x);
            for (let i = 0; i < n; i++) {
              const ang2 = (i / n) * SK.TAU;
              if (Math.abs(SK.angDiff(gapA, ang2)) < 0.45) continue;
              game.enemyShot(this.x, this.y, ang2, 130, this.dmg, { color: '#a86aff', kind: 'orb', r: 2.6, life: 2.4 });
            }
          }
        } else {
          this.fade = Math.min(1, this.fade + dt * 4);
          if (a.t <= 0) this.endAct(1.2);
        }
      } else if (a.name === 'orbs') {
        if (!a.fired && a.t < 0.75) {
          a.fired = 1;
          for (let i = -1; i <= 1; i++) {
            const ang = Math.atan2(game.player.y - this.y, game.player.x - this.x) + i * 0.5;
            const b = game.enemyShot(this.x, this.y, ang, 95, this.dmg, { color: '#9ef8ff', kind: 'orb', r: 3.2, life: 4.5 });
            const bb = game.bullets[game.bullets.length - 1];
            if (bb) bb.homing = 1.1;
          }
          SK.Sound.warn();
        }
        if (a.t <= 0) this.endAct(1.4);
      } else if (a.name === 'frost') {
        if (!a.fired) {
          a.fired = 1;
          game.warnZone({ x: game.player.x, y: game.player.y, r: 62, t: 1.0, dmg: this.dmg + 1 });
        }
        if (a.t <= 0) this.endAct(1.3);
      }
    }

    endAct(wait) {
      this.act = null;
      this.actT = wait;
    }

    radial(game, n, spd, dmg, off) {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * SK.TAU + (off || 0);
        game.enemyShot(this.x, this.y - 2, ang, spd, dmg, { color: '#9effb8', kind: 'basic', r: 3, life: 3, glow: true });
      }
    }

    ring(game, n, spd, dmg) {
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * SK.TAU;
        game.enemyShot(this.x, this.y, ang, spd, dmg, { color: '#ffb03a', kind: 'basic', r: 3.4, life: 3, glow: true });
      }
    }

    die(game, silent) {
      if (this.dead) return;
      this.dead = true;
      game.enemies.splice(game.enemies.indexOf(this), 1);
      SK.Sound.explode();
      SK.Sound.level();
      game.onBossDeath(this);
    }
  };

  /* ======================= 子弹 ======================= */
  SK.updateBullets = function (game, dt) {
    const list = game.bullets;
    for (let i = list.length - 1; i >= 0; i--) {
      const b = list[i];
      b.life -= dt;
      if (b.life <= 0) { list.splice(i, 1); continue; }

      if (b.trail) {
        game.spark(b.x, b.y, '#ffb03a', 1, 0.25);
      }

      // 追踪弹（缓慢转向玩家）
      if (b.homing) {
        const p = game.player;
        const cur = Math.atan2(b.vy, b.vx);
        const want = Math.atan2(p.y - b.y, p.x - b.x);
        const spd = Math.hypot(b.vx, b.vy);
        const na = cur + SK.clamp(SK.angDiff(cur, want), -b.homing * dt, b.homing * dt);
        b.vx = Math.cos(na) * spd;
        b.vy = Math.sin(na) * spd;
      }

      const steps = Math.max(1, Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 5));
      let removed = false;
      for (let s = 0; s < steps; s++) {
        const px = b.x, py = b.y;
        b.x += (b.vx * dt) / steps;
        b.y += (b.vy * dt) / steps;

        // 墙
        if (game.solidPx(b.x, b.y)) {
          if (b.bounce > 0 && !b.explode) {
            // 弹跳枪：按撞到的轴反射
            b.bounce--;
            const hitX = game.solidPx(px, b.y);
            const hitY = game.solidPx(b.x, py);
            if (hitX && !hitY) b.vx = -b.vx;
            else if (hitY && !hitX) b.vy = -b.vy;
            else { b.vx = -b.vx; b.vy = -b.vy; }
            b.x = px; b.y = py;
            game.spark(px, py, b.color, 3, 0.3);
            break;
          }
          if (b.explode) game.explode(px, py, b.explode, b.dmg * 0.5 + (b.explodeDmg || 0), b.friendly);
          else {
            game.spark(px, py, b.color, 3, 0.35);
            if (b.kind === 'rocket') SK.Sound.hit();
          }
          list.splice(i, 1);
          removed = true;
          break;
        }

        // 命中
        if (b.friendly) {
          let hitAny = false;
          for (let j = game.enemies.length - 1; j >= 0; j--) {
            const e = game.enemies[j];
            if (e.dead) continue;
            if (b.hitSet && b.hitSet.indexOf(e) >= 0) continue;
            if (SK.dist(b.x, b.y, e.x, e.y) > e.r + b.r) continue;
            hitAny = true;
            if (b.hitSet) b.hitSet.push(e); else b.hitSet = [e];
            const pm0 = game.player.mods;
            let crit = game.rollCrit();
            // 天赋：满血暴击
            if (pm0.fullHpCrit && e.hp >= e.maxHp) crit = true;
            const dmg = crit ? b.dmg * 2 : b.dmg;
            e.hurt(dmg, Math.atan2(b.vy, b.vx), game, crit);
            if (b.slow) e.slowT = b.slow * 2.4;
            if (b.knock) e.applyKnock(Math.atan2(b.vy, b.vx), b.knock);
            game.spark(b.x, b.y, crit ? '#ffd35c' : b.color, crit ? 8 : 4, 0.4);
            if (crit) SK.Sound.crit();
            // 天赋：雷暴
            if (crit && b.storm) game.lightning(e.x, e.y, dmg * 0.7);
            // 天赋：子弹分裂
            if (b.split > 0 && Math.random() < b.split) {
              const base = Math.atan2(b.vy, b.vx);
              for (let k = -1; k <= 1; k += 2) {
                const a2 = base + k * 1.15;
                game.addBullet({
                  x: b.x, y: b.y,
                  vx: Math.cos(a2) * 300, vy: Math.sin(a2) * 300,
                  r: b.r * 0.85, dmg: b.dmg * 0.7, friendly: true,
                  pierce: 0, bounce: 0, life: 0.55,
                  color: b.color, kind: 'basic', glow: true,
                  knock: 0, slow: 0, split: 0, critPierce: b.critPierce, storm: b.storm,
                  explode: 0, explodeDmg: 0, hitSet: null, trail: 0
                });
              }
            }
            // 天赋：暴击穿透
            if (crit && b.critPierce) b.pierce = Math.max(b.pierce, 1);
            if (b.explode) {
              game.explode(b.x, b.y, b.explode, b.dmg, true);
              list.splice(i, 1); removed = true;
              break;
            }
            if (b.pierce > 0) { b.pierce--; }
            else { list.splice(i, 1); removed = true; break; }
          }
          if (removed) break;
          if (hitAny) continue;
        } else {
          const p = game.player;
          if (!p.dead && SK.dist(b.x, b.y, p.x, p.y) < p.r + b.r) {
            if (b.explode) { game.explode(b.x, b.y, b.explode, b.dmg, false); }
            else p.hurt(b.dmg, Math.atan2(b.vy, b.vx), game);
            list.splice(i, 1);
            removed = true;
            break;
          }
        }
      }
      if (removed) continue;
      // 出界
      const rr = game.room.rect;
      if (b.x < rr.x + 8 || b.y < rr.y + 8 || b.x > rr.x + SK.ROOM_PW - 8 || b.y > rr.y + SK.ROOM_PH - 8) {
        if (b.explode) game.explode(b.x, b.y, b.explode, b.dmg * 0.5, b.friendly);
        list.splice(i, 1);
      }
    }
  };

  /* ======================= 掉落物 ======================= */
  SK.Pickup = class Pickup {
    constructor(kind, x, y, opt) {
      opt = opt || {};
      this.id = uid++;
      this.kind = kind;
      this.x = x; this.y = y;
      this.vx = opt.vx || SK.rand(-30, 30);
      this.vy = opt.vy || SK.rand(-50, -20);
      this.z = 0; this.vz = 0;
      this.settled = false;
      this.seed = Math.random() * 6.28;
      this.value = opt.value || 0;
      this.def = opt.def || null;
      this.tierColor = opt.tierColor || null;
      this.opened = false;
      this.price = opt.price || 0;
      this.item = opt.item || null;
      this.evType = opt.evType || null;
      this.arm = opt.arm || 0;
      this.dead = false;
      this.r = 6;
      if (kind === 'chest' || kind === 'portal' || kind === 'shelf' || kind === 'shrine' || kind === 'bosschest' || kind === 'event') {
        this.r = 10;
        this.vx = 0; this.vy = 0;
        this.settled = true;
      }
    }

    update(dt, game) {
      if (!this.settled) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vx *= Math.pow(0.001, dt);
        this.vy *= Math.pow(0.001, dt);
        if (this.kind !== 'chest' && this.kind !== 'portal' && this.kind !== 'shelf' && this.kind !== 'shrine' && this.kind !== 'bosschest') {
          const mag = 1 + (game.player.mods ? game.player.mods.magnet * 0.5 : 0);
          const d = SK.dist(this.x, this.y, game.player.x, game.player.y);
          if (d < 34 * mag && d > 4) {
            const a = SK.angleTo(this.x, this.y, game.player.x, game.player.y);
            this.vx += Math.cos(a) * 340 * dt;
            this.vy += Math.sin(a) * 340 * dt;
          }
        }
        if (Math.abs(this.vx) < 3 && Math.abs(this.vy) < 3) this.settled = true;
      } else if (this.kind === 'coin' || this.kind === 'hp' || this.kind === 'energy') {
        const mag = 1 + (game.player.mods ? game.player.mods.magnet * 0.5 : 0);
        const d = SK.dist(this.x, this.y, game.player.x, game.player.y);
        if (d < 26 * mag) {
          const a = SK.angleTo(this.x, this.y, game.player.x, game.player.y);
          this.x += Math.cos(a) * 120 * dt;
          this.y += Math.sin(a) * 120 * dt;
        }
      }
    }
  };
})();
