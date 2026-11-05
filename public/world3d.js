/* global THREE */
(function (global) {
  'use strict';

  const FUNNY_NPC_NAMES = [
    'Tý Lém', 'Sáu Còi', 'Cu Bin', 'Mít Ướt', 'Đậu Phộng', 'Tèo Mới',
    'Ba Khía', 'Chíp Béo', 'Út Lùn', 'Hai Sọc', 'Tám Vẹo', 'Năm Nhí',
    'Bảy Nhớt', 'Cúc Mắm', 'Kem Dừa', 'Phở Gà', 'Bún Chả', 'Trà Đá',
  ];

  const GEO = {};
  function geo(key, factory) {
    if (!GEO[key]) GEO[key] = factory();
    return GEO[key];
  }

  function mat(color, opts) {
    return new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
  }

  function mesh(geometry, material, x, y, z, cast) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = cast !== false;
    m.receiveShadow = true;
    return m;
  }

  function checkerTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    const a = '#d8dce0', b = '#9aa3ad';
    const s = 16;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      ctx.fillStyle = (x + y) % 2 ? a : b;
      ctx.fillRect(x * s, y * s, s, s);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(18, 14);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  function stripeTexture(light, dark) {
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 ? dark : light;
      ctx.fillRect(0, i * 8, 64, 8);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  function createChibiPrisoner(appearance, opts) {
    opts = opts || {};
    const g = new THREE.Group();
    const skin = new THREE.Color(appearance.skin || '#e8b896');
    const hair = new THREE.Color(appearance.hair || '#2a2218');
    const stripeId = appearance.stripe || 'orange';
    const isOrange = stripeId === 'orange' || stripeId === 'orange_solid';
    let bodyMat;
    if (isOrange) {
      bodyMat = mat(0xff7a1a);
    } else {
      const map = stripeId === 'blue'
        ? stripeTexture('#e8f0ff', '#1a3050')
        : stripeTexture('#f5f5f5', '#151515');
      bodyMat = new THREE.MeshLambertMaterial({ map });
    }
    const skinMat = mat(skin.getHex());
    const hairMat = mat(hair.getHex());
    const darkPants = isOrange ? mat(0xe86810) : bodyMat;

    // stubby legs
    const legG = geo('leg', () => new THREE.BoxGeometry(0.22, 0.32, 0.26));
    g.add(mesh(legG, darkPants, -0.14, 0.16, 0));
    g.add(mesh(legG, darkPants, 0.14, 0.16, 0));
    // shoes
    const shoeG = geo('shoe', () => new THREE.BoxGeometry(0.24, 0.1, 0.32));
    g.add(mesh(shoeG, mat(0x222222), -0.14, 0.05, 0.02, false));
    g.add(mesh(shoeG, mat(0x222222), 0.14, 0.05, 0.02, false));
    // body
    const body = mesh(geo('body', () => new THREE.BoxGeometry(0.62, 0.55, 0.38)), bodyMat, 0, 0.58, 0);
    g.add(body);
    // arms
    const armG = geo('arm', () => new THREE.BoxGeometry(0.18, 0.42, 0.18));
    g.add(mesh(armG, bodyMat, -0.42, 0.55, 0));
    g.add(mesh(armG, bodyMat, 0.42, 0.55, 0));
    // number tag
    const tag = mesh(geo('tag', () => new THREE.BoxGeometry(0.32, 0.2, 0.04)), mat(0xffffff), 0, 0.62, 0.2, false);
    g.add(tag);
    // big round head
    const head = mesh(geo('head', () => new THREE.SphereGeometry(0.42, 14, 12)), skinMat, 0, 1.22, 0);
    g.add(head);
    // hair cap
    const hairCap = mesh(geo('hair', () => new THREE.SphereGeometry(0.44, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat, 0, 1.28, 0);
    g.add(hairCap);
    // eyes
    const eyeG = geo('eye', () => new THREE.SphereGeometry(0.055, 8, 6));
    g.add(mesh(eyeG, mat(0x1a1a1a), -0.12, 1.24, 0.36, false));
    g.add(mesh(eyeG, mat(0x1a1a1a), 0.12, 1.24, 0.36, false));
    // smile
    g.add(mesh(geo('smile', () => new THREE.BoxGeometry(0.14, 0.03, 0.02)), mat(0xc06060), 0, 1.12, 0.4, false));

    g.userData.kind = 'prisoner';
    g.userData.isNpc = !!opts.npc;
    g.userData.baseY = 0;
    return g;
  }

  function createChibiGuard(name) {
    const g = new THREE.Group();
    const olive = 0x4a6b3a;
    const blue = 0x2a4a6e;
    const uniform = mat(blue);
    const pants = mat(olive);
    const skinMat = mat(0xe8b896);
    g.add(mesh(geo('leg', () => new THREE.BoxGeometry(0.22, 0.32, 0.26)), pants, -0.14, 0.16, 0));
    g.add(mesh(geo('leg', () => new THREE.BoxGeometry(0.22, 0.32, 0.26)), pants, 0.14, 0.16, 0));
    g.add(mesh(geo('body', () => new THREE.BoxGeometry(0.62, 0.55, 0.38)), uniform, 0, 0.58, 0));
    g.add(mesh(geo('arm', () => new THREE.BoxGeometry(0.18, 0.42, 0.18)), uniform, -0.42, 0.55, 0));
    g.add(mesh(geo('arm', () => new THREE.BoxGeometry(0.18, 0.42, 0.18)), uniform, 0.42, 0.55, 0));
    // red collar patches
    g.add(mesh(geo('patch', () => new THREE.BoxGeometry(0.14, 0.16, 0.04)), mat(0xb02020), -0.22, 0.78, 0.2, false));
    g.add(mesh(geo('patch', () => new THREE.BoxGeometry(0.14, 0.16, 0.04)), mat(0xb02020), 0.22, 0.78, 0.2, false));
    g.add(mesh(geo('head', () => new THREE.SphereGeometry(0.42, 14, 12)), skinMat, 0, 1.22, 0));
    // peaked cap
    g.add(mesh(geo('cap', () => new THREE.CylinderGeometry(0.36, 0.38, 0.16, 12)), mat(olive), 0, 1.55, 0));
    g.add(mesh(geo('brim', () => new THREE.BoxGeometry(0.5, 0.05, 0.28)), mat(olive), 0, 1.48, 0.2, false));
    g.add(mesh(geo('band', () => new THREE.BoxGeometry(0.72, 0.06, 0.72)), mat(0xb02020), 0, 1.48, 0, false));
    g.add(mesh(geo('badge', () => new THREE.BoxGeometry(0.1, 0.1, 0.04)), mat(0xd4a857), 0, 1.56, 0.36, false));
    g.add(mesh(geo('eye', () => new THREE.SphereGeometry(0.055, 8, 6)), mat(0x1a1a1a), -0.12, 1.24, 0.36, false));
    g.add(mesh(geo('eye', () => new THREE.SphereGeometry(0.055, 8, 6)), mat(0x1a1a1a), 0.12, 1.24, 0.36, false));
    g.userData.kind = 'guard';
    g.userData.nickname = name || 'Cán bộ';
    g.userData.isNpc = true;
    return g;
  }

  function addCanteenTable(group, x, z) {
    const metal = mat(0x7a8288);
    const top = mesh(geo('ctop', () => new THREE.BoxGeometry(2.4, 0.1, 0.9)), metal, x, 0.72, z);
    group.add(top);
    group.add(mesh(geo('cleg', () => new THREE.BoxGeometry(0.08, 0.7, 0.08)), metal, x - 1, 0.35, z - 0.35, false));
    group.add(mesh(geo('cleg', () => new THREE.BoxGeometry(0.08, 0.7, 0.08)), metal, x + 1, 0.35, z - 0.35, false));
    group.add(mesh(geo('cleg', () => new THREE.BoxGeometry(0.08, 0.7, 0.08)), metal, x - 1, 0.35, z + 0.35, false));
    group.add(mesh(geo('cleg', () => new THREE.BoxGeometry(0.08, 0.7, 0.08)), metal, x + 1, 0.35, z + 0.35, false));
    // benches
    const bench = mat(0x6a7076);
    group.add(mesh(geo('bench', () => new THREE.BoxGeometry(2.2, 0.08, 0.35)), bench, x, 0.4, z - 0.75));
    group.add(mesh(geo('bench', () => new THREE.BoxGeometry(2.2, 0.08, 0.35)), bench, x, 0.4, z + 0.75));
  }

  function addCellBlock(group, ox, oz, floors) {
    const wall = mat(0xc8ccd0);
    const barMat = mat(0x1a1a1a);
    const rail = mat(0xf0c020);
    const w = 14, d = 4, h = 3.2;
    // back wall
    group.add(mesh(geo('cwall', () => new THREE.BoxGeometry(w, h * floors + 0.4, 0.35)), wall, ox, (h * floors) / 2, oz - d / 2));
    // side walls
    group.add(mesh(geo('cside', () => new THREE.BoxGeometry(0.35, h * floors + 0.4, d)), wall, ox - w / 2, (h * floors) / 2, oz));
    group.add(mesh(geo('cside', () => new THREE.BoxGeometry(0.35, h * floors + 0.4, d)), wall, ox + w / 2, (h * floors) / 2, oz));
    for (let f = 0; f < floors; f++) {
      const y0 = f * h;
      // floor slab
      group.add(mesh(geo('cfloor', () => new THREE.BoxGeometry(w - 0.4, 0.2, d)), mat(0xb0b4b8), ox, y0 + 0.1, oz, false));
      // walkway railing yellow
      if (f > 0) {
        group.add(mesh(geo('rail', () => new THREE.BoxGeometry(w - 0.5, 0.08, 0.08)), rail, ox, y0 + 1.0, oz + d / 2 - 0.15, false));
        group.add(mesh(geo('rail', () => new THREE.BoxGeometry(w - 0.5, 0.08, 0.08)), rail, ox, y0 + 0.55, oz + d / 2 - 0.15, false));
        for (let i = -6; i <= 6; i++) {
          group.add(mesh(geo('railp', () => new THREE.BoxGeometry(0.06, 1.0, 0.06)), rail, ox + i, y0 + 0.55, oz + d / 2 - 0.15, false));
        }
      }
      // cells with bars
      for (let c = -2; c <= 2; c++) {
        const cx = ox + c * 2.6;
        // bunk
        group.add(mesh(geo('bed', () => new THREE.BoxGeometry(1.4, 0.2, 0.7)), mat(0x8a6040), cx, y0 + 0.45, oz - 0.6));
        group.add(mesh(geo('pillow', () => new THREE.BoxGeometry(0.35, 0.12, 0.4)), mat(0xd04040), cx - 0.45, y0 + 0.6, oz - 0.6, false));
        // bars
        for (let b = -3; b <= 3; b++) {
          group.add(mesh(geo('bar', () => new THREE.BoxGeometry(0.06, 2.4, 0.06)), barMat, cx + b * 0.22, y0 + 1.4, oz + d / 2 - 0.05, false));
        }
        group.add(mesh(geo('barh', () => new THREE.BoxGeometry(1.6, 0.06, 0.06)), barMat, cx, y0 + 0.3, oz + d / 2 - 0.05, false));
        group.add(mesh(geo('barh', () => new THREE.BoxGeometry(1.6, 0.06, 0.06)), barMat, cx, y0 + 2.5, oz + d / 2 - 0.05, false));
      }
    }
    // stairs
    const stairMat = mat(0x909498);
    for (let s = 0; s < 8; s++) {
      group.add(mesh(geo('step', () => new THREE.BoxGeometry(1.2, 0.2, 0.4)), stairMat, ox + w / 2 - 1.2, 0.1 + s * 0.38, oz + d / 2 + 0.6 + s * 0.05, false));
    }
  }

  function addBlueWall(group, x, y, z, w, h, d) {
    // lower blue stripe wall
    group.add(mesh(new THREE.BoxGeometry(w, h * 0.45, d), mat(0x2a4a8a), x, y + h * 0.225, z, false));
    group.add(mesh(new THREE.BoxGeometry(w, h * 0.55, d), mat(0xd0d4d8), x, y + h * 0.45 + h * 0.275, z, false));
    group.add(mesh(new THREE.BoxGeometry(w, 0.08, d + 0.02), mat(0xf0c020), x, y + h * 0.45, z, false));
  }

  function World3D(canvas) {
    this.canvas = canvas;
    this.players = new Map();
    this.npcs = [];
    this.guards = [];
    this.bubbles = new Map();
    this.nametagEl = document.getElementById('nametags');
    this.keys = {};
    this.joy = { x: 0, y: 0, active: false };
    this.myId = null;
    this.localPos = { x: 0, y: 0, z: 2, rotY: 0 };
    this.targetPos = null;
    this.speed = 5.2;
    this._lastPosSend = 0;
    this.onPos = null;
    this.onStep = null;
    this.onCook = null;
    this.fallback = false;
    this.shadowsOn = true;
    this.orbitYaw = 0;
    this.orbitPitch = 0.48;
    this.camDist = 11;
    this._drag = null;

    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) || window.innerWidth < 700;
    this.isMobile = isMobile;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75);

    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas, antialias: !isMobile, powerPreference: 'high-performance',
        alpha: false, failIfMajorPerformanceCaveat: false,
      });
    } catch (e) {
      this.fallback = true;
      console.warn('WebGL failed', e);
      return;
    }

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.renderer.setClearColor(0xb8d4f0, 1);
    this.shadowsOn = !isMobile;
    this.renderer.shadowMap.enabled = this.shadowsOn;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb8d4f0, 45, 110);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 140);
    this.camera.position.set(0, 16, 18);

    const hemi = new THREE.HemisphereLight(0xfff5e0, 0x6a8090, 0.85);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff0d0, 0.85);
    this.sun.position.set(18, 28, 12);
    this.sun.castShadow = this.shadowsOn;
    if (this.shadowsOn) {
      this.sun.shadow.mapSize.set(isMobile ? 512 : 1024, isMobile ? 512 : 1024);
      this.sun.shadow.camera.near = 2;
      this.sun.shadow.camera.far = 70;
      const s = 35;
      this.sun.shadow.camera.left = -s;
      this.sun.shadow.camera.right = s;
      this.sun.shadow.camera.top = s;
      this.sun.shadow.camera.bottom = -s;
      this.sun.shadow.bias = -0.0005;
    }
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.28));

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.buildCompound();
    this.spawnNpcs(16);
    this.spawnGuards();

    this._bindInput();
    this._onResize = () => {
      const w = window.innerWidth, h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', this._onResize);
    this._clock = new THREE.Clock();
    this._raf = null;
    this.running = false;
  }

  World3D.prototype.setShadows = function (on) {
    this.shadowsOn = !!on;
    this.renderer.shadowMap.enabled = this.shadowsOn;
    this.sun.castShadow = this.shadowsOn;
  };

  World3D.prototype.buildCompound = function () {
    const g = this.root;

    // === MAIN HALL floor (checker) ===
    const floorMat = new THREE.MeshLambertMaterial({ map: checkerTexture() });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(42, 32), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.01, -2);
    floor.receiveShadow = true;
    g.add(floor);

    // Hall walls — blue stripe
    addBlueWall(g, 0, 0, -18, 42, 5.5, 0.4);
    addBlueWall(g, -21, 0, -2, 0.4, 5.5, 32);
    addBlueWall(g, 21, 0, -2, 0.4, 5.5, 32);
    // open front toward yard — partial
    addBlueWall(g, -12, 0, 14, 16, 5.5, 0.4);
    addBlueWall(g, 12, 0, 14, 16, 5.5, 0.4);

    // Ceiling beams soft
    for (let i = -18; i <= 12; i += 6) {
      g.add(mesh(new THREE.BoxGeometry(40, 0.25, 0.35), mat(0xa8acb0), 0, 5.6, i, false));
    }

    // Two-level cell block at back
    addCellBlock(g, 0, -15.5, 2);

    // Honor board
    g.add(mesh(new THREE.BoxGeometry(2.8, 2.2, 0.12), mat(0xd4a857), -18.5, 2.4, -2, false));
    g.add(mesh(new THREE.BoxGeometry(2.5, 1.9, 0.08), mat(0xf5f0e0), -18.5, 2.4, -1.92, false));

    // Red digital clock (canvas texture)
    const clockC = document.createElement('canvas');
    clockC.width = 128; clockC.height = 64;
    const cctx = clockC.getContext('2d');
    cctx.fillStyle = '#111'; cctx.fillRect(0, 0, 128, 64);
    cctx.fillStyle = '#ff2020'; cctx.font = 'bold 36px monospace';
    cctx.textAlign = 'center'; cctx.fillText('--:--', 64, 42);
    this._clockTex = new THREE.CanvasTexture(clockC);
    this._clockCanvas = clockC;
    this._clockCtx = cctx;
    const clockMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.1), new THREE.MeshBasicMaterial({ map: this._clockTex }));
    clockMesh.position.set(0, 4.2, -17.7);
    g.add(clockMesh);
    this._clockMesh = clockMesh;

    // Canteen tables
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        addCanteenTable(g, -8 + col * 5.5, -2 + row * 4.5);
      }
    }

    // Round game tables (RPS / Caro)
    const roundTop = mat(0x3a6aaa);
    [[8, 4], [12, 0], [8, -4]].forEach(([tx, tz], i) => {
      const top = mesh(geo('rtop', () => new THREE.CylinderGeometry(1.1, 1.1, 0.1, 16)), roundTop, tx, 0.7, tz);
      g.add(top);
      g.add(mesh(geo('rleg', () => new THREE.CylinderGeometry(0.12, 0.15, 0.7, 8)), mat(0x555555), tx, 0.35, tz, false));
      for (let s = 0; s < 4; s++) {
        const ang = (s / 4) * Math.PI * 2;
        g.add(mesh(geo('stool', () => new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10)), mat(0xc03030), tx + Math.cos(ang) * 1.5, 0.4, tz + Math.sin(ang) * 1.5));
      }
    });

    // Kitchen / bếp (right wing)
    g.add(mesh(new THREE.BoxGeometry(10, 0.15, 8), mat(0xb0a090), 16, 0.08, 8, false));
    addBlueWall(g, 16, 0, 4, 10, 4, 0.35);
    g.add(mesh(new THREE.BoxGeometry(2.2, 1.1, 1.0), mat(0x333333), 18, 0.55, 10));
    g.add(mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.15, 10), mat(0xff6622), 18, 1.2, 10));
    addCanteenTable(g, 14, 7);
    addCanteenTable(g, 18, 7);

    // Workshop / xưởng (left)
    g.add(mesh(new THREE.BoxGeometry(10, 0.15, 8), mat(0x808488), -16, 0.08, 8, false));
    g.add(mesh(new THREE.BoxGeometry(2.5, 1.4, 1.2), mat(0x8a7a50), -18, 0.7, 8));
    g.add(mesh(new THREE.BoxGeometry(1.8, 1.0, 1.8), mat(0x4a4a4a), -14, 0.5, 10));
    g.add(mesh(new THREE.BoxGeometry(0.25, 1.6, 0.25), mat(0x333333), -14, 1.0, 7));

    // === OUTDOOR YARD / basketball ===
    const yardMat = mat(0xc45a2a);
    const yard = mesh(new THREE.BoxGeometry(22, 0.12, 18), yardMat, 0, 0.02, 26, false);
    g.add(yard);
    // court lines
    g.add(mesh(new THREE.BoxGeometry(10, 0.02, 0.08), mat(0xffffff), 0, 0.1, 26, false));
    g.add(mesh(new THREE.BoxGeometry(0.08, 0.02, 14), mat(0xffffff), 0, 0.1, 26, false));
    // hoop
    g.add(mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), mat(0x888888), 0, 1.6, 18.5));
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.9, 0.08), mat(0xffffff), 0, 3.3, 18.5, false));
    g.add(mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 16), mat(0xff6600), 0, 2.9, 18.2, false));
    // benches
    g.add(mesh(new THREE.BoxGeometry(3, 0.15, 0.5), mat(0x8a6030), -7, 0.45, 32));
    g.add(mesh(new THREE.BoxGeometry(3, 0.15, 0.5), mat(0x8a6030), 7, 0.45, 32));

    // Perimeter walls + barbed wire
    const wallGrey = mat(0x8a9098);
    [[0, 35, 28, 0.5], [-14, 26, 0.5, 18], [14, 26, 0.5, 18]].forEach(([wx, wz, ww, wd]) => {
      g.add(mesh(new THREE.BoxGeometry(ww, 5, wd), wallGrey, wx, 2.5, wz));
    });
    // barbed coils (torus rings)
    for (let i = -12; i <= 12; i += 2) {
      const coil = mesh(geo('coil', () => new THREE.TorusGeometry(0.35, 0.06, 6, 12)), mat(0x555555), i, 5.2, 35, false);
      coil.rotation.y = Math.PI / 2;
      g.add(coil);
    }
    // Watch tower
    g.add(mesh(new THREE.BoxGeometry(2.4, 7, 2.4), mat(0x6a7078), 12, 3.5, 33));
    g.add(mesh(new THREE.BoxGeometry(3.2, 0.3, 3.2), mat(0x4a5058), 12, 7.1, 33));
    g.add(mesh(new THREE.BoxGeometry(2.8, 1.6, 2.8), mat(0x5a6068), 12, 8.0, 33));
    // windows lit
    g.add(mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), mat(0xffee88), 12, 7.8, 31.55, false));

    // Path connecting hall to yard
    g.add(mesh(new THREE.BoxGeometry(6, 0.08, 12), mat(0x9a9ea4), 0, 0.04, 16, false));

    // Outer grass
    g.add(mesh(new THREE.BoxGeometry(80, 0.05, 80), mat(0x5a9a48), 0, -0.04, 10, false));
  };

  World3D.prototype.spawnGuards = function () {
    const defs = [
      { id: 'g1', name: 'Cán bộ Hùng', x: -17, z: -1 },
      { id: 'g2', name: 'Cán bộ Hữu', x: 10, z: 4 },
      { id: 'g3', name: 'Cán bộ Lan', x: 12, z: 33 },
    ];
    defs.forEach((d) => {
      const g = createChibiGuard(d.name);
      g.position.set(d.x, 0, d.z);
      g.rotation.y = Math.PI;
      g.userData.id = d.id;
      g.userData.nickname = d.name;
      g.userData.kind = 'guard';
      // vision cone (yellow translucent)
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 5.5, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
      );
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(0, 0.9, 2.6);
      cone.visible = true;
      g.add(cone);
      g.userData.cone = cone;
      this.root.add(g);
      this.guards.push(g);
    });
  };

  World3D.prototype.syncGuards = function (list) {
    if (!list || !list.length) return;
    const byId = Object.fromEntries(this.guards.map((g) => [g.userData.id, g]));
    for (const gd of list) {
      const meshG = byId[gd.id];
      if (!meshG) continue;
      meshG.userData.tx = gd.x;
      meshG.userData.tz = gd.z;
      meshG.userData.tRot = gd.rotY || 0;
      meshG.userData.lookingAway = !!gd.lookingAway;
      meshG.userData.alert = !!gd.alert;
      if (meshG.userData.cone) {
        meshG.userData.cone.visible = !gd.lookingAway;
        meshG.userData.cone.material.opacity = gd.alert ? 0.28 : 0.12;
        meshG.userData.cone.material.color.set(gd.alert ? 0xff3333 : 0xffdd44);
      }
    }
  };

  World3D.prototype.spawnNpcs = function (n) {
    const spots = [
      [-6, -1], [-2, 2], [2, -3], [5, 1], [-4, 5], [0, 6],
      [9, 4], [12, 1], [-8, 8], [4, 8], [-14, 8], [16, 8],
      [0, 24], [-5, 28], [5, 27], [2, 22],
    ];
    for (let i = 0; i < n; i++) {
      const name = FUNNY_NPC_NAMES[i % FUNNY_NPC_NAMES.length] + (i >= FUNNY_NPC_NAMES.length ? ' ' + (i + 1) : '');
      const stripe = i % 3 === 0 ? 'bw' : (i % 3 === 1 ? 'orange' : 'blue');
      const skins = ['#e8b896', '#c68642', '#f1c27d', '#8d5524', '#ffdbac'];
      const hairs = ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#708090'];
      const meshP = createChibiPrisoner({
        skin: skins[i % skins.length],
        hair: hairs[i % hairs.length],
        stripe,
      }, { npc: true });
      const sp = spots[i % spots.length];
      meshP.position.set(sp[0] + (Math.random() - 0.5) * 2, 0, sp[1] + (Math.random() - 0.5) * 2);
      meshP.userData.nickname = name;
      meshP.userData.prisonerNo = String(1000 + i * 37);
      meshP.userData.wx = meshP.position.x;
      meshP.userData.wz = meshP.position.z;
      meshP.userData.phase = Math.random() * Math.PI * 2;
      meshP.userData.speed = 0.6 + Math.random() * 0.8;
      meshP.userData.radius = 1.5 + Math.random() * 2.5;
      this.root.add(meshP);
      this.npcs.push(meshP);
    }
  };

  World3D.prototype._bindInput = function () {
    const self = this;
    window.addEventListener('keydown', (e) => {
      self.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { self.keys[e.code] = false; });

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastTap = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('.joystick,button,input,textarea,select,.panel-card,.sidebang,.botbar,.actbar,.dock,.chat-panel,.info-card,.right-menu,.top-tools,.mob-actions')) return;
      // right / two-finger = orbit; left = move
      if (e.button === 2 || e.pointerType === 'pen') {
        self._drag = { x: e.clientX, y: e.clientY, orbit: true };
        return;
      }
      if (e.shiftKey || e.button === 1) {
        self._drag = { x: e.clientX, y: e.clientY, orbit: true };
        return;
      }
      // double-click orbit start on desktop drag
      const now = performance.now();
      if (now - lastTap < 280) {
        self._drag = { x: e.clientX, y: e.clientY, orbit: true };
        lastTap = 0;
        return;
      }
      lastTap = now;
      if (self.joy.active) return;
      const rect = self.canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(pointer, self.camera);
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        self.targetPos = { x: hit.x, z: hit.z };
      }
      self._drag = { x: e.clientX, y: e.clientY, orbit: false, moved: false };
    });
    window.addEventListener('pointermove', (e) => {
      if (!self._drag) return;
      const dx = e.clientX - self._drag.x;
      const dy = e.clientY - self._drag.y;
      if (self._drag.orbit || Math.abs(dx) + Math.abs(dy) > 8) {
        if (!self._drag.orbit && self._drag.moved === false && Math.abs(dx) + Math.abs(dy) > 14) {
          self._drag.orbit = true;
          self.targetPos = null;
        }
        if (self._drag.orbit) {
          self.orbitYaw -= dx * 0.005;
          self.orbitPitch = Math.max(0.25, Math.min(1.1, self.orbitPitch + dy * 0.004));
          self._drag.x = e.clientX;
          self._drag.y = e.clientY;
          self._drag.moved = true;
        }
      }
    });
    window.addEventListener('pointerup', () => { self._drag = null; });
    this.canvas.addEventListener('wheel', (e) => {
      self.camDist = Math.max(8, Math.min(28, self.camDist + e.deltaY * 0.02));
      e.preventDefault();
    }, { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  };

  World3D.prototype.setJoystick = function (x, y, active) {
    this.joy.x = x; this.joy.y = y; this.joy.active = !!active;
    if (active) this.targetPos = null;
  };

  World3D.prototype.setMe = function (id, appearance, x, z) {
    this.myId = id;
    this.localPos.x = (x != null ? x : 0);
    this.localPos.y = 0;
    this.localPos.z = (z != null ? z : 2);
    this.ensurePlayer({ id, nickname: 'Bạn', appearance, x: this.localPos.x, z: this.localPos.z, rotY: 0, isMe: true });
  };

  World3D.prototype.ensurePlayer = function (p) {
    let meshP = this.players.get(p.id);
    const key = (p.appearance && (p.appearance.stripe + p.appearance.skin + p.appearance.hair)) || '';
    if (!meshP) {
      meshP = createChibiPrisoner(p.appearance || {});
      meshP.userData.id = p.id;
      meshP.userData.nickname = p.nickname;
      meshP.userData.prisonerNo = p.prisonerNo;
      meshP.userData.appearKey = key;
      meshP.userData.isMe = !!p.isMe || p.id === this.myId;
      this.root.add(meshP);
      this.players.set(p.id, meshP);
    } else if (p.appearance && meshP.userData.appearKey !== key) {
      this.root.remove(meshP);
      meshP = createChibiPrisoner(p.appearance);
      meshP.userData.id = p.id;
      meshP.userData.nickname = p.nickname;
      meshP.userData.appearKey = key;
      meshP.userData.isMe = p.id === this.myId;
      this.root.add(meshP);
      this.players.set(p.id, meshP);
    }
    if (p.nickname) meshP.userData.nickname = p.nickname;
    if (p.prisonerNo) meshP.userData.prisonerNo = p.prisonerNo;
    if (p.rankEmoji) meshP.userData.rankEmoji = p.rankEmoji;
    if (p.rankName) meshP.userData.rankName = p.rankName;
    if (p.emote) meshP.userData.emote = p.emote;
    if (p.sleeping) meshP.userData.emote = 'sleep';
    return meshP;
  };

  World3D.prototype.syncPlayers = function (list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const meshP = this.ensurePlayer(p);
      if (p.id === this.myId) continue;
      meshP.userData.tx = p.x; meshP.userData.tz = p.z; meshP.userData.tRot = p.rotY || 0;
      if (Math.abs(meshP.position.x) < 0.01 && Math.abs(meshP.position.z) < 0.01) {
        meshP.position.set(p.x, 0, p.z);
      }
    }
    for (const [id, meshP] of this.players) {
      if (!seen.has(id) && id !== this.myId) {
        this.root.remove(meshP);
        this.players.delete(id);
      }
    }
  };

  World3D.prototype.applyPoses = function (list) {
    for (const p of list) {
      if (p.id === this.myId) continue;
      const meshP = this.ensurePlayer(p);
      meshP.userData.tx = p.x; meshP.userData.tz = p.z; meshP.userData.tRot = p.rotY || 0;
      if (p.emote) meshP.userData.emote = p.emote;
    }
  };

  World3D.prototype.showBubble = function (playerId, text, ms) {
    this.bubbles.set(playerId, { text: String(text).slice(0, 60), until: performance.now() + (ms || 4000) });
  };

  World3D.prototype.start = function () {
    if (this.fallback || this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this._raf = requestAnimationFrame(loop);
      this.update(this._clock.getDelta());
      this.renderer.render(this.scene, this.camera);
      this._drawNametags();
    };
    loop();
  };

  World3D.prototype.stop = function () {
    this.running = false;
    if (this._raf) cancelAnimationFrame(this._raf);
  };

  World3D.prototype.update = function (dt) {
    if (dt > 0.05) dt = 0.05;
    let mx = 0, mz = 0;
    if (this.keys.KeyW || this.keys.ArrowUp) mz -= 1;
    if (this.keys.KeyS || this.keys.ArrowDown) mz += 1;
    if (this.keys.KeyA || this.keys.ArrowLeft) mx -= 1;
    if (this.keys.KeyD || this.keys.ArrowRight) mx += 1;
    if (this.joy.active) {
      mx += this.joy.x;
      mz += this.joy.y;
    }
    // rotate move by camera yaw
    if (mx || mz) {
      const cos = Math.cos(this.orbitYaw), sin = Math.sin(this.orbitYaw);
      const rx = mx * cos - mz * sin;
      const rz = mx * sin + mz * cos;
      mx = rx; mz = rz;
    }
    const me = this.players.get(this.myId);
    if (me) {
      if (mx || mz) {
        this.targetPos = null;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;
        this.localPos.x += mx * this.speed * dt;
        this.localPos.z += mz * this.speed * dt;
        this.localPos.rotY = Math.atan2(mx, mz);
        if (this.onStep) this.onStep();
      } else if (this.targetPos) {
        const dx = this.targetPos.x - this.localPos.x;
        const dz = this.targetPos.z - this.localPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.25) this.targetPos = null;
        else {
          this.localPos.x += (dx / dist) * this.speed * dt;
          this.localPos.z += (dz / dist) * this.speed * dt;
          this.localPos.rotY = Math.atan2(dx, dz);
          if (this.onStep) this.onStep();
        }
      }
      this.localPos.x = Math.max(-20, Math.min(20, this.localPos.x));
      this.localPos.z = Math.max(-16, Math.min(36, this.localPos.z));
      // emote pose
      const em = me.userData.emote;
      let y = 0;
      if (em === 'sit') y = -0.25;
      if (em === 'pushup') { y = -0.55; me.rotation.x = Math.PI / 2; }
      else me.rotation.x = 0;
      if (em === 'sleep') y = -0.7;
      me.position.set(this.localPos.x, y, this.localPos.z);
      me.rotation.y = this.localPos.rotY;

      const cy = Math.sin(this.orbitPitch) * this.camDist;
      const cz = Math.cos(this.orbitPitch) * this.camDist;
      const tx = this.localPos.x + Math.sin(this.orbitYaw) * cz;
      const tz = this.localPos.z + Math.cos(this.orbitYaw) * cz;
      const ty = (this.localPos.y || 0) + cy + 2;
      this.camera.position.x += (tx - this.camera.position.x) * 0.12;
      this.camera.position.y += (ty - this.camera.position.y) * 0.12;
      this.camera.position.z += (tz - this.camera.position.z) * 0.12;
      this.camera.lookAt(this.localPos.x, 1.3, this.localPos.z);

      const now = performance.now();
      if (now - this._lastPosSend > 90 && this.onPos) {
        this._lastPosSend = now;
        this.onPos(this.localPos.x, this.localPos.z, this.localPos.rotY);
      }
    }

    for (const [id, meshP] of this.players) {
      if (id === this.myId) continue;
      if (meshP.userData.tx == null) continue;
      meshP.position.x += (meshP.userData.tx - meshP.position.x) * 0.22;
      meshP.position.z += (meshP.userData.tz - meshP.position.z) * 0.22;
      const tr = meshP.userData.tRot || 0;
      meshP.rotation.y += (tr - meshP.rotation.y) * 0.22;
      const em = meshP.userData.emote;
      if (em === 'pushup') { meshP.rotation.x = Math.PI / 2; meshP.position.y = -0.55; }
      else if (em === 'sit') { meshP.rotation.x = 0; meshP.position.y = -0.25; }
      else if (em === 'sleep') { meshP.rotation.x = Math.PI / 2; meshP.position.y = -0.7; }
      else { meshP.rotation.x = 0; meshP.position.y = 0; }
    }

    // wander NPCs
    const t = performance.now() * 0.001;
    this.npcs.forEach((n, i) => {
      const ang = t * n.userData.speed * 0.35 + n.userData.phase;
      const tx = n.userData.wx + Math.cos(ang) * n.userData.radius;
      const tz = n.userData.wz + Math.sin(ang) * n.userData.radius * 0.7;
      n.position.x += (tx - n.position.x) * 0.04;
      n.position.z += (tz - n.position.z) * 0.04;
      n.rotation.y = Math.atan2(tx - n.position.x, tz - n.position.z) || n.rotation.y;
      // occasional idle bob
      n.position.y = Math.sin(t * 3 + i) * 0.02;
    });
    this.guards.forEach((g) => {
      if (g.userData.tx != null) {
        g.position.x += (g.userData.tx - g.position.x) * 0.12;
        g.position.z += (g.userData.tz - g.position.z) * 0.12;
        const tr = g.userData.tRot || 0;
        let dy = tr - g.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        g.rotation.y += dy * 0.12;
      }
      if (g.userData.lookingAway) g.rotation.y += 0.02; // idle glance away
    });

    // update clock texture ~1Hz
    if (!this._lastClock || performance.now() - this._lastClock > 1000) {
      this._lastClock = performance.now();
      const d = new Date();
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const ctx = this._clockCtx;
      if (ctx) {
        ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 128, 64);
        ctx.fillStyle = '#ff2020'; ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center'; ctx.fillText(hh + ':' + mm, 64, 42);
        this._clockTex.needsUpdate = true;
      }
    }
  };

  World3D.prototype._drawNametags = function () {
    if (!this.nametagEl) return;
    const w = window.innerWidth, h = window.innerHeight;
    const now = performance.now();
    let html = '';
    const drawOne = (meshP, cls) => {
      const pos = meshP.position.clone();
      pos.y = 2.15;
      pos.project(this.camera);
      if (pos.z > 1) return; // behind/far clip in NDC
      const x = (pos.x * 0.5 + 0.5) * w;
      const y = (-pos.y * 0.5 + 0.5) * h;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return;
      const name = meshP.userData.nickname || '?';
      const isMe = meshP.userData.id === this.myId;
      const isPlayer = !meshP.userData.isNpc && meshP.userData.kind !== 'guard';
      const tagCls = cls || (isMe || isPlayer ? 'ntag me' : 'ntag npc');
      const badge = (isPlayer || isMe) && meshP.userData.rankEmoji
        ? `<span class="rank-badge" title="${escapeHtml(meshP.userData.rankName || '')}">${escapeHtml(meshP.userData.rankEmoji)}</span>`
        : '';
      html += `<div class="${tagCls}" style="transform:translate(${x}px,${y}px) translate(-50%,-100%)">${badge}${escapeHtml(name)}</div>`;
      const bub = this.bubbles.get(meshP.userData.id);
      if (bub && bub.until > now) {
        html += `<div class="sbubble" style="transform:translate(${x}px,${y - 28}px) translate(-50%,-100%)">${escapeHtml(bub.text)}</div>`;
      }
    };
    for (const [, meshP] of this.players) drawOne(meshP);
    for (const n of this.npcs) drawOne(n, 'ntag npc');
    for (const g of this.guards) drawOne(g, 'ntag guard');
    this.nametagEl.innerHTML = html;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  global.World3D = World3D;
})(window);
