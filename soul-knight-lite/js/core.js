/* ============================================================
   core.js —— 常量 / 数学 / 随机数 / 输入 / 音效合成
   ============================================================ */
(function () {
  'use strict';
  const SK = (window.SK = window.SK || {});
  const TAU = Math.PI * 2;

  /* ------------------------------ 尺寸 ------------------------------ */
  SK.TAU = TAU;
  SK.TILE = 16;          // 图块像素
  SK.VIEW_W = 384;       // 逻辑视口
  SK.VIEW_H = 216;
  SK.ROOM_W = 32;        // 房间 32x20 图块
  SK.ROOM_H = 20;
  SK.ROOM_PW = SK.ROOM_W * SK.TILE;  // 512
  SK.ROOM_PH = SK.ROOM_H * SK.TILE;  // 320

  /* ------------------------------ 图块类型 ------------------------------ */
  SK.T = { VOID: 0, FLOOR: 1, WALL: 2, DOOR: 3, BLOCK: 4 };

  /* ------------------------------ 数学 ------------------------------ */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const chance = (p) => Math.random() < p;
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
  const dist2 = (ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay; return dx * dx + dy * dy; };
  const angleTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
  const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0);

  Object.assign(SK, { clamp, lerp, rand, randi, pick, chance, dist, dist2, angleTo, sign });

  // 角度差，落在 (-PI, PI]
  SK.angDiff = function (a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d <= -Math.PI) d += TAU;
    return d;
  };

  // 稳定的二维哈希（用于地砖噪声，纯确定性）
  SK.hash2 = function (x, y) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  SK.round = Math.round;

  /* ------------------------------ 可复现随机 ------------------------------ */
  SK.RNG = class RNG {
    constructor(seed) { this.s = (seed >>> 0) || 1; }
    next() {
      this.s = (this.s + 0x6d2b79f5) >>> 0;
      let t = this.s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) { return a + this.next() * (b - a); }
    int(a, b) { return Math.floor(this.range(a, b + 1)); }
    pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
    chance(p) { return this.next() < p; }
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(this.next() * (i + 1));
        const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }
  };

  /* ------------------------------ 输入 ------------------------------ */
  const keys = Object.create(null);
  const edge = Object.create(null);
  const mouse = { x: SK.VIEW_W / 2, y: SK.VIEW_H / 2, down: false, pdown: false, wheel: 0 };

  const Input = {
    keys, mouse,
    toLogical: null,           // (clientX, clientY) => {x,y}，由 game 注入
    init(canvas) {
      window.addEventListener('keydown', (e) => {
        if (e.repeat) { return; }
        // 防止空格/方向键滚动页面
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].indexOf(e.code) >= 0) e.preventDefault();
        keys[e.code] = true;
        edge[e.code] = true;
        if (SK.Sound) SK.Sound.unlock();
      }, { passive: false });

      window.addEventListener('keyup', (e) => { keys[e.code] = false; });
      window.addEventListener('blur', () => {
        for (const k in keys) keys[k] = false;
        mouse.down = false;
      });

      const move = (cx, cy) => {
        if (!Input.toLogical) return;
        const p = Input.toLogical(cx, cy);
        mouse.x = p.x; mouse.y = p.y;
      };
      canvas.addEventListener('mousemove', (e) => move(e.clientX, e.clientY));
      canvas.addEventListener('mousedown', (e) => {
        move(e.clientX, e.clientY);
        if (e.button === 0) { mouse.down = true; mouse.pdown = true; }
        if (SK.Sound) SK.Sound.unlock();
        e.preventDefault();
      });
      window.addEventListener('mouseup', (e) => { if (e.button === 0) mouse.down = false; });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('wheel', (e) => { mouse.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    },
    down(code) { return !!keys[code]; },
    pressed(code) { return !!edge[code]; },
    // 任意一个键按下
    anyDown(codes) { for (let i = 0; i < codes.length; i++) if (keys[codes[i]]) return true; return false; },
    anyPressed(codes) { for (let i = 0; i < codes.length; i++) if (edge[codes[i]]) return true; return false; },
    endFrame() {
      for (const k in edge) delete edge[k];
      mouse.pdown = false;
      mouse.wheel = 0;
    },
    clearEdge() { for (const k in edge) delete edge[k]; }
  };
  SK.Input = Input;

  /* ------------------------------ 音效 ------------------------------ */
  const Sound = {
    on: true,
    ctx: null,
    master: null,
    noiseBuf: null,
    budget: 8,
    _vol: 0.55,

    unlock() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      this.init();
    },

    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { this.on = false; return; }
      try {
        this.ctx = new AC();
      } catch (e) { this.on = false; return; }
      this.master = this.ctx.createGain();
      this.master.gain.value = this._vol;
      this.master.connect(this.ctx.destination);
      // 噪声缓冲
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    },

    setVolume(v) { this._vol = v; if (this.master) this.master.gain.value = v; },

    // 每帧重置发声预算，避免高速武器一秒生成几百个音频节点
    newFrame() { this.budget = 8; },

    tone(freq, dur, type, vol, slideTo, delay) {
      if (!this.on || !this.ctx || this.ctx.state !== 'running') return;
      if (this.budget <= 0) return;
      this.budget--;
      const t0 = this.ctx.currentTime + (delay || 0);
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      const v = vol == null ? 0.12 : vol;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(v, t0 + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.master);
      // 播完立刻断开，别让节点在音频图里越堆越多
      o.onended = function () {
        try { o.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
      };
      o.start(t0); o.stop(t0 + dur + 0.03);
    },

    noise(dur, vol, freq, q, type) {
      if (!this.on || !this.ctx || !this.noiseBuf || this.ctx.state !== 'running') return;
      if (this.budget <= 0) return;
      this.budget--;
      const t0 = this.ctx.currentTime;
      const s = this.ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = type || 'bandpass';
      f.frequency.value = freq || 900;
      f.Q.value = q || 1;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol == null ? 0.14 : vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f); f.connect(g); g.connect(this.master);
      s.onended = function () {
        try { s.disconnect(); f.disconnect(); g.disconnect(); } catch (e) { /* ignore */ }
      };
      s.start(t0); s.stop(t0 + dur + 0.02);
    },

    /* ------- 具体音效 ------- */
    shoot() { this.tone(760, 0.07, 'square', 0.055, 340); this.noise(0.05, 0.05, 2200, 1.5); },
    shootHeavy() { this.tone(190, 0.14, 'sawtooth', 0.1, 70); this.noise(0.12, 0.1, 700, 1); },
    laser() { this.tone(1400, 0.11, 'sawtooth', 0.05, 380); },
    swing() { this.noise(0.11, 0.09, 1600, 0.8, 'highpass'); },
    hit() { this.noise(0.05, 0.09, 1400, 2); this.tone(220, 0.04, 'square', 0.04, 120); },
    crit() { this.tone(900, 0.09, 'square', 0.09, 1600); },
    enemyDie() { this.tone(320, 0.13, 'square', 0.07, 90); this.noise(0.1, 0.07, 600, 1); },
    hurt() { this.tone(160, 0.2, 'sawtooth', 0.12, 60); this.noise(0.16, 0.1, 380, 1); },
    pickup() { this.tone(880, 0.05, 'square', 0.07); this.tone(1320, 0.07, 'square', 0.06, null, 0.05); },
    coin() { this.tone(1180, 0.045, 'square', 0.05); this.tone(1580, 0.06, 'square', 0.04, null, 0.04); },
    door() { this.tone(120, 0.22, 'sawtooth', 0.07, 220); this.noise(0.2, 0.06, 500, 0.6); },
    dash() { this.noise(0.14, 0.09, 800, 0.7, 'highpass'); this.tone(420, 0.12, 'triangle', 0.05, 900); },
    explode() { this.noise(0.34, 0.2, 260, 0.6, 'lowpass'); this.tone(80, 0.3, 'sawtooth', 0.13, 34); },
    level() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.1, 'square', 0.07, null, i * 0.075)); },
    warn() { this.tone(300, 0.1, 'square', 0.06, 500); },
    buy() { this.tone(700, 0.06, 'square', 0.07); this.tone(1050, 0.08, 'square', 0.06, null, 0.06); },
    deny() { this.tone(140, 0.14, 'square', 0.07, 90); },
    boss() { this.tone(70, 0.7, 'sawtooth', 0.14, 52); this.tone(140, 0.6, 'square', 0.05, 100); }
  };
  SK.Sound = Sound;

  /* ------------------------------ 存档 ------------------------------ */
  SK.Save = {
    key: 'sklittle.v1',
    read() {
      try { return JSON.parse(localStorage.getItem(this.key)) || {}; }
      catch (e) { return {}; }
    },
    write(obj) {
      try { localStorage.setItem(this.key, JSON.stringify(obj)); } catch (e) { /* ignore */ }
    },
    best() { return this.read().best || 0; },
    report(floor, win) {
      const s = this.read();
      const rec = Math.max(s.best || 0, win ? 99 : floor);
      if (rec !== (s.best || 0)) { s.best = rec; this.write(s); }
      return rec;
    }
  };
})();
