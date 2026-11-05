/* global THREE */
(function (global) {
  'use strict';

  const STRIPE = {
    bw: { light: 0xf5f5f5, dark: 0x151515 },
    blue: { light: 0xe8f0ff, dark: 0x1a3050 },
    orange: { light: 0xfff0e0, dark: 0x6a3010 },
  };

  function makeMat(color, opts) {
    return new THREE.MeshStandardMaterial(Object.assign({
      color, roughness: 0.85, metalness: 0.05, flatShading: true,
    }, opts || {}));
  }

  function box(w, h, d, color, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(color));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  function cyl(rT, rB, h, color, x, y, z, seg) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, seg || 8), makeMat(color));
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true;
    return m;
  }

  function createPrisoner(appearance) {
    const g = new THREE.Group();
    const skin = new THREE.Color(appearance.skin || '#e0b090');
    const hair = new THREE.Color(appearance.hair || '#2a2218');
    const stripe = STRIPE[appearance.stripe] || STRIPE.bw;

    // legs
    g.add(box(0.28, 0.55, 0.28, stripe.dark, -0.18, 0.28, 0));
    g.add(box(0.28, 0.55, 0.28, stripe.dark, 0.18, 0.28, 0));
    // torso stripes (stacked boxes)
    for (let i = 0; i < 5; i++) {
      const c = i % 2 === 0 ? stripe.light : stripe.dark;
      g.add(box(0.7, 0.16, 0.42, c, 0, 0.65 + i * 0.16, 0));
    }
    // arms
    g.add(box(0.2, 0.55, 0.2, stripe.light, -0.48, 0.85, 0));
    g.add(box(0.2, 0.55, 0.2, stripe.light, 0.48, 0.85, 0));
    // head
    const head = box(0.48, 0.48, 0.48, skin.getHex(), 0, 1.55, 0);
    g.add(head);
    // hair
    g.add(box(0.52, 0.18, 0.52, hair.getHex(), 0, 1.82, 0));
    // number tag
    g.add(box(0.28, 0.18, 0.04, 0xf0e090, 0, 1.05, 0.22));
    g.userData.kind = 'prisoner';
    return g;
  }

  function createGuard() {
    const g = new THREE.Group();
    const olive = 0x4a5c2e;
    const dark = 0x2e3a1c;
    const red = 0xa02020;
    const gold = 0xd4a857;
    g.add(box(0.3, 0.55, 0.3, dark, -0.16, 0.28, 0));
    g.add(box(0.3, 0.55, 0.3, dark, 0.16, 0.28, 0));
    g.add(box(0.72, 0.85, 0.42, olive, 0, 0.95, 0));
    // red collar patches
    g.add(box(0.18, 0.22, 0.06, red, -0.28, 1.28, 0.2));
    g.add(box(0.18, 0.22, 0.06, red, 0.28, 1.28, 0.2));
    g.add(box(0.22, 0.6, 0.22, olive, -0.48, 0.9, 0));
    g.add(box(0.22, 0.6, 0.22, olive, 0.48, 0.9, 0));
    const head = box(0.46, 0.46, 0.46, 0xe0b090, 0, 1.58, 0);
    g.add(head);
    // peaked cap
    g.add(cyl(0.32, 0.34, 0.18, olive, 0, 1.88, 0, 10));
    g.add(box(0.5, 0.06, 0.28, olive, 0, 1.8, 0.22));
    g.add(box(0.5, 0.06, 0.5, red, 0, 1.78, 0)); // red band
    g.add(box(0.12, 0.1, 0.04, gold, 0, 1.86, 0.34)); // badge
    g.userData.kind = 'guard';
    return g;
  }

  function buildRoomShell(group, cx, cz, w, d, wallH, wallColor, floorColor, label) {
    const floor = box(w, 0.15, d, floorColor, cx, 0.05, cz);
    floor.receiveShadow = true;
    group.add(floor);
    const t = 0.35;
    // walls with doorway gaps on +z/-z for connectivity — simplified full walls low
    group.add(box(w + t, wallH, t, wallColor, cx, wallH / 2, cz - d / 2));
    group.add(box(w + t, wallH, t, wallColor, cx, wallH / 2, cz + d / 2));
    group.add(box(t, wallH, d, wallColor, cx - w / 2, wallH / 2, cz));
    group.add(box(t, wallH, d, wallColor, cx + w / 2, wallH / 2, cz));
    // doorway cut illusion: darker arch markers
    group.add(box(2.2, 2.2, 0.2, 0x1a1008, cx, 1.1, cz + d / 2 - 0.05));
    if (label) {
      // sign board
      group.add(box(2.4, 0.5, 0.12, 0x3a2a18, cx, wallH + 0.2, cz));
    }
  }

  function addBed(group, x, z) {
    group.add(box(1.6, 0.25, 0.7, 0x5a4030, x, 0.35, z));
    group.add(box(1.5, 0.12, 0.6, 0xd0c8b0, x, 0.5, z));
    group.add(box(0.4, 0.18, 0.5, 0xc0b090, x - 0.5, 0.58, z));
  }

  function addTable(group, x, z, w, d) {
    group.add(box(w, 0.12, d, 0x6a4a30, x, 0.7, z));
    group.add(box(0.1, 0.7, 0.1, 0x4a3020, x - w / 2 + 0.1, 0.35, z - d / 2 + 0.1));
    group.add(box(0.1, 0.7, 0.1, 0x4a3020, x + w / 2 - 0.1, 0.35, z - d / 2 + 0.1));
    group.add(box(0.1, 0.7, 0.1, 0x4a3020, x - w / 2 + 0.1, 0.35, z + d / 2 - 0.1));
    group.add(box(0.1, 0.7, 0.1, 0x4a3020, x + w / 2 - 0.1, 0.35, z + d / 2 - 0.1));
  }

  function addChair(group, x, z) {
    group.add(box(0.45, 0.08, 0.45, 0x5a4030, x, 0.45, z));
    group.add(box(0.45, 0.5, 0.08, 0x5a4030, x, 0.7, z - 0.18));
  }

  function World3D(canvas) {
    this.canvas = canvas;
    this.players = new Map();
    this.guards = [];
    this.nametagEl = document.getElementById('nametags');
    this.keys = {};
    this.joy = { x: 0, y: 0, active: false };
    this.myId = null;
    this.localPos = { x: 0, z: 0, rotY: 0 };
    this.targetPos = null;
    this.speed = 5.5;
    this._lastPosSend = 0;
    this.onPos = null;
    this.onRoomHint = null;
    this.fallback = false;

    const isMobile = /Mobi|Android/i.test(navigator.userAgent);
    const pixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);

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
    this.renderer.setClearColor(0x87a0b8, 1);
    this.renderer.shadowMap.enabled = !isMobile;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87a0b8, 35, 90);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camera.position.set(0, 12, 16);

    // lights
    const hemi = new THREE.HemisphereLight(0xffeeb8, 0x3a2a18, 0.7);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2d0, 0.95);
    sun.position.set(20, 30, 10);
    sun.castShadow = !isMobile;
    if (sun.castShadow) {
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 80;
      sun.shadow.camera.left = -40;
      sun.shadow.camera.right = 40;
      sun.shadow.camera.top = 40;
      sun.shadow.camera.bottom = -40;
    }
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0x8899aa, 0.35));

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.buildCompound();

    // ground outside
    const ground = box(100, 0.08, 100, 0x3d5a32, 0, -0.02, 5);
    ground.receiveShadow = true;
    this.scene.add(ground);

    // path
    this.scene.add(box(4, 0.1, 50, 0x6b5b45, 0, 0.02, 5));
    this.scene.add(box(40, 0.1, 3.5, 0x6b5b45, 0, 0.02, 0));

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

  World3D.prototype.buildCompound = function () {
    const g = this.root;
    // Phòng A
    buildRoomShell(g, -16, -14, 10, 10, 3.2, 0x6a5040, 0x8a7060, 'A');
    addBed(g, -18, -16); addBed(g, -14, -16);
    g.add(box(0.2, 2.2, 0.2, 0x333333, -16, 1.1, -18.8)); // bars hint
    // Phòng B
    buildRoomShell(g, 16, -14, 10, 10, 3.2, 0x6a5040, 0x8a7060, 'B');
    addBed(g, 14, -16); addBed(g, 18, -16);
    // Sân trại
    buildRoomShell(g, 0, 0, 18, 16, 1.2, 0x5a6a40, 0x4a7a3a, 'Sân');
    // lower walls for yard — reopen by not covering fully: add posts
    for (let i = -8; i <= 8; i += 4) {
      g.add(cyl(0.2, 0.25, 2.5, 0x888888, i, 1.25, -8, 6));
      g.add(cyl(0.2, 0.25, 2.5, 0x888888, i, 1.25, 8, 6));
    }
    // exercise bars
    g.add(box(3, 0.12, 0.12, 0x444444, -4, 2.0, 2));
    g.add(box(0.12, 2, 0.12, 0x444444, -5.5, 1, 2));
    g.add(box(0.12, 2, 0.12, 0x444444, -2.5, 1, 2));
    // Nhà ăn / bếp
    buildRoomShell(g, 16, 14, 12, 10, 3.4, 0x7a5a40, 0xb08a60, 'Ăn');
    addTable(g, 14, 14, 3.2, 1.2);
    addTable(g, 18, 14, 3.2, 1.2);
    addChair(g, 13, 12.5); addChair(g, 15, 12.5);
    addChair(g, 17, 12.5); addChair(g, 19, 12.5);
    // stove
    g.add(box(1.4, 0.9, 0.8, 0x333333, 20, 0.5, 17));
    g.add(cyl(0.25, 0.3, 0.2, 0xff6622, 20, 1.05, 17, 8));
    // Xưởng
    buildRoomShell(g, -16, 14, 12, 10, 3.4, 0x5a5a5a, 0x707070, 'Xưởng');
    g.add(box(2, 1.2, 1, 0x8a7a50, -18, 0.7, 14));
    g.add(box(1.5, 0.8, 1.5, 0x4a4a4a, -14, 0.5, 16));
    g.add(box(0.3, 1.5, 0.3, 0x333333, -14, 1.2, 14));
    // Tường rào
    buildRoomShell(g, 0, 28, 20, 8, 4.5, 0x555555, 0x6a6a5a, 'Rào');
    for (let i = -9; i <= 9; i += 1.5) {
      g.add(box(0.15, 4, 0.15, 0x333333, i, 2, 24.2));
      g.add(box(0.15, 4, 0.15, 0x333333, i, 2, 31.8));
    }
    g.add(box(20, 0.2, 0.2, 0x222222, 0, 4, 24.2));
    g.add(box(20, 0.2, 0.2, 0x222222, 0, 4, 31.8));
    // watchtower
    g.add(box(2.2, 6, 2.2, 0x6a5a4a, 10, 3, 28));
    g.add(box(3, 0.3, 3, 0x4a3a2a, 10, 6.2, 28));
    // Bảng thư / bàn trực
    buildRoomShell(g, 8, -4, 7, 6, 2.8, 0x4a5c2e, 0x8a8060, 'Thư');
    g.add(box(2.5, 1.8, 0.15, 0xd2c4a0, 8, 1.4, -6.8)); // board
    addTable(g, 8, -3, 1.8, 0.9);
    // office lamp
    g.add(cyl(0.08, 0.08, 1.2, 0x333333, 7, 1.2, -3, 6));
    g.add(cyl(0.25, 0.3, 0.15, 0xffeeaa, 7, 1.85, -3, 8));

    // outer fence ring
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const fx = Math.cos(ang) * 38;
      const fz = Math.sin(ang) * 38 + 5;
      g.add(box(0.25, 3.5, 0.25, 0x444444, fx, 1.75, fz));
    }

    // static guards
    const g1 = createGuard(); g1.position.set(2, 0, 4); g1.rotation.y = Math.PI; this.root.add(g1); this.guards.push(g1);
    const g2 = createGuard(); g2.position.set(10, 0, 28); g2.rotation.y = Math.PI; this.root.add(g2); this.guards.push(g2);
    const g3 = createGuard(); g3.position.set(8, 0, -2); this.root.add(g3); this.guards.push(g3);
  };

  World3D.prototype._bindInput = function () {
    const self = this;
    window.addEventListener('keydown', (e) => {
      self.keys[e.code] = true;
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { self.keys[e.code] = false; });

    // tap-to-move via raycast
    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('.joystick,button,input,textarea,select,.panel-card,.sidebang,.botbar,.actbar')) return;
      if (self.joy.active) return;
      const rect = self.canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      ray.setFromCamera(pointer, self.camera);
      // intersect y=0 plane
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hit = new THREE.Vector3();
      if (ray.ray.intersectPlane(plane, hit)) {
        self.targetPos = { x: hit.x, z: hit.z };
      }
    });
  };

  World3D.prototype.setJoystick = function (x, y, active) {
    this.joy.x = x; this.joy.y = y; this.joy.active = !!active;
    if (active) this.targetPos = null;
  };

  World3D.prototype.setMe = function (id, appearance, x, z) {
    this.myId = id;
    this.localPos.x = x || 0;
    this.localPos.z = z || 0;
    this.ensurePlayer({ id, nickname: 'Bạn', appearance, x: this.localPos.x, z: this.localPos.z, rotY: 0 });
  };

  World3D.prototype.ensurePlayer = function (p) {
    let mesh = this.players.get(p.id);
    if (!mesh) {
      mesh = createPrisoner(p.appearance || {});
      mesh.userData.id = p.id;
      mesh.userData.nickname = p.nickname;
      mesh.userData.prisonerNo = p.prisonerNo;
      this.root.add(mesh);
      this.players.set(p.id, mesh);
    } else if (p.appearance && mesh.userData.stripe !== (p.appearance.stripe + p.appearance.skin)) {
      this.root.remove(mesh);
      mesh = createPrisoner(p.appearance);
      mesh.userData.id = p.id;
      mesh.userData.nickname = p.nickname;
      mesh.userData.stripe = p.appearance.stripe + p.appearance.skin;
      this.root.add(mesh);
      this.players.set(p.id, mesh);
    }
    if (p.nickname) mesh.userData.nickname = p.nickname;
    if (p.prisonerNo) mesh.userData.prisonerNo = p.prisonerNo;
    return mesh;
  };

  World3D.prototype.syncPlayers = function (list) {
    const seen = new Set();
    for (const p of list) {
      seen.add(p.id);
      const mesh = this.ensurePlayer(p);
      if (p.id === this.myId) continue;
      mesh.userData.tx = p.x; mesh.userData.tz = p.z; mesh.userData.tRot = p.rotY || 0;
      if (mesh.position.x === 0 && mesh.position.z === 0) {
        mesh.position.set(p.x, 0, p.z);
      }
    }
    for (const [id, mesh] of this.players) {
      if (!seen.has(id) && id !== this.myId) {
        this.root.remove(mesh);
        this.players.delete(id);
      }
    }
  };

  World3D.prototype.applyPoses = function (list) {
    for (const p of list) {
      if (p.id === this.myId) continue;
      const mesh = this.ensurePlayer(p);
      mesh.userData.tx = p.x; mesh.userData.tz = p.z; mesh.userData.tRot = p.rotY || 0;
    }
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
    const me = this.players.get(this.myId);
    if (me) {
      if (mx || mz) {
        this.targetPos = null;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;
        this.localPos.x += mx * this.speed * dt;
        this.localPos.z += mz * this.speed * dt;
        this.localPos.rotY = Math.atan2(mx, mz);
      } else if (this.targetPos) {
        const dx = this.targetPos.x - this.localPos.x;
        const dz = this.targetPos.z - this.localPos.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.2) this.targetPos = null;
        else {
          this.localPos.x += (dx / dist) * this.speed * dt;
          this.localPos.z += (dz / dist) * this.speed * dt;
          this.localPos.rotY = Math.atan2(dx, dz);
        }
      }
      // clamp
      this.localPos.x = Math.max(-36, Math.min(36, this.localPos.x));
      this.localPos.z = Math.max(-36, Math.min(40, this.localPos.z));
      me.position.set(this.localPos.x, 0, this.localPos.z);
      me.rotation.y = this.localPos.rotY;

      // third-person camera
      const camDist = 11;
      const camH = 8;
      const cx = this.localPos.x - Math.sin(0) * 0 + 0;
      const cz = this.localPos.z + camDist;
      this.camera.position.x += (this.localPos.x - this.camera.position.x) * 0.08;
      this.camera.position.z += (this.localPos.z + camDist - this.camera.position.z) * 0.08;
      this.camera.position.y += (camH - this.camera.position.y) * 0.08;
      this.camera.lookAt(this.localPos.x, 1.2, this.localPos.z);

      const now = performance.now();
      if (now - this._lastPosSend > 80 && this.onPos) {
        this._lastPosSend = now;
        this.onPos(this.localPos.x, this.localPos.z, this.localPos.rotY);
      }
    }

    // interpolate others
    for (const [id, mesh] of this.players) {
      if (id === this.myId) continue;
      if (mesh.userData.tx == null) continue;
      mesh.position.x += (mesh.userData.tx - mesh.position.x) * 0.2;
      mesh.position.z += (mesh.userData.tz - mesh.position.z) * 0.2;
      const tr = mesh.userData.tRot || 0;
      mesh.rotation.y += (tr - mesh.rotation.y) * 0.2;
    }

    // idle guards sway
    const t = performance.now() * 0.001;
    this.guards.forEach((g, i) => {
      g.rotation.y = Math.sin(t * 0.4 + i) * 0.3 + (i === 1 ? Math.PI : 0);
    });
  };

  World3D.prototype._drawNametags = function () {
    if (!this.nametagEl) return;
    const w = window.innerWidth, h = window.innerHeight;
    let html = '';
    for (const [, mesh] of this.players) {
      const pos = mesh.position.clone();
      pos.y = 2.3;
      pos.project(this.camera);
      if (pos.z > 1) continue;
      const x = (pos.x * 0.5 + 0.5) * w;
      const y = (-pos.y * 0.5 + 0.5) * h;
      const name = mesh.userData.nickname || '?';
      const no = mesh.userData.prisonerNo ? ` · ${mesh.userData.prisonerNo}` : '';
      html += `<div class="ntag" style="transform:translate(${x}px,${y}px) translate(-50%,-100%)">${escapeHtml(name)}<small>${escapeHtml(no)}</small></div>`;
    }
    // guard tags
    this.guards.forEach((g, i) => {
      const pos = g.position.clone(); pos.y = 2.4; pos.project(this.camera);
      if (pos.z > 1) return;
      const x = (pos.x * 0.5 + 0.5) * w;
      const y = (-pos.y * 0.5 + 0.5) * h;
      html += `<div class="ntag guard" style="transform:translate(${x}px,${y}px) translate(-50%,-100%)">Quản trại ${String.fromCharCode(65 + i)}</div>`;
    });
    this.nametagEl.innerHTML = html;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  global.World3D = World3D;
})(window);
