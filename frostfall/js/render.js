/* =========================================================================
   永冬 · Frostfall —— 3D 场景渲染（Three.js）
   坐标系：地面 = XZ 平面，Y 朝上。极坐标布局与引擎一致。
   ========================================================================= */
(function (root) {
  'use strict';
  const FW = root.FW;
  const THREE = root.THREE;
  const N = FW.CFG.SECTORS;
  const RINGS = FW.CFG.RINGS;

  const PLAZA = 48;
  const RING_W = 42;
  const MAX_R = PLAZA + RINGS * RING_W;
  const TAU = Math.PI * 2;
  const SEG = TAU / N;

  FW.GEO = { PLAZA, RING_W, MAX_R, TAU, SEG };
  FW.angleOf = (s) => (s + 0.5) * SEG - Math.PI / 2;
  FW.ringOuter = (r) => PLAZA + r * RING_W;
  FW.ringInner = (r) => PLAZA + (r - 1) * RING_W;

  const TYPE_COL = {
    tent: '#c08a4a', house: '#d8a35c', cookhouse: '#c98f3f', hunter: '#7fa05a',
    sawmill: '#9a7a45', coalmine: '#7b8fa3', steelworks: '#93a6bd',
    medical: '#5fb3a1', workshop: '#9d8ad6', hub: '#e08a4a', road: '#2b3540'
  };
  FW.TYPE_COL = TYPE_COL;

  /* ============================ 工具 ============================ */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function groundPoint(angle, radius) {
    return V(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
  }

  /* 一块扇形地面（平放在 y 高度），带 UV */
  function wedgeGeometry(r0, r1, a0, a1, y, segs) {
    const s = segs || 3;
    const pos = [];
    const uv = [];
    const idx = [];
    const push = (r, a, u, v) => {
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
      uv.push(u, v);
      return pos.length / 3 - 1;
    };
    for (let i = 0; i <= s; i++) {
      const t = i / s;
      const a = a0 + (a1 - a0) * t;
      push(r0, a, t, 0);
      push(r1, a, t, 1);
    }
    for (let i = 0; i < s; i++) {
      const a = i * 2, b = i * 2 + 1, c = i * 2 + 2, d = i * 2 + 3;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  function canvasTexture(size, draw) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    draw(c, size);
    const t = new THREE.CanvasTexture(cv);
    t.needsUpdate = true;
    return t;
  }

  const TEX = {
    radial: canvasTexture(128, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }),
    soft: canvasTexture(64, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.35)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    }),
    ground: canvasTexture(512, (c, s) => {
      c.fillStyle = '#22303c'; c.fillRect(0, 0, s, s);
      for (let i = 0; i < 700; i++) {
        const x = Math.random() * s, y = Math.random() * s, r = 5 + Math.random() * 46;
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        const a = 0.02 + Math.random() * 0.06;
        if (Math.random() < 0.55) g.addColorStop(0, 'rgba(186,212,238,' + a + ')');
        else g.addColorStop(0, 'rgba(6,12,20,' + (a * 1.5) + ')');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      for (let i = 0; i < 60; i++) {
        c.strokeStyle = 'rgba(180,210,235,' + (0.02 + Math.random() * 0.04) + ')';
        c.lineWidth = 1 + Math.random() * 2;
        c.beginPath();
        let x = Math.random() * s, y = Math.random() * s;
        c.moveTo(x, y);
        for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 90; y += (Math.random() - 0.5) * 90; c.lineTo(x, y); }
        c.stroke();
      }
    }),    snow: canvasTexture(32, (c, s) => {
      const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.6, 'rgba(230,244,255,0.5)');
      g.addColorStop(1, 'rgba(210,230,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, s, s);
    })
  };

  /* ============================ 材质 ============================ */
  const M = {};
  function mat(name, params) {
    if (!M[name]) M[name] = new THREE.MeshStandardMaterial(params);
    return M[name];
  }
  function initMaterials() {
    M.rock = new THREE.MeshStandardMaterial({ color: 0x39454f, roughness: 0.95, metalness: 0.05 });
    M.dark = new THREE.MeshStandardMaterial({ color: 0x2a323d, roughness: 0.9 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0x71808d, roughness: 0.45, metalness: 0.7 });
    M.rust = new THREE.MeshStandardMaterial({ color: 0x8a5c3c, roughness: 0.8, metalness: 0.3 });
    M.wood = new THREE.MeshStandardMaterial({ color: 0x8a6c45, roughness: 0.92 });
    M.woodDark = new THREE.MeshStandardMaterial({ color: 0x574226, roughness: 0.95 });
    M.canvas = new THREE.MeshStandardMaterial({ color: 0xa28455, roughness: 0.98 });
    M.canvasDark = new THREE.MeshStandardMaterial({ color: 0x6b5436, roughness: 0.98 });
    M.snow = new THREE.MeshStandardMaterial({ color: 0xb9cfe4, roughness: 0.85, metalness: 0.0 });
    M.win = new THREE.MeshStandardMaterial({ color: 0x2a2118, emissive: 0xffa445, emissiveIntensity: 1.6, roughness: 0.6 });
    M.winDim = new THREE.MeshStandardMaterial({ color: 0x241c14, emissive: 0xff8b30, emissiveIntensity: 0.55, roughness: 0.7 });
    M.teal = new THREE.MeshStandardMaterial({ color: 0x1d3a36, emissive: 0x49d6b0, emissiveIntensity: 1.2, roughness: 0.6 });
    M.violet = new THREE.MeshStandardMaterial({ color: 0x2a2340, emissive: 0x8f7bff, emissiveIntensity: 0.8, roughness: 0.6 });
    M.hot = new THREE.MeshStandardMaterial({ color: 0x3a1a08, emissive: 0xff7a1e, emissiveIntensity: 2.6, roughness: 0.5 });
    M.tree = new THREE.MeshStandardMaterial({ color: 0x1e3a2e, roughness: 0.95 });
    M.treeDark = new THREE.MeshStandardMaterial({ color: 0x152a22, roughness: 0.95 });
    M.coal = new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.6, metalness: 0.35 });
    M.ore = new THREE.MeshStandardMaterial({ color: 0x6a7a88, roughness: 0.6, metalness: 0.45 });
    const roadTex = TEX.ground.clone(); roadTex.needsUpdate = true; roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping; roadTex.repeat.set(1, 1);
    M.road = new THREE.MeshStandardMaterial({ map: roadTex, color: 0x93a2b2, roughness: 0.96 });
    M.pad = new THREE.MeshBasicMaterial({ map: TEX.radial, color: 0x04070b, transparent: true, opacity: 0.62, depthWrite: false });
    M.roadLine = new THREE.MeshBasicMaterial({ color: 0x5d7284, transparent: true, opacity: 0.5 });
  }

  /* ============================ 建筑模型 ============================ */
  const G = {};
  function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function cyl(rt, rb, h, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 10); }
  function cone(r, h, seg) { return new THREE.ConeGeometry(r, h, seg || 8); }

  function add(group, geo, material, x, y, z, opts) {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x || 0, y || 0, z || 0);
    if (opts) {
      if (opts.ry) m.rotation.y = opts.ry;
      if (opts.rx) m.rotation.x = opts.rx;
      if (opts.rz) m.rotation.z = opts.rz;
      if (opts.s) m.scale.setScalar(opts.s);
    }
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  }
  function glow(group, color, size, x, y, z, opacity, noDepth) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: TEX.radial, color: color, transparent: true, opacity: opacity == null ? 0.7 : opacity,
      blending: THREE.AdditiveBlending, depthWrite: false, depthTest: !noDepth
    }));
    sp.position.set(x, y, z);
    sp.scale.set(size, size, 1);
    group.add(sp);
    return sp;
  }

  const MODELS = {
    tent(g) {
      add(g, box(11, 0.5, 11), M.canvasDark, 0, 0.25, 0);
      add(g, cone(6.4, 7.2, 4), M.canvas, 0, 4.1, 0, { ry: Math.PI / 4 });
      add(g, box(2.4, 3.4, 0.5), M.woodDark, 0, 1.9, 4.6);
      const w = add(g, box(1.6, 1.2, 0.3), M.winDim, 3.2, 1.6, 3.2, { ry: Math.PI / 4 });
      return { h: 7.2 };
    },
    house(g) {
      add(g, box(12, 0.5, 12), M.dark, 0, 0.25, 0);
      add(g, box(10.5, 7, 10.5), M.wood, 0, 3.9, 0);
      add(g, cone(8.2, 4.2, 4), M.woodDark, 0, 9.5, 0, { ry: Math.PI / 4 });
      add(g, box(1.8, 1.4, 0.4), M.win, 0, 4.6, 5.3);
      add(g, box(2.2, 2.8, 0.4), M.woodDark, 3.2, 1.9, 5.3);
      add(g, box(1.2, 1.4, 0.4), M.winDim, -3.4, 4.4, 5.3);
      add(g, cyl(0.5, 0.5, 3.4, 6), M.dark, 3.2, 11.4, -2.6);
      return { h: 11 };
    },
    cookhouse(g) {
      add(g, box(12, 0.5, 12), M.dark, 0, 0.25, 0);
      add(g, box(10, 6, 10), M.rust, 0, 3.4, 0);
      add(g, box(10.8, 0.8, 10.8), M.woodDark, 0, 6.8, 0);
      add(g, cyl(1.1, 1.3, 5, 8), M.metal, 2.6, 9.4, -2.2);
      add(g, box(2.4, 2.4, 0.4), M.win, 0, 4, 5);
      const fire = glow(g, 0xff8a3a, 6, 2.6, 12, -2.2, 0.5);
      return { h: 12, smoke: { x: 2.6, y: 12.2, z: -2.2 } };
    },
    hunter(g) {
      add(g, box(9, 0.4, 9), M.dark, 0, 0.2, 0);
      add(g, box(7.5, 4.4, 7.5), M.wood, 0, 2.6, 0);
      add(g, box(8.4, 0.7, 8.4), M.woodDark, 0, 4.9, 0, { rx: 0.12 });
      add(g, box(0.35, 7, 0.35), M.woodDark, 3.4, 4, 3.4);
      add(g, box(3, 0.3, 0.3), M.woodDark, 3.4, 7.2, 3.4, { ry: 0.4 });
      add(g, box(1.6, 1.1, 0.3), M.winDim, 0, 2.6, 3.9);
      return { h: 7 };
    },
    sawmill(g) {
      add(g, box(14, 0.5, 12), M.dark, 0, 0.25, 0);
      add(g, box(12, 6.4, 11), M.wood, 0, 3.6, 0);
      for (let i = 0; i < 3; i++) {
        add(g, box(4.4, 0.5, 11.4), M.woodDark, -4.2 + i * 4.2, 7.2, 0, { rz: 0.42 });
      }
      const blade = add(g, cyl(3.4, 3.4, 0.35, 14), M.metal, 4.4, 4.2, 0, { rx: Math.PI / 2 });
      for (let i = 0; i < 8; i++) {
        add(g, box(0.5, 0.5, 0.8), M.metal, 0, 0, 0).visible = false;
      }
      // 圆木堆
      for (let i = 0; i < 3; i++) {
        add(g, cyl(0.9, 0.9, 6.4, 7), M.woodDark, -5.4, 0.9 + (i % 2) * 1.7, 4.6 + Math.floor(i / 2) * 1.8, { rx: Math.PI / 2, rz: 0 });
      }
      return { h: 8, spin: blade, spinAxis: 'z', spinSpeed: 0.35 };
    },
    coalmine(g) {
      add(g, box(13, 0.5, 13), M.rock, 0, 0.25, 0);
      add(g, box(8.5, 4, 8.5), M.dark, 0, 2.2, 0);
      add(g, box(2.6, 3, 2.6), M.woodDark, 0, 3.6, 0);
      // 井架
      add(g, box(1.1, 12, 1.1), M.metal, -2.6, 6.2, -2.6, { rz: 0.16 });
      add(g, box(1.1, 12, 1.1), M.metal, 2.6, 6.2, -2.6, { rz: -0.16 });
      add(g, box(6.4, 0.7, 1.2), M.metal, 0, 12.2, -2.6);
      const wheel = add(g, cyl(2.6, 2.6, 0.5, 12), M.metal, 0, 10.4, -2.6, { rx: Math.PI / 2 });
      // 煤堆
      for (let i = 0; i < 5; i++) {
        const a = i * 1.3;
        add(g, new THREE.IcosahedronGeometry(1.6 + (i % 3) * 0.5, 0), M.coal,
          Math.cos(a) * 4.4, 1.1, 3.6 + Math.sin(a) * 1.6);
      }
      add(g, box(2, 1.4, 0.4), M.winDim, 0, 2.2, 4.3);
      return { h: 13, spin: wheel, spinAxis: 'z', spinSpeed: 1.2 };
    },
    steelworks(g) {
      add(g, box(15, 0.5, 14), M.rock, 0, 0.25, 0);
      add(g, box(13, 7.5, 12), M.metal, 0, 4, 0);
      add(g, cyl(1.6, 2, 10, 10), M.rust, -4, 10, -3);
      add(g, cyl(1.2, 1.6, 8, 10), M.rust, 0.5, 9, -3.6);
      add(g, cyl(4.4, 4.6, 5, 12), M.metal, 4.6, 2.5, 3.4);
      add(g, box(3.4, 2.6, 0.4), M.hot, 0, 3.4, 6.1);
      add(g, box(2, 1.4, 0.4), M.winDim, -4.6, 3.4, 6.1);
      glow(g, 0xff6a18, 14, 0, 4.4, 6.6, 0.5);
      return { h: 15, smoke: { x: -4, y: 15.4, z: -3 }, smoke2: { x: 0.5, y: 13.4, z: -3.6 } };
    },
    medical(g) {
      add(g, box(12, 0.5, 12), M.dark, 0, 0.25, 0);
      add(g, box(10, 6.4, 10), M.teal, 0, 3.5, 0);
      add(g, box(10.8, 0.8, 10.8), M.dark, 0, 7, 0);
      add(g, box(6, 0.7, 2.2), M.teal, 0, 7.6, 0);
      add(g, box(2.2, 0.7, 6), M.teal, 0, 7.6, 0);
      add(g, box(1.8, 1.3, 0.4), M.win, -2.6, 4, 5);
      add(g, box(1.8, 1.3, 0.4), M.win, 2.6, 4, 5);
      glow(g, 0x49d6b0, 10, 0, 8.4, 0, 0.35);
      return { h: 8 };
    },
    workshop(g) {
      add(g, box(12, 0.5, 12), M.dark, 0, 0.25, 0);
      add(g, box(10, 6, 10), M.violet, 0, 3.2, 0);
      add(g, box(10.8, 0.6, 10.8), M.dark, 0, 6.4, 0);
      const gear = add(g, cyl(3.6, 3.6, 0.9, 12), M.metal, 0, 7.6, 0);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU;
        add(g, box(1, 0.9, 1.4), M.metal, Math.cos(a) * 3.9, 7.6, Math.sin(a) * 3.9, { ry: -a });
      }
      add(g, box(2.6, 2.4, 0.4), M.win, 0, 3.4, 5);
      add(g, box(0.5, 5, 0.5), M.metal, 4.2, 8, 4.2);
      glow(g, 0x9d8ad6, 8, 0, 9, 0, 0.3);
      return { h: 9, spin: gear, spinAxis: 'y', spinSpeed: 0.5 };
    },
    hub(g) {
      add(g, cyl(5.6, 6.4, 2.2, 10), M.metal, 0, 1.1, 0);
      add(g, cyl(3.8, 4.4, 6.4, 10), M.rust, 0, 5.2, 0);
      add(g, cyl(4.4, 4.4, 0.7, 10), M.hot, 0, 4.6, 0);
      add(g, cone(4.1, 2.6, 10), M.metal, 0, 9.6, 0);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * TAU + 0.4;
        add(g, cyl(0.6, 0.6, 6.4, 6), M.rust,
          Math.cos(a) * 5.6, 2.2, Math.sin(a) * 5.6, { rz: Math.cos(a) * 0.9, rx: -Math.sin(a) * 0.9 });
      }
      glow(g, 0xff9a45, 16, 0, 4.8, 0, 0.55);
      return { h: 11, smoke: { x: 0, y: 11, z: 0 } };
    }
  };

  /* ============================ 渲染器 ============================ */
  function Renderer(canvas, game) {
    this.cv = canvas;
    this.g = game;
    this.t = 0;
    this.hover = null;
    this.selected = null;
    this.buildMode = null;
    this.cam = { x: 0, y: 0, zoom: 1, baseZoom: 1 };
    this.azim = 0.72;
    this.elev = 0.84;
    this.meshes = new Map();      // tileKey -> { group, bld }
    this.decor = new Map();       // tileKey -> group
    this.puffs = [];
    this.lastSync = -1;
    this.syncRoads = this.syncRoads;
    this.ready = false;

    this.w = 0; this.h = 0;
    try {
      this.initGL();
      this.ready = true;
    } catch (e) {
      console.error('WebGL 初始化失败', e);
      const d = document.createElement('div');
      d.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center;color:#ff9b9b;font-size:14px;text-align:center;padding:40px';
      d.textContent = '你的浏览器无法创建 WebGL 上下文，3D 场景无法显示。请用较新的 Chrome / Edge 打开。';
      canvas.parentElement.appendChild(d);
      return;
    }
    this.resize();
    this.buildScene();
    this.syncAll();
  }

  Renderer.prototype.initGL = function () {
    const r = new THREE.WebGLRenderer({ canvas: this.cv, antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(2, root.devicePixelRatio || 1));
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.78;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = r;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a121b, 0.00048);
    this.camera = new THREE.PerspectiveCamera(38, 1, 2, 6000);
    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(V(0, 1, 0), 0);
    initMaterials();
  };

  /* ---------------------------- 场景 ---------------------------- */
  Renderer.prototype.buildScene = function () {
    const sc = this.scene;

    // 光：冷色天光 + 一盏主方向光（投影） + 发电机暖光
    this.hemi = new THREE.HemisphereLight(0x6e9cd0, 0x080d13, 0.22);
    sc.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x2a3c52, 0.16);
    sc.add(this.ambient);

    this.key = new THREE.DirectionalLight(0xa8c4e8, 1.05);
    this.key.position.set(430, 360, 300);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(2048, 2048);
    this.key.shadow.camera.left = -430;
    this.key.shadow.camera.right = 430;
    this.key.shadow.camera.top = 430;
    this.key.shadow.camera.bottom = -430;
    this.key.shadow.camera.near = 1;
    this.key.shadow.camera.far = 1800;
    this.key.shadow.bias = -0.0008;
    this.key.shadow.normalBias = 0.6;
    sc.add(this.key);
    sc.add(this.key.target);

    this.warm = new THREE.PointLight(0xff8a3a, 1.85, 400, 1.2);
    this.warm.position.set(0, 42, 0);
    sc.add(this.warm);

    this.rim = new THREE.PointLight(0x4a86d0, 0.32, 950, 1.6);
    this.rim.position.set(-300, 180, -300);
    sc.add(this.rim);

    // 雪原
    const groundGeo = new THREE.CircleGeometry(MAX_R * 2.6, 96);
    groundGeo.rotateX(-Math.PI / 2);
    const gtex = TEX.ground.clone(); gtex.needsUpdate = true; gtex.wrapS = gtex.wrapT = THREE.RepeatWrapping; gtex.repeat.set(3, 3);
    const groundMat = new THREE.MeshStandardMaterial({ map: gtex, color: 0x66727e, roughness: 0.98, metalness: 0.02 });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.position.y = -0.2;
    this.ground.receiveShadow = true;
    sc.add(this.ground);

    // 场地圆盘
    const fieldGeo = new THREE.CircleGeometry(MAX_R * 1.06, 96);
    fieldGeo.rotateX(-Math.PI / 2);
    const ftex = TEX.ground.clone(); ftex.needsUpdate = true;
    const field = new THREE.Mesh(fieldGeo, new THREE.MeshStandardMaterial({ map: ftex, color: 0x8a949e, roughness: 0.97 }));
    field.position.y = -0.05;
    field.receiveShadow = true;
    sc.add(field);

    // 环线与放射线
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8fc4e8, transparent: true, opacity: 0.3 });
    const lineMat2 = new THREE.LineBasicMaterial({ color: 0x8fc4e8, transparent: true, opacity: 0.11 });
    for (let r = 1; r <= RINGS; r++) {
      const pts = [];
      const rad = FW.ringOuter(r);
      for (let i = 0; i <= 96; i++) {
        const a = (i / 96) * TAU;
        pts.push(V(Math.cos(a) * rad, 0.02, Math.sin(a) * rad));
      }
      sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat));
    }
    for (let s = 0; s < N; s++) {
      const a = s * SEG - Math.PI / 2;
      const pts = [V(Math.cos(a) * PLAZA, 0.02, Math.sin(a) * PLAZA), V(Math.cos(a) * MAX_R, 0.02, Math.sin(a) * MAX_R)];
      sc.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lineMat2));
    }

    // 外圈冰墙
    const wallGeo = new THREE.TorusGeometry(MAX_R * 1.045, 3.2, 6, 96);
    wallGeo.rotateX(Math.PI / 2);
    const wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x4d6b82, roughness: 0.55, metalness: 0.1, emissive: 0x14283a, emissiveIntensity: 0.4 }));
    wall.position.y = 1;
    wall.castShadow = true;
    wall.receiveShadow = true;
    sc.add(wall);

    // 供热光斑
    this.heatDisc = new THREE.Mesh(
      new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: TEX.radial, color: 0xff8a3a, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.heatDisc.position.y = 0.35;
    this.heatDisc.renderOrder = 2;
    sc.add(this.heatDisc);

    // 供热边界环
    this.heatRing = new THREE.Mesh(
      new THREE.RingGeometry(0.985, 1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffab5e, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.heatRing.position.y = 0.45;
    this.heatRing.scale.set(FW.ringOuter(2), 1, FW.ringOuter(2));
    sc.add(this.heatRing);
    // 地面选块指示
    this.cursor = new THREE.Mesh(
      new THREE.RingGeometry(0.74, 1, 4).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x7fd4ff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
    );
    this.cursor.visible = false;
    this.cursor.position.y = 0.5;
    sc.add(this.cursor);

    // 选择环
    this.selRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 1, 40).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x9fe4ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    );
    this.selRing.visible = false;
    sc.add(this.selRing);

    // 雪
    this.initSnow();
    this.initPuffs();
    this.buildDecor();
    this.buildGenerator();
  };

  /* ---------------------------- 雪 ---------------------------- */
  Renderer.prototype.initSnow = function () {
    const COUNT = 2000;
    const pos = new Float32Array(COUNT * 3);
    const spd = new Float32Array(COUNT);
    const R = MAX_R * 2.3;
    for (let i = 0; i < COUNT; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 2 * R;
      pos[i * 3 + 1] = Math.random() * 620;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 2 * R;
      spd[i] = 14 + Math.random() * 42;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({
      size: 3.4, map: TEX.snow, transparent: true, opacity: 0.75,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xdcefff, sizeAttenuation: true
    });
    this.snowPoints = new THREE.Points(geo, m);
    this.snowPoints.frustumCulled = false;
    this.snowSpeed = spd;
    this.scene.add(this.snowPoints);
    this.snowBox = R;
  };

  Renderer.prototype.updateSnow = function (dt) {
    if (!this.snowPoints) return;
    const storm = this.g.state.storm;
    const arr = this.snowPoints.geometry.attributes.position.array;
    const n = arr.length / 3;
    const R = this.snowBox;
    const windX = storm ? -260 : -34;
    const windZ = storm ? 90 : 18;
    const fall = storm ? 3.2 : 1;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      const s = this.snowSpeed[i] * fall;
      arr[i3] += windX * dt * 0.35;
      arr[i3 + 1] -= s * dt;
      arr[i3 + 2] += windZ * dt * 0.35;
      if (arr[i3 + 1] < 0) {
        arr[i3 + 1] = 600 + Math.random() * 60;
        arr[i3] = (Math.random() - 0.5) * 2 * R;
        arr[i3 + 2] = (Math.random() - 0.5) * 2 * R;
      }
      if (arr[i3] < -R) arr[i3] += 2 * R;
      if (arr[i3] > R) arr[i3] -= 2 * R;
      if (arr[i3 + 2] < -R) arr[i3 + 2] += 2 * R;
      if (arr[i3 + 2] > R) arr[i3 + 2] -= 2 * R;
    }
    this.snowPoints.geometry.attributes.position.needsUpdate = true;
    this.snowPoints.material.opacity = storm ? 0.95 : 0.72;
    this.snowPoints.material.size = storm ? 2.6 : 3.4;
  };

  /* ---------------------------- 蒸汽粒子 ---------------------------- */
  Renderer.prototype.initPuffs = function () {
    const COUNT = 260;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3));
    g.setAttribute('size', new THREE.BufferAttribute(new Float32Array(COUNT), 1));
    this.puffData = [];
    for (let i = 0; i < COUNT; i++) this.puffData.push({ life: 0, vx: 0, vy: 0, vz: 0 });
    const m = new THREE.PointsMaterial({
      size: 12, map: TEX.soft, transparent: true, opacity: 0.22, color: 0xdfeeff,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    });
    this.puffPoints = new THREE.Points(g, m);
    this.puffPoints.frustumCulled = false;
    this.scene.add(this.puffPoints);
    this.puffCursor = 0;
  };

  Renderer.prototype.spawnPuff = function (x, y, z, big) {
    const arr = this.puffPoints.geometry.attributes.position.array;
    const i = this.puffCursor++ % this.puffData.length;
    const d = this.puffData[i];
    d.life = 1;
    d.vx = (Math.random() - 0.5) * 6;
    d.vz = (Math.random() - 0.5) * 6;
    d.vy = 8 + Math.random() * 10;
    arr[i * 3] = x + (Math.random() - 0.5) * 2;
    arr[i * 3 + 1] = y;
    arr[i * 3 + 2] = z + (Math.random() - 0.5) * 2;
    this.puffPoints.geometry.attributes.position.needsUpdate = true;
  };

  Renderer.prototype.updatePuffs = function (dt) {
    const arr = this.puffPoints.geometry.attributes.position.array;
    let any = false;
    for (let i = 0; i < this.puffData.length; i++) {
      const d = this.puffData[i];
      if (d.life <= 0) continue;
      d.life -= dt * 0.5;
      arr[i * 3] += d.vx * dt;
      arr[i * 3 + 1] += d.vy * dt;
      arr[i * 3 + 2] += d.vz * dt;
      if (d.life <= 0) arr[i * 3 + 1] = -999;
      any = true;
    }
    if (any) this.puffPoints.geometry.attributes.position.needsUpdate = true;
  };

  /* ---------------------------- 地貌装饰 ---------------------------- */
  Renderer.prototype.buildDecor = function () {
    const g = this.g;
    const S = g.state;
    for (const key in S.tiles) {
      const t = S.tiles[key];
      if (!t.feat) continue;
      const grp = new THREE.Group();
      const ang = FW.angleOf(t.s);
      const rad = (FW.ringInner(t.r) + FW.ringOuter(t.r)) / 2;
      grp.position.copy(groundPoint(ang, rad));
      grp.rotation.y = Math.PI / 2 - ang;
      if (t.feat === 'forest') {
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * TAU + 0.7;
          const d = 3 + (i % 3) * 2.6;
          const h = 9 + (i % 3) * 3.4;
          add(grp, cone(3.1 + (i % 2) * 0.7, h, 6), i % 2 ? M.tree : M.treeDark,
            Math.cos(a) * d, h / 2, Math.sin(a) * d);
          add(grp, cyl(0.5, 0.6, 2.4, 5), M.woodDark, Math.cos(a) * d, 1.2, Math.sin(a) * d);
        }
      } else if (t.feat === 'coal') {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * TAU + 0.4;
          const s = 2.2 + (i % 2) * 1.4;
          add(grp, new THREE.IcosahedronGeometry(s, 0), M.coal, Math.cos(a) * 4.4, s * 0.7, Math.sin(a) * 4.4);
        }
      } else {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * TAU + 1.1;
          const s = 2.6 + (i % 2) * 1.2;
          add(grp, new THREE.DodecahedronGeometry(s, 0), M.ore, Math.cos(a) * 4.6, s * 0.65, Math.sin(a) * 4.6);
        }
      }
      grp.scale.setScalar(1.15);
      this.scene.add(grp);
      this.decor.set(key, grp);
    }
  };

  /* ---------------------------- 发电机 ---------------------------- */
  Renderer.prototype.buildGenerator = function () {
    const g = new THREE.Group();
    this.genGroup = g;
    this.scene.add(g);

    // 基座
    add(g, cyl(29, 33, 3.4, 24), M.dark, 0, 1.7, 0);
    add(g, cyl(24, 27, 2.6, 24), M.metal, 0, 4.6, 0);
    add(g, cyl(20, 21, 3, 12), M.rust, 0, 7.2, 0);

    // 内胆：炽热的核心（透过笼架可见）
    this.coreMat = M.hot.clone();
    this.coreMesh = add(g, cyl(11, 12.4, 22, 12), this.coreMat, 0, 19, 0);
    add(g, cyl(10.4, 10.4, 1.2, 12), this.coreMat, 0, 8.6, 0);

    // 笼架：8 根立柱 + 若干横箍
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const px = Math.cos(a) * 15.4, pz = Math.sin(a) * 15.4;
      add(g, box(2.6, 21, 2.2), M.metal, px, 18, pz, { ry: -a });
      add(g, box(3.4, 1.1, 0.9), M.rust, px * 0.96, 28.4, pz * 0.96, { ry: -a });
    }
    for (let i = 0; i < 3; i++) {
      add(g, new THREE.TorusGeometry(15.8, 0.85, 5, 24), M.metal, 0, 10 + i * 7, 0, { rx: Math.PI / 2 });
    }

    // 顶部
    add(g, cyl(16, 17.5, 2.4, 12), M.dark, 0, 30.6, 0);
    add(g, cyl(9, 13, 3.6, 12), M.metal, 0, 33.6, 0);
    add(g, cyl(4.2, 5.4, 8, 10), M.rust, 0, 39.4, 0);
    add(g, cyl(5.6, 5.6, 1.4, 10), M.metal, 0, 43.6, 0);

    // 光晕
    this.coreGlow = glow(g, 0xff9a45, 66, 0, 18, 0, 0.3, true);
    this.coreGlow2 = glow(g, 0xffcf8a, 26, 0, 18, 0, 0.42, true);
    // 热柱
    this.heatCol = new THREE.Mesh(new THREE.CylinderGeometry(7, 24, 90, 14, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff9a45, transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.heatCol.position.y = 62;
    g.add(this.heatCol);

    // 旋转的箍
    this.genRings = [];
    for (let i = 0; i < 2; i++) {
      const ring = add(g, new THREE.TorusGeometry(18.6 + i * 1.4, 1.2, 6, 28), M.rust, 0, 13 + i * 9, 0, { rx: Math.PI / 2 });
      this.genRings.push(ring);
    }
    // 活塞
    this.pistons = [];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      const p = add(g, cyl(2, 2, 7.5, 8), M.rust, Math.cos(a) * 21.5, 8, Math.sin(a) * 21.5);
      this.pistons.push({ mesh: p, a });
    }
    // 热浪
    this.genHeat = glow(g, 0xff8a3a, 96, 0, 6, 0, 0.13);
    g.scale.setScalar(1.32);
  };

  /* ---------------------------- 建筑同步 ---------------------------- */
  Renderer.prototype.wedgeKey = function (r, s) { return r + ':' + s; };

  Renderer.prototype.makeBuilding = function (b) {
    const def = FW.BLD[b.type];
    const grp = new THREE.Group();
    const ang = FW.angleOf(b.s);
    const r0 = FW.ringInner(b.r), r1 = FW.ringOuter(b.r);
    const rad = (r0 + r1) / 2;
    grp.position.copy(groundPoint(ang, rad));
    grp.rotation.y = Math.PI / 2 - ang;
    const arc = rad * SEG;
    // 建筑尺度：内环受扇形弧长限制，外环受环宽限制
    const scale = Math.min(2.3, Math.min(arc * 0.8, 31) / 12);
    const inner = new THREE.Group();
    const YMUL = 1.7;
    inner.scale.set(scale, scale * YMUL, scale);
    grp.add(inner);

    // 地面基座（软化过渡）
    const pad = new THREE.Mesh(new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2), M.pad);
    pad.position.y = 0.03;
    pad.scale.set(arc * 0.46 / scale, 1, RING_W * 0.44 / scale);
    inner.add(pad);
    let meta = { h: 8 };
    const fn = MODELS[b.type];
    if (fn) meta = fn(inner) || meta;
    else {
      add(inner, box(9, 6, 9), M.wood, 0, 3, 0);
      add(inner, box(10, 0.6, 10), M.woodDark, 0, 6.4, 0);
    }
    grp.userData = { b: b, meta: meta, inner: inner, scale: scale, ymul: YMUL, t0: this.t, def: def };
    return grp;
  };

  Renderer.prototype.syncBuildings = function () {
    const S = this.g.state;
    const seen = new Set();
    for (const b of S.buildings) {
      if (b.type === 'road') continue;
      const k = this.wedgeKey(b.r, b.s);
      seen.add(k);
      if (this.meshes.has(k)) {
        const rec = this.meshes.get(k);
        if (rec.bld !== b || rec.bld.type !== b.type) {
          this.scene.remove(rec.group);
          this.meshes.delete(k);
        } else continue;
      }
      const grp = this.makeBuilding(b);
      this.scene.add(grp);
      this.meshes.set(k, { group: grp, bld: b, meta: grp.userData.meta });
      // 新建时扬雪
      for (let i = 0; i < 6; i++) this.spawnPuff(grp.position.x + (Math.random() - 0.5) * 14, 2 + Math.random() * 6, grp.position.z + (Math.random() - 0.5) * 14);
      const dec = this.decor.get(k);
      if (dec) dec.visible = false;
    }
    for (const [k, rec] of Array.from(this.meshes.entries())) {
      if (!seen.has(k)) {
        this.scene.remove(rec.group);
        this.disposeGroup(rec.group);
        this.meshes.delete(k);
      }
    }
    // 道路
    this.syncRoads();
  };

  Renderer.prototype.disposeGroup = function (grp) {
    grp.traverse((o) => {
      if (o.isMesh && o.geometry && o.geometry.__shared !== true) {
        // 共享几何体（box/cyl 每次新建）统一释放
        o.geometry.dispose();
      }
    });
  };

  Renderer.prototype.syncRoads = function () {
    const S = this.g.state;
    if (this._roadSig === this.roadSig()) return;
    this._roadSig = this.roadSig();
    if (this.roadGroup) {
      this.scene.remove(this.roadGroup);
      this.roadGroup.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    }
    const grp = new THREE.Group();
    for (const b of S.buildings) {
      if (b.type !== 'road') continue;
      const a0 = FW.angleOf(b.s) - SEG / 2 + 0.012;
      const a1 = FW.angleOf(b.s) + SEG / 2 - 0.012;
      const geo = wedgeGeometry(FW.ringInner(b.r) + 1.4, FW.ringOuter(b.r) - 1.4, a0, a1, 0.22, 4);
      const m = new THREE.Mesh(geo, M.road);
      m.receiveShadow = true;
      grp.add(m);
      // 中线
      const mid = FW.angleOf(b.s);
      const rad = (FW.ringInner(b.r) + FW.ringOuter(b.r)) / 2;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, RING_W - 8), M.roadLine);
      line.rotation.x = -Math.PI / 2;
      line.position.copy(groundPoint(mid, rad));
      line.position.y = 0.3;
      line.rotation.z = -mid + Math.PI / 2;
      grp.add(line);
    }
    this.roadGroup = grp;
    this.scene.add(grp);
  };

  Renderer.prototype.roadSig = function () {
    const S = this.g.state;
    let sig = '';
    for (const b of S.buildings) if (b.type === 'road') sig += b.r + '.' + b.s + ',';
    return sig;
  };

  Renderer.prototype.syncAll = function () {
    this.syncBuildings();
  };

  /* ---------------------------- 相机 ---------------------------- */
  Renderer.prototype.resize = function () {
    if (!this.ready) return;
    const rect = this.cv.getBoundingClientRect();
    const w = Math.max(320, Math.round(rect.width || this.cv.parentElement.clientWidth || 800));
    const h = Math.max(320, Math.round(rect.height || this.cv.parentElement.clientHeight || 600));
    this.w = w; this.h = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.fit();
    this.camera.updateProjectionMatrix();
  };

  Renderer.prototype.fit = function () {
    this.cam.baseZoom = Math.min(this.w, this.h) / (MAX_R * 1.52);
    if (!this.userZoom) this.cam.zoom = this.cam.baseZoom;
  };

  Renderer.prototype.applyCamera = function () {
    const dist = (this.h / 2) / (this.cam.zoom * Math.tan(this.camera.fov * Math.PI / 360));
    const tx = this.cam.x, tz = this.cam.y;
    const ce = Math.cos(this.elev), se = Math.sin(this.elev);
    this.camera.position.set(
      tx + dist * ce * Math.sin(this.azim),
      dist * se,
      tz + dist * ce * Math.cos(this.azim)
    );
    this.camera.lookAt(tx, 0, tz);
    this.camera.updateMatrixWorld();
  };

  Renderer.prototype.screenToWorld = function (sx, sy) {
    this.applyCamera();
    const nx = (sx / this.w) * 2 - 1;
    const ny = -(sy / this.h) * 2 + 1;
    this.raycaster.setFromCamera(new THREE.Vector2(nx, ny), this.camera);
    const hit = new THREE.Vector3();
    const ok = this.raycaster.ray.intersectPlane(this.plane, hit);
    if (!ok) return { x: 0, y: 0 };
    return { x: hit.x, y: hit.z };
  };

  Renderer.prototype.tileAt = function (wx, wy) {
    const r = Math.hypot(wx, wy);
    if (r < PLAZA) return null;
    const ring = Math.floor((r - PLAZA) / RING_W) + 1;
    if (ring > RINGS) return null;
    let a = Math.atan2(wy, wx) + Math.PI / 2;
    a = ((a % TAU) + TAU) % TAU;
    const s = Math.floor(a / SEG) % N;
    return { r: ring, s: s };
  };

  /* 拖拽平移：让光标下的地面点黏在光标上。
     3D 里屏幕位移 ≠ 世界位移（有方位角和俯角），所以直接反解两次拾取求差。 */
  Renderer.prototype.pan = function (dx, dy, sx, sy) {
    if (!this.ready || (!dx && !dy)) return;
    const a = this.screenToWorld(sx, sy);
    const b = this.screenToWorld(sx + dx, sy + dy);
    if (!isFinite(a.x) || !isFinite(b.x)) return;
    this.cam.x += a.x - b.x;
    this.cam.y += a.y - b.y;
  };

  Renderer.prototype.zoomAt = function (sx, sy, factor) {
    const before = this.screenToWorld(sx, sy);
    this.userZoom = true;
    this.cam.zoom = FW.clamp(this.cam.zoom * factor, this.cam.baseZoom * 0.5, this.cam.baseZoom * 5);
    const after = this.screenToWorld(sx, sy);
    this.cam.x += before.x - after.x;
    this.cam.y += before.y - after.y;
  };

  Renderer.prototype.center = function () {
    this.cam.x = 0; this.cam.y = 0;
    this.userZoom = false;
    this.fit();
  };

  /* ---------------------------- 每帧 ---------------------------- */
  Renderer.prototype.draw = function (dt) {
    if (!this.ready) return;
    const g = this.g, S = g.state;
    this.t += dt;

    // 自适应画质：如果持续掉帧，关掉阴影保流畅
    if (!this._perf) this._perf = { n: 0, acc: 0, done: false };
    if (!this._perf.done && dt > 0 && dt < 0.5) {
      this._perf.n++;
      this._perf.acc += dt;
      if (this._perf.n >= 110) {
        this._perf.done = true;
        const fps = this._perf.n / this._perf.acc;
        if (fps < 32) {
          this.renderer.shadowMap.enabled = false;
          this.key.castShadow = false;
          this.scene.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
          this.renderer.shadowMap.needsUpdate = true;
          console.log('[Frostfall] 检测到帧率偏低（' + fps.toFixed(0) + ' fps），已关闭阴影。');
        }
      }
    }

    // 新增/删除/升级建筑
    if ((S.stamp || 0) !== this.lastSync) {
      this.lastSync = S.stamp || 0;
      this.syncBuildings();
    }
    this.syncRoads();

    this.applyCamera();

    // 供热光斑
    const lvl = g.effLevel();
    const rr = FW.ringOuter(g.range());
    this.heatDisc.scale.setScalar(rr);
    this.heatDisc.material.opacity = lvl > 0 ? 0.22 + 0.035 * Math.sin(this.t * 2.2) : 0.03;
    if (this.heatRing) {
      this.heatRing.visible = lvl > 0;
      this.heatRing.scale.set(rr, 1, rr);
      this.heatRing.material.opacity = 0.45 + 0.14 * Math.sin(this.t * 1.8);
    }
    this.heatDisc.material.color.setHex(S.gen.overdrive ? 0xffb060 : 0xff8a3a);

    // 发电机
    const on = lvl > 0;
    this.coreMat.emissiveIntensity = on ? (2.1 + 0.45 * Math.sin(this.t * 3)) * (S.gen.overdrive ? 1.45 : 1) : 0.04;
    if (this.heatCol) this.heatCol.material.opacity = on ? 0.05 + 0.015 * Math.sin(this.t * 1.3) : 0.008;
    this.coreGlow.material.opacity = on ? (S.gen.overdrive ? 0.45 : 0.3) : 0.05;
    this.coreGlow2.material.opacity = on ? 0.42 : 0.05;
    this.warm.intensity = on ? (S.gen.overdrive ? 2.8 : 1.85) : 0.1;
    this.warm.color.setHex(S.gen.overdrive ? 0xffb060 : 0xff8a3a);
    this.genHeat.material.opacity = on ? 0.1 + 0.035 * Math.sin(this.t * 1.7) : 0.02;
    for (let i = 0; i < this.genRings.length; i++) {
      this.genRings[i].rotation.z += dt * (i % 2 ? -0.35 : 0.35) * (on ? 1 : 0.1);
    }
    const piston = on ? Math.abs(Math.sin(this.t * 2.4)) * 2.2 : 0;
    for (const p of this.pistons) {
      p.mesh.position.y = 12 + piston;
    }
    if (on && Math.random() < 0.4) {
      this.spawnPuff((Math.random() - 0.5) * 26, 30 + Math.random() * 6, (Math.random() - 0.5) * 26);
    }

    // 建筑：动效 / 冒烟 / 选中
    for (const [k, rec] of this.meshes) {
      const grp = rec.group;
      const b = rec.bld;
      const age = this.t - grp.userData.t0;
      if (age < 0.6) {
        const p = Math.min(1, age / 0.6);
        const e = 1 + 0.18 * Math.sin(p * Math.PI) + (1 - p) * 0.3;
        const s = Math.max(0.01, grp.userData.scale * Math.min(1, p * 1.6));
        grp.userData.inner.scale.set(s, s * grp.userData.ymul, s);
        grp.position.y = (1 - p) * 6;
      } else if (grp.userData.inner.scale.x !== grp.userData.scale) {
        grp.userData.inner.scale.set(grp.userData.scale, grp.userData.scale * grp.userData.ymul, grp.userData.scale);
        grp.position.y = 0;
      }
      const meta = rec.meta;
      if (meta && meta.spin && b.enabled && b.workers > 0) {
        meta.spin.rotation[meta.spinAxis] += dt * meta.spinSpeed;
      }
      if (b.enabled && b.workers > 0 && Math.random() < 0.09) {
        if (meta.smoke) this.spawnPuff(grp.position.x + meta.smoke.x, (meta.smoke.y || 8) * grp.userData.scale, grp.position.z + meta.smoke.z);
        if (meta.smoke2 && Math.random() < 0.5) this.spawnPuff(grp.position.x + meta.smoke2.x, (meta.smoke2.y || 8) * grp.userData.scale, grp.position.z + meta.smoke2.z);
      }
    }

    this.updateSnow(dt);
    this.updatePuffs(dt);
    this.updateAmbience(S);
    this.updateCursor();

    this.renderer.render(this.scene, this.camera);
  };

  Renderer.prototype.updateAmbience = function (S) {
    // 昼夜
    const h = S.hour;
    let day = 1;
    if (h < 6) day = 0.58;
    else if (h < 9) day = 0.58 + (h - 6) / 3 * 0.42;
    else if (h < 17) day = 1;
    else if (h < 21) day = 1 - (h - 17) / 4 * 0.42;
    else day = 0.58;
    const storm = S.storm ? 0.72 : 1;
    this.key.intensity = 1.05 * day * storm;
    this.hemi.intensity = 0.22 * (0.5 + 0.5 * day) * storm;
    this.ambient.intensity = 0.16 * (0.6 + 0.4 * day) * storm;
    this.scene.fog.color.setHex(storm ? 0x0b1420 : 0x0a121b);
    this.rim.intensity = 0.5 * (0.5 + 0.5 * day);
    this.renderer.toneMappingExposure = 0.76 + 0.1 * day;
  };

  Renderer.prototype.updateCursor = function () {
    const h = this.hover;
    const g = this.g;
    if (!h) { this.cursor.visible = false; }
    else {
      const ang = FW.angleOf(h.s);
      const r0 = FW.ringInner(h.r), r1 = FW.ringOuter(h.r);
      const rad = (r0 + r1) / 2;
      this.cursor.visible = true;
      this.cursor.position.copy(groundPoint(ang, rad));
      this.cursor.position.y = 0.6;
      this.cursor.rotation.y = -ang;
      const arc = rad * SEG;
      this.cursor.scale.set(Math.max(6, arc * 0.44), 1, Math.max(6, (r1 - r0) * 0.44));
      let col = 0x8fd8ff;
      if (this.buildMode && this.buildMode !== 'select') {
        const ok = g.canBuild(this.buildMode, h.r, h.s).ok;
        col = ok ? 0x6cff9e : 0xff6b6b;
        this.cursor.material.opacity = 0.5;
      } else {
        this.cursor.material.opacity = 0.42;
      }
      this.cursor.material.color.setHex(col);
    }
    // 选中环
    const sel = this.selected;
    if (!sel) { this.selRing.visible = false; return; }
    const ang = FW.angleOf(sel.s);
    const rad = (FW.ringInner(sel.r) + FW.ringOuter(sel.r)) / 2;
    this.selRing.visible = true;
    this.selRing.position.copy(groundPoint(ang, rad));
    this.selRing.position.y = 0.9;
    const arc = rad * SEG;
    this.selRing.scale.set(Math.max(8, arc * 0.5), 1, Math.max(8, RING_W * 0.5));
    this.selRing.material.opacity = 0.55 + 0.35 * Math.sin(this.t * 4);
    // 枢纽范围
    if (!this.hubRing) {
      this.hubRing = new THREE.Mesh(
        new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: 0xffb15e, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false })
      );
      this.scene.add(this.hubRing);
    }
    const t = g.tile(sel.r, sel.s);
    if (t && t.kind === 'hub') {
      this.hubRing.visible = true;
      const rad2 = (FW.ringInner(sel.r) + FW.ringOuter(sel.r)) / 2;
      this.hubRing.scale.set(rad2 * SEG * 1.6, 1, RING_W * 1.6);
      this.hubRing.position.copy(this.selRing.position);
      this.hubRing.position.y = 0.5;
    } else {
      this.hubRing.visible = false;
    }
  };

  FW.Renderer = Renderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
