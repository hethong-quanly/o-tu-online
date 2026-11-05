/* 3d-v10 — cute procedural chibi characters + country uniforms (mobile-safe) */
import * as THREE from 'three';
import { AssetLibrary } from './asset-lib.js';
import { createChibiCharacter } from './chibi.js';


  const FUNNY_NPC_NAMES = [
    'Tý Lém', 'Sáu Còi', 'Cu Bin', 'Mít Ướt', 'Đậu Phộng', 'Tèo Mới',
    'Ba Khía', 'Chíp Béo', 'Út Lùn', 'Hai Sọc', 'Tám Vẹo', 'Năm Nhí',
    'Bảy Nhớt', 'Cúc Mắm', 'Kem Dừa', 'Phở Gà', 'Bún Chả', 'Trà Đá',
    'Sếp Rau', 'Thợ May', 'Thợ Mộc', 'Cán bộ Tiếp nhận',
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

  function makeCanvasTex(draw, w, h, repeatX, repeatY) {
    const c = document.createElement('canvas');
    c.width = w || 128; c.height = h || 128;
    draw(c.getContext('2d'), c.width, c.height);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX || 1, repeatY || 1);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }

  function checkerTexture() {
    return makeCanvasTex((ctx, w, h) => {
      const a = '#d8dce0', b = '#9aa3ad', s = 16;
      for (let y = 0; y < h / s; y++) for (let x = 0; x < w / s; x++) {
        ctx.fillStyle = (x + y) % 2 ? a : b;
        ctx.fillRect(x * s, y * s, s, s);
      }
    }, 128, 128, 22, 16);
  }

  function concreteTexture() {
    return makeCanvasTex((ctx, w, h) => {
      ctx.fillStyle = '#a8adb4';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 400; i++) {
        const g = 140 + (Math.random() * 50 | 0);
        ctx.fillStyle = 'rgba(' + g + ',' + g + ',' + (g + 4) + ',' + (0.15 + Math.random() * 0.25) + ')';
        ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 1 + Math.random() * 3);
      }
      ctx.strokeStyle = 'rgba(80,85,90,0.25)';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, Math.random() * h);
        ctx.lineTo(Math.random() * w, Math.random() * h);
        ctx.stroke();
      }
    }, 128, 128, 8, 6);
  }

  function brickTexture() {
    return makeCanvasTex((ctx, w, h) => {
      ctx.fillStyle = '#6a5550';
      ctx.fillRect(0, 0, w, h);
      const bw = 28, bh = 14;
      for (let y = 0, row = 0; y < h; y += bh, row++) {
        const off = (row % 2) * (bw / 2);
        for (let x = -bw; x < w; x += bw) {
          const r = 140 + (Math.random() * 40 | 0);
          ctx.fillStyle = 'rgb(' + r + ',' + (70 + (Math.random() * 30 | 0)) + ',' + (55 + (Math.random() * 25 | 0)) + ')';
          ctx.fillRect(x + off + 1, y + 1, bw - 2, bh - 2);
        }
      }
    }, 128, 128, 4, 3);
  }

  function woodTexture() {
    return makeCanvasTex((ctx, w, h) => {
      ctx.fillStyle = '#8a6238';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 18; i++) {
        ctx.strokeStyle = 'rgba(60,35,15,' + (0.15 + Math.random() * 0.25) + ')';
        ctx.beginPath();
        ctx.moveTo(0, i * 7 + Math.random() * 3);
        ctx.bezierCurveTo(w * 0.3, i * 7 + 4, w * 0.7, i * 7 - 2, w, i * 7 + 2);
        ctx.stroke();
      }
    }, 128, 128, 2, 2);
  }

  function grassTexture() {
    return makeCanvasTex((ctx, w, h) => {
      ctx.fillStyle = '#4a8a38';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 600; i++) {
        ctx.fillStyle = 'rgba(' + (40 + Math.random() * 80 | 0) + ',' + (100 + Math.random() * 80 | 0) + ',' + (30 + Math.random() * 40 | 0) + ',0.55)';
        ctx.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 4);
      }
    }, 128, 128, 12, 12);
  }

  function stripeTexture(light, dark) {
    return makeCanvasTex((ctx, w, h) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 ? dark : light;
        ctx.fillRect(0, i * (h / 8), w, h / 8);
      }
    }, 64, 64, 1, 1);
  }

  function uniformTexture(stripeId, number) {
    const isOrange = stripeId === 'orange' || stripeId === 'orange_solid';
    const isPolice = stripeId === 'police';
    const isBrown = stripeId === 'brown';
    const isBlue = stripeId === 'blue' || stripeId === 'blue_white';
    // Vertical body stripes → bands vary in X
    const light = isPolice ? '#2f5a32' : (isBlue ? '#e8f0ff' : (isOrange ? '#ff8a2a' : (isBrown ? '#8b5a2b' : '#f5f5f5')));
    const dark = isPolice ? '#1a3018' : (isBlue ? '#1a4060' : (isOrange ? '#e06010' : (isBrown ? '#5a3a1a' : '#151515')));
    return makeCanvasTex((ctx, w, h) => {
      if (isOrange || isBrown || isPolice) {
        ctx.fillStyle = light;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = isPolice ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.14)';
          ctx.fillRect(8 + i * 9, 0, 3, h);
        }
        if (isPolice) {
          ctx.fillStyle = '#b01020';
          ctx.fillRect(0, 0, w, 4);
        }
      } else {
        // vertical stripes (VN / CN)
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? dark : light;
          ctx.fillRect(i * 8, 0, 8, h);
        }
        for (let i = 0; i < 5; i++) {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(0, 10 + i * 10, w, 2);
        }
      }
      // number patch
      ctx.fillStyle = '#fff';
      ctx.fillRect(18, 22, 28, 18);
      ctx.strokeStyle = '#333';
      ctx.strokeRect(18, 22, 28, 18);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(number || '001').slice(-3), 32, 35);
    }, 64, 64, 1, 1);
  }

  function faceTexture(expression) {
    expression = expression || 'neutral';
    return makeCanvasTex((ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      // skin undertone already on mesh; draw features
      // brows
      ctx.strokeStyle = '#2a1a10';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(18, 28); ctx.quadraticCurveTo(28, 24, 36, 28);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(46, 28); ctx.quadraticCurveTo(54, 24, 62, 28);
      ctx.stroke();
      // eyes
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(28, 36, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(52, 36, 7, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2a4a6a';
      ctx.beginPath(); ctx.arc(28, 36, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(52, 36, 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(28, 36, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(52, 36, 1.5, 0, Math.PI * 2); ctx.fill();
      // nose
      ctx.strokeStyle = 'rgba(120,70,50,0.5)';
      ctx.beginPath(); ctx.moveTo(40, 40); ctx.lineTo(38, 48); ctx.lineTo(42, 48); ctx.stroke();
      // mouth
      ctx.strokeStyle = '#a04040';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (expression === 'smile' || expression === 'happy') {
        ctx.arc(40, 52, 8, 0.15, Math.PI - 0.15);
      } else if (expression === 'talk') {
        ctx.ellipse(40, 56, 5, 4, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#602020'; ctx.fill();
      } else {
        ctx.moveTo(32, 56); ctx.quadraticCurveTo(40, 60, 48, 56);
      }
      ctx.stroke();
    }, 80, 80, 1, 1);
  }

  function createProceduralPrisoner(appearance, opts) {
    opts = opts || {};
    const g = new THREE.Group();
    const skin = new THREE.Color(appearance.skin || '#e8b896');
    const hair = new THREE.Color(appearance.hair || '#2a2218');
    const countryMap = { vn: 'bw', us: 'orange', cn: 'blue', other: 'brown' };
    let stripeId = appearance.stripe || 'bw';
    if (appearance.country && countryMap[appearance.country] && stripeId !== 'police') {
      stripeId = countryMap[appearance.country];
    }
    const isOrange = stripeId === 'orange' || stripeId === 'orange_solid';
    const isPolice = stripeId === 'police';
    const isBrown = stripeId === 'brown';
    const skinMat = mat(skin.getHex());
    const hairMat = mat(hair.getHex());
    const uniMap = uniformTexture(stripeId, opts.number || appearance.number || '007');
    const bodyMat = new THREE.MeshLambertMaterial({ map: uniMap });
    const pantsMat = isPolice ? mat(0x2f5a32) : ((isOrange || isBrown) ? bodyMat : bodyMat);
    const shoeMat = mat(isPolice ? 0x1a1a1a : 0x2a2218);
    // Slightly narrower torso for female/nu procedural
    const female = (appearance.gender === 'nu') || appearance.bodyStyle === 'female' || appearance.body === 'female';
    const torsoW = female ? 0.5 : 0.58;
    const hipScale = female ? 0.95 : 1;

    // hips root for animation
    const hips = new THREE.Group(); hips.name = 'hips'; g.add(hips);

    const legL = new THREE.Group(); legL.position.set(-0.13, 0.55, 0); hips.add(legL);
    const thighL = mesh(geo('thigh', () => new THREE.BoxGeometry(0.2, 0.38, 0.24)), pantsMat, 0, -0.19, 0);
    legL.add(thighL);
    const shinL = new THREE.Group(); shinL.position.set(0, -0.38, 0); legL.add(shinL);
    shinL.add(mesh(geo('shin', () => new THREE.BoxGeometry(0.18, 0.34, 0.22)), pantsMat, 0, -0.17, 0));
    const footL = mesh(geo('foot', () => new THREE.BoxGeometry(0.22, 0.1, 0.34)), shoeMat, 0, -0.38, 0.04);
    shinL.add(footL);

    const legR = new THREE.Group(); legR.position.set(0.13, 0.55, 0); hips.add(legR);
    legR.add(mesh(geo('thigh', () => new THREE.BoxGeometry(0.2, 0.38, 0.24)), pantsMat, 0, -0.19, 0));
    const shinR = new THREE.Group(); shinR.position.set(0, -0.38, 0); legR.add(shinR);
    shinR.add(mesh(geo('shin', () => new THREE.BoxGeometry(0.18, 0.34, 0.22)), pantsMat, 0, -0.17, 0));
    shinR.add(mesh(geo('foot', () => new THREE.BoxGeometry(0.22, 0.1, 0.34)), shoeMat, 0, -0.38, 0.04));

    const torso = new THREE.Group(); torso.position.set(0, 0.55, 0); hips.add(torso);
    const body = mesh(geo('torso', () => new THREE.BoxGeometry(torsoW, 0.62, 0.36)), bodyMat, 0, 0.32, 0);
    torso.add(body);
    // collar / folds accent
    torso.add(mesh(geo('collar', () => new THREE.BoxGeometry(0.5, 0.08, 0.38)), mat(isOrange ? 0xffaa55 : 0xcccccc), 0, 0.62, 0.02, false));

    const armL = new THREE.Group(); armL.position.set(-0.38, 0.55, 0); torso.add(armL);
    armL.add(mesh(geo('uarm', () => new THREE.BoxGeometry(0.16, 0.34, 0.16)), bodyMat, 0, -0.15, 0));
    const forearmL = new THREE.Group(); forearmL.position.set(0, -0.34, 0); armL.add(forearmL);
    forearmL.add(mesh(geo('farm', () => new THREE.BoxGeometry(0.14, 0.3, 0.14)), skinMat, 0, -0.14, 0));
    const handL = mesh(geo('hand', () => new THREE.BoxGeometry(0.14, 0.12, 0.16)), skinMat, 0, -0.32, 0.02);
    forearmL.add(handL);

    const armR = new THREE.Group(); armR.position.set(0.38, 0.55, 0); torso.add(armR);
    armR.add(mesh(geo('uarm', () => new THREE.BoxGeometry(0.16, 0.34, 0.16)), bodyMat, 0, -0.15, 0));
    const forearmR = new THREE.Group(); forearmR.position.set(0, -0.34, 0); armR.add(forearmR);
    forearmR.add(mesh(geo('farm', () => new THREE.BoxGeometry(0.14, 0.3, 0.14)), skinMat, 0, -0.14, 0));
    forearmR.add(mesh(geo('hand', () => new THREE.BoxGeometry(0.14, 0.12, 0.16)), skinMat, 0, -0.32, 0.02));

    const head = new THREE.Group(); head.position.set(0, 0.95, 0); torso.add(head);
    const skull = mesh(geo('head', () => new THREE.SphereGeometry(0.28, 16, 14)), skinMat, 0, 0.08, 0);
    head.add(skull);
    const face = new THREE.Mesh(
      geo('faceplane', () => new THREE.PlaneGeometry(0.42, 0.42)),
      new THREE.MeshLambertMaterial({ map: faceTexture(opts.expression || 'smile'), transparent: true })
    );
    face.position.set(0, 0.06, 0.26);
    head.add(face);
    head.add(mesh(geo('hair', () => new THREE.SphereGeometry(0.3, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55)), hairMat, 0, 0.14, -0.02));
    // ears
    head.add(mesh(geo('ear', () => new THREE.SphereGeometry(0.06, 8, 6)), skinMat, -0.28, 0.06, 0, false));
    head.add(mesh(geo('ear', () => new THREE.SphereGeometry(0.06, 8, 6)), skinMat, 0.28, 0.06, 0, false));

    if (isPolice) {
      const cap = mesh(geo('cap', () => new THREE.CylinderGeometry(0.26, 0.28, 0.12, 12)), mat(0x2f5a32), 0, 0.34, 0);
      head.add(cap);
      head.add(mesh(geo('brim', () => new THREE.BoxGeometry(0.4, 0.04, 0.22)), mat(0x1a1a1a), 0, 0.28, 0.14, false));
      head.add(mesh(geo('band', () => new THREE.CylinderGeometry(0.275, 0.275, 0.04, 16)), mat(0xb01020), 0, 0.30, 0, false));
      head.add(mesh(geo('badge', () => new THREE.CircleGeometry(0.05, 10)), mat(0xd4a857), 0, 0.36, 0.26, false));
      torso.add(mesh(geo('board', () => new THREE.BoxGeometry(0.1, 0.04, 0.14)), mat(0x1a3018), -0.28, 0.58, 0.05, false));
      torso.add(mesh(geo('board', () => new THREE.BoxGeometry(0.1, 0.04, 0.14)), mat(0x1a3018), 0.28, 0.58, 0.05, false));
      torso.add(mesh(geo('pip', () => new THREE.BoxGeometry(0.06, 0.015, 0.02)), mat(0xd4a857), -0.28, 0.61, 0.05, false));
      torso.add(mesh(geo('pip', () => new THREE.BoxGeometry(0.06, 0.015, 0.02)), mat(0xd4a857), 0.28, 0.61, 0.05, false));
    }
    // LGBT rainbow badge (procedural)
    if (appearance.gender === 'lgbt' && appearance.rainbowBadge !== false && !isPolice) {
      const badge = mesh(geo('rainbow', () => new THREE.BoxGeometry(0.1, 0.06, 0.02)), mat(0xe40303), 0.2, 0.5, 0.19, false);
      torso.add(badge);
    }

    g.userData.kind = isPolice ? 'guard' : 'prisoner';
    g.userData.isNpc = !!opts.npc;
    g.userData.limbs = { hips, torso, head, legL, legR, shinL, shinR, armL, armR, forearmL, forearmR, face };
    g.userData.anim = 'idle';
    g.userData.animT = Math.random() * 10;
    g.userData.baseY = 0;
    return g;
  }

  function createLivelyGuard(name) {
    return createCharacterSmart({ skin: '#e8b896', hair: '#1a1a1a', stripe: 'police' }, { npc: true, number: 'QG', role: 'guard' });
  }

  /** Always use cute procedural chibi so uniforms/faces work on mobile GPUs.
   *  Quaternius glTF is kept for props via AssetLibrary, not player bodies. */
  function createCharacterSmart(appearance, opts) {
    opts = opts || {};
    appearance = appearance || {};
    const countryMap = { vn: 'bw', us: 'orange', cn: 'blue', other: 'brown' };
    if (appearance.country && countryMap[appearance.country] && appearance.stripe !== 'police') {
      appearance = Object.assign({}, appearance, { stripe: countryMap[appearance.country] });
    }
    const role = opts.role || (appearance.stripe === 'police' ? 'guard' : 'prisoner');
    try {
      const g = createChibiCharacter(appearance, Object.assign({}, opts, { role }));
      if (g) {
        g.userData.kind = role === 'guard' || appearance.stripe === 'police' ? 'guard' : 'prisoner';
        return g;
      }
    } catch (e) { console.warn('chibi fail', e); }
    return createProceduralPrisoner(appearance, opts);
  }

  // Back-compat alias
  function createLivelyPrisoner(appearance, opts) {
    return createCharacterSmart(appearance, opts);
  }

  function animateCharacter(g, dt, moving, emote) {
    if (!g) return;
    if (g.userData.gltf && g.userData.mixer) {
      let anim = 'idle';
      if (emote === 'pushup') anim = 'pushup';
      else if (emote === 'sit' || emote === 'sleep') anim = emote === 'sleep' ? 'sleep' : 'sit';
      else if (emote === 'wave') anim = 'wave';
      else if (emote === 'work' || emote === 'sew' || emote === 'hammer') anim = emote === 'sew' ? 'sew' : (emote === 'hammer' ? 'hammer' : 'work');
      else if (moving) anim = moving > 4.5 ? 'run' : 'walk';
      if (g.userData.playAnim) g.userData.playAnim(anim);
      g.userData.mixer.update(dt);
      return;
    }
    if (!g.userData.limbs) return;
    const L = g.userData.limbs;
    g.userData.animT = (g.userData.animT || 0) + dt;
    const t = g.userData.animT;
    let anim = 'idle';
    if (emote === 'pushup') anim = 'pushup';
    else if (emote === 'sit' || emote === 'sleep') anim = emote;
    else if (emote === 'wave') anim = 'wave';
    else if (emote === 'work' || emote === 'sew' || emote === 'hammer') anim = emote;
    else if (moving) anim = moving > 4.5 ? 'run' : 'walk';
    g.userData.anim = anim;

    const reset = () => {
      L.legL.rotation.x = L.legR.rotation.x = 0;
      L.armL.rotation.x = L.armR.rotation.x = 0;
      L.armL.rotation.z = L.armR.rotation.z = 0;
      L.torso.rotation.x = L.head.rotation.x = 0;
      L.hips.position.y = 0;
    };
    reset();

    if (anim === 'walk' || anim === 'run') {
      const sp = anim === 'run' ? 10 : 6;
      const amp = anim === 'run' ? 0.7 : 0.45;
      L.legL.rotation.x = Math.sin(t * sp) * amp;
      L.legR.rotation.x = Math.sin(t * sp + Math.PI) * amp;
      L.armL.rotation.x = Math.sin(t * sp + Math.PI) * amp * 0.8;
      L.armR.rotation.x = Math.sin(t * sp) * amp * 0.8;
      L.hips.position.y = Math.abs(Math.sin(t * sp * 2)) * 0.04;
      L.torso.rotation.y = Math.sin(t * sp) * 0.06;
    } else if (anim === 'idle') {
      L.armL.rotation.z = 0.08 + Math.sin(t * 1.5) * 0.03;
      L.armR.rotation.z = -0.08 - Math.sin(t * 1.5) * 0.03;
      L.head.rotation.y = Math.sin(t * 0.7) * 0.08;
      L.hips.position.y = Math.sin(t * 2) * 0.015;
    } else if (anim === 'pushup') {
      L.torso.rotation.x = Math.PI / 2;
      L.armL.rotation.x = -Math.PI / 2 + Math.sin(t * 5) * 0.2;
      L.armR.rotation.x = -Math.PI / 2 + Math.sin(t * 5) * 0.2;
      L.hips.position.y = -0.35 + Math.sin(t * 5) * 0.08;
    } else if (anim === 'sit') {
      L.legL.rotation.x = L.legR.rotation.x = -1.2;
      L.hips.position.y = -0.28;
      L.torso.rotation.x = 0.15;
    } else if (anim === 'sleep') {
      L.torso.rotation.x = Math.PI / 2;
      L.hips.position.y = -0.5;
    } else if (anim === 'wave') {
      L.armR.rotation.z = -2.2;
      L.armR.rotation.x = Math.sin(t * 8) * 0.4;
    } else if (anim === 'work' || anim === 'hammer') {
      L.armR.rotation.x = -0.8 + Math.sin(t * 7) * 0.6;
      L.armL.rotation.x = -0.4;
      L.torso.rotation.x = 0.2;
    } else if (anim === 'sew') {
      L.armL.rotation.x = -0.9;
      L.armR.rotation.x = -0.9 + Math.sin(t * 10) * 0.15;
      L.head.rotation.x = 0.25;
    }
  }

  function addCanteenTable(group, x, z) {
    const metal = mat(0x7a8288);
    group.add(mesh(geo('ctop', () => new THREE.BoxGeometry(2.4, 0.1, 0.9)), metal, x, 0.72, z));
    [[-1, -0.35], [1, -0.35], [-1, 0.35], [1, 0.35]].forEach(([dx, dz]) => {
      group.add(mesh(geo('cleg', () => new THREE.BoxGeometry(0.08, 0.7, 0.08)), metal, x + dx, 0.35, z + dz, false));
    });
    const bench = mat(0x6a7076);
    group.add(mesh(geo('bench', () => new THREE.BoxGeometry(2.2, 0.08, 0.35)), bench, x, 0.4, z - 0.75));
    group.add(mesh(geo('bench', () => new THREE.BoxGeometry(2.2, 0.08, 0.35)), bench, x, 0.4, z + 0.75));
  }

  function addCellBlock(group, ox, oz, floors, concreteMat) {
    const wall = concreteMat || mat(0xc8ccd0);
    const barMat = mat(0x1a1a1a);
    const rail = mat(0xf0c020);
    const w = 16, d = 4.2, h = 3.2;
    group.add(mesh(geo('cwall', () => new THREE.BoxGeometry(w, h * floors + 0.4, 0.35)), wall, ox, (h * floors) / 2, oz - d / 2));
    group.add(mesh(geo('cside', () => new THREE.BoxGeometry(0.35, h * floors + 0.4, d)), wall, ox - w / 2, (h * floors) / 2, oz));
    group.add(mesh(geo('cside', () => new THREE.BoxGeometry(0.35, h * floors + 0.4, d)), wall, ox + w / 2, (h * floors) / 2, oz));
    for (let f = 0; f < floors; f++) {
      const y0 = f * h;
      group.add(mesh(geo('cfloor', () => new THREE.BoxGeometry(w - 0.4, 0.2, d)), mat(0xb0b4b8), ox, y0 + 0.1, oz, false));
      if (f > 0) {
        group.add(mesh(geo('rail', () => new THREE.BoxGeometry(w - 0.5, 0.08, 0.08)), rail, ox, y0 + 1.0, oz + d / 2 - 0.15, false));
        for (let i = -7; i <= 7; i++) {
          group.add(mesh(geo('railp', () => new THREE.BoxGeometry(0.06, 1.0, 0.06)), rail, ox + i * 1.05, y0 + 0.55, oz + d / 2 - 0.15, false));
        }
      }
      for (let c = -2; c <= 2; c++) {
        const cx = ox + c * 2.9;
        group.add(mesh(geo('bed', () => new THREE.BoxGeometry(1.4, 0.2, 0.7)), mat(0x8a6040), cx, y0 + 0.45, oz - 0.6));
        group.add(mesh(geo('pillow', () => new THREE.BoxGeometry(0.35, 0.12, 0.4)), mat(0xd04040), cx - 0.45, y0 + 0.6, oz - 0.6, false));
        for (let b = -3; b <= 3; b++) {
          group.add(mesh(geo('bar', () => new THREE.BoxGeometry(0.06, 2.4, 0.06)), barMat, cx + b * 0.22, y0 + 1.4, oz + d / 2 - 0.05, false));
        }
      }
    }
  }

  function addBlueWall(group, x, y, z, w, h, d) {
    group.add(mesh(new THREE.BoxGeometry(w, h * 0.45, d), mat(0x2a4a8a), x, y + h * 0.225, z, false));
    group.add(mesh(new THREE.BoxGeometry(w, h * 0.55, d), mat(0xd0d4d8), x, y + h * 0.45 + h * 0.275, z, false));
    group.add(mesh(new THREE.BoxGeometry(w, 0.08, d + 0.02), mat(0xf0c020), x, y + h * 0.45, z, false));
  }

  function addZoneLabel(group, text, x, z, color) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = color || '#fff';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 42);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.position.set(x, 3.2, z);
    m.rotation.y = Math.PI;
    group.add(m);
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
    this.zoneBounds = null; // {minX,maxX,minZ,maxZ} when quarantine
    this.mapZones = [
      { id: 'quarantine', name: 'Khu tạm giam', x: -42, z: -8, w: 22, d: 20, color: '#c45a2a' },
      { id: 'general', name: 'Khu phân trại', x: 0, z: -18, w: 48, d: 28, color: '#4a6a9a' },
      { id: 'kitchen', name: 'Khu nhà bếp', x: 28, z: 10, w: 16, d: 14, color: '#b07040' },
      { id: 'canteen', name: 'Khu căn tin', x: 0, z: 2, w: 28, d: 16, color: '#6a8aaa' },
      { id: 'labor', name: 'Khu lao động', x: -30, z: 14, w: 24, d: 22, color: '#6a7a50' },
      { id: 'yard', name: 'Sân chơi', x: 0, z: 32, w: 30, d: 20, color: '#c45a2a' },
      { id: 'happiness', name: 'Phòng hạnh phúc', x: 36, z: -8, w: 12, d: 12, color: '#d4a0c0' },
    ];

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
    this.renderer.setClearColor(0x87b8e8, 1);
    this.shadowsOn = !isMobile;
    this.renderer.shadowMap.enabled = this.shadowsOn;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x87b8e8, 55, 140);
    this.scene.background = new THREE.Color(0x87b8e8);

    this.camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 180);
    this.camera.position.set(0, 16, 18);

    const hemi = new THREE.HemisphereLight(0xfff8e8, 0x5a7a50, 0.75);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2d0, 1.05);
    this.sun.position.set(30, 40, 18);
    this.sun.castShadow = this.shadowsOn;
    if (this.shadowsOn) {
      this.sun.shadow.mapSize.set(isMobile ? 512 : 1536, isMobile ? 512 : 1536);
      this.sun.shadow.camera.near = 2;
      this.sun.shadow.camera.far = 120;
      const s = 55;
      this.sun.shadow.camera.left = -s;
      this.sun.shadow.camera.right = s;
      this.sun.shadow.camera.top = s;
      this.sun.shadow.camera.bottom = -s;
      this.sun.shadow.bias = -0.0004;
    }
    this.scene.add(this.sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.32));
    // warm fill
    const fill = new THREE.DirectionalLight(0xffd8b0, 0.25);
    fill.position.set(-20, 12, -10);
    this.scene.add(fill);

    this.root = new THREE.Group();
    this.scene.add(this.root);
    this.assets = null;
    this._gltfDecorated = false;
    this.buildCompound();
    this.spawnNpcs(20);
    this.spawnGuards();
    this._bootAssets();

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
    this._lastMoveSpeed = 0;
  }

  World3D.prototype.setShadows = function (on) {
    this.shadowsOn = !!on;
    this.renderer.shadowMap.enabled = this.shadowsOn;
    this.sun.castShadow = this.shadowsOn;
  };


  World3D.prototype._bootAssets = function () {
    const self = this;
    window.__otuIsMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth < 700;
    const lib = new AssetLibrary();
    window.__otuAssets = lib;
    this.assets = lib;
    lib.init().then((ok) => {
      if (!ok) {
        console.warn('[v8] glTF assets unavailable — procedural fallback');
        return;
      }
      self._upgradeCharactersToGltf();
      self._decorateCompoundWithProps();
      // lazy zones
      ['labor', 'kitchen', 'happiness', 'canteen', 'quarantine'].forEach((z) => {
        lib.ensureZone(z).then(() => self._decorateZone(z));
      });
    }).catch((e) => console.warn('[v8] asset boot', e));
  };

  World3D.prototype._upgradeCharactersToGltf = function () {
    const lib = this.assets;
    if (!lib || !lib.ready) return;
    const upgrade = (meshP, role) => {
      if (!meshP || meshP.userData.gltf) return meshP;
      const parent = meshP.parent;
      const pos = meshP.position.clone();
      const rotY = meshP.rotation.y;
      const ud = Object.assign({}, meshP.userData);
      const appearance = { stripe: role === 'guard' ? 'police' : (ud.stripe || 'orange'), number: ud.prisonerNo };
      const neu = createCharacterSmart(appearance, { role, number: ud.prisonerNo, shadows: this.shadowsOn });
      if (!neu || !neu.userData.gltf) return meshP;
      Object.assign(neu.userData, ud, { gltf: true });
      neu.position.copy(pos);
      neu.rotation.y = rotY;
      if (parent) { parent.remove(meshP); parent.add(neu); }
      return neu;
    };
    for (const [id, meshP] of [...this.players.entries()]) {
      this.players.set(id, upgrade(meshP, 'prisoner'));
    }
    this.npcs = this.npcs.map((n) => upgrade(n, 'prisoner'));
    this.guards = this.guards.map((g) => upgrade(g, 'guard'));
  };

  World3D.prototype._placeProp = function (key, x, y, z, scale, rotY) {
    if (!this.assets) return null;
    const inst = this.assets.createProp(key, { shadows: this.shadowsOn, scale: scale || 1, rotY: rotY || 0, x, y: y || 0, z });
    if (inst) this.root.add(inst);
    return inst;
  };

  World3D.prototype._decorateCompoundWithProps = function () {
    if (this._gltfDecorated) return;
    this._gltfDecorated = true;
    // canteen tables/chairs already procedural; sprinkle glTF
    this._decorateZone('canteen');
  };

  World3D.prototype._decorateZone = function (zoneId) {
    const P = (k, x, z, s, r) => this._placeProp(k, x, 0, z, s, r);
    if (zoneId === 'canteen') {
      for (let i = 0; i < 4; i++) P('chair', -6 + i * 4, -1, 1.2, Math.PI);
      P('table', 2, 4, 1.4, 0);
    }
    if (zoneId === 'kitchen') {
      P('fridgeLarge', 30, 12, 1.2, 0);
      P('stove', 26, 12, 1.1, 0);
      P('sink', 28, 8, 1.1, 0);
      P('kitchenCabinet', 32, 8, 1.1, Math.PI / 2);
      P('pan', 26.5, 12.8, 0.8, 0);
      P('pot', 27.2, 12.8, 0.8, 0);
    }
    if (zoneId === 'labor') {
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
        P(['carrot', 'pumpkin', 'turnip', 'corn'][(i + j) % 4], -38 + i * 1.8, 16 + j * 1.8, 1.0, Math.random() * 6);
      }
      P('dirtRow', -34, 18, 1.2, 0);
      P('workbench', -30, 7, 1.1, 0);
      P('anvil', -28, 6, 1.0, 0);
      P('crateLarge', -24, 16, 1.0, 0);
      P('barrel', -22, 14, 1.0, 0);
      P('bucket', -23, 15, 1.0, 0);
      P('cog', -26, 17, 0.8, 0);
    }
    if (zoneId === 'happiness') {
      P('sofa', 36, -10, 1.2, 0);
      P('sofaDesign', 38, -7, 1.1, Math.PI / 2);
      P('lamp', 34, -6, 1.0, 0);
      P('plant', 39, -9, 1.2, 0);
      P('tableCoffee', 36, -7, 1.1, 0);
      P('rug', 36, -8, 1.5, 0);
      P('flower', 37.5, -6, 1.0, 0);
      P('tv', 36, -12.5, 1.0, 0);
    }
    if (zoneId === 'quarantine') {
      P('bedBunk', -46, -12, 1.1, 0);
      P('bedSingle', -42, -12, 1.1, Math.PI);
      P('desk', -40, -4, 1.1, 0);
      P('chairDesk', -40, -5.2, 1.1, 0);
      P('cabinet', -44, -4, 1.1, 0);
    }
  };

  World3D.prototype.setZoneBounds = function (bounds) {
    this.zoneBounds = bounds; // null or {minX,maxX,minZ,maxZ}
  };

  World3D.prototype.buildCompound = function () {
    const g = this.root;
    const concrete = new THREE.MeshLambertMaterial({ map: concreteTexture() });
    const brick = new THREE.MeshLambertMaterial({ map: brickTexture() });
    const wood = new THREE.MeshLambertMaterial({ map: woodTexture() });
    const grass = new THREE.MeshLambertMaterial({ map: grassTexture() });

    // Outer grass large
    const grassPlane = new THREE.Mesh(new THREE.PlaneGeometry(160, 140), grass);
    grassPlane.rotation.x = -Math.PI / 2;
    grassPlane.position.set(-5, -0.05, 5);
    grassPlane.receiveShadow = true;
    g.add(grassPlane);

    // Main hall floor
    const floorMat = new THREE.MeshLambertMaterial({ map: checkerTexture() });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(52, 40), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0.02, -8);
    floor.receiveShadow = true;
    g.add(floor);

    addBlueWall(g, 0, 0, -28, 52, 5.5, 0.4);
    addBlueWall(g, -26, 0, -8, 0.4, 5.5, 40);
    addBlueWall(g, 26, 0, -8, 0.4, 5.5, 40);
    addBlueWall(g, -14, 0, 12, 20, 5.5, 0.4);
    addBlueWall(g, 14, 0, 12, 20, 5.5, 0.4);

    for (let i = -24; i <= 8; i += 6) {
      g.add(mesh(new THREE.BoxGeometry(50, 0.25, 0.35), mat(0xa8acb0), 0, 5.6, i, false));
    }

    // Multiple cell blocks
    addCellBlock(g, -8, -24, 2, concrete);
    addCellBlock(g, 10, -24, 2, concrete);
    addCellBlock(g, -8, -40, 2, concrete);
    addCellBlock(g, 10, -40, 2, brick);

    addZoneLabel(g, 'Khu phân trại', 0, -18, '#cde');
    g.add(mesh(new THREE.BoxGeometry(2.8, 2.2, 0.12), mat(0xd4a857), -18.5, 2.4, -4, false));

    // Clock
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
    clockMesh.position.set(0, 4.2, -27.5);
    g.add(clockMesh);

    // Canteen
    addZoneLabel(g, 'Khu căn tin', 4, 2, '#fff');
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 4; col++) {
        addCanteenTable(g, -8 + col * 5.2, -2 + row * 4.2);
      }
    }

    // Kitchen
    addZoneLabel(g, 'Khu nhà bếp', 28, 8, '#ffe');
    g.add(mesh(new THREE.BoxGeometry(14, 0.15, 12), concrete, 28, 0.08, 10, false));
    addBlueWall(g, 28, 0, 4, 14, 4, 0.35);
    g.add(mesh(new THREE.BoxGeometry(2.4, 1.2, 1.1), mat(0x333333), 30, 0.6, 12));
    g.add(mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.18, 12), mat(0xff6622), 30, 1.3, 12));
    addCanteenTable(g, 24, 8);
    addCanteenTable(g, 30, 8);

    // Labor zone
    addZoneLabel(g, 'Khu lao động', -30, 12, '#efe');
    g.add(mesh(new THREE.BoxGeometry(22, 0.12, 20), concrete, -30, 0.06, 14, false));
    // Garden crops
    addZoneLabel(g, 'Vườn rau', -34, 20, '#cfc');
    for (let i = 0; i < 5; i++) for (let j = 0; j < 4; j++) {
      const gx = -38 + i * 1.6, gz = 16 + j * 1.8;
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.15, 1.2), mat(0x5a3a20), gx, 0.12, gz, false));
      const crop = mesh(geo('crop', () => new THREE.ConeGeometry(0.25, 0.55, 6)), mat(0x3a9a3a), gx, 0.45, gz, false);
      g.add(crop);
      if ((i + j) % 2 === 0) g.add(mesh(geo('crop2', () => new THREE.SphereGeometry(0.18, 8, 6)), mat(0xc04030), gx + 0.2, 0.55, gz, false));
    }
    // Sewing machines
    addZoneLabel(g, 'Xưởng may', -22, 18, '#eef');
    for (let i = 0; i < 3; i++) {
      const sx = -24 + i * 2.2, sz = 17;
      g.add(mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), wood, sx, 0.4, sz));
      g.add(mesh(new THREE.BoxGeometry(0.5, 0.35, 0.4), mat(0x333333), sx, 0.9, sz));
    }
    // Carpentry
    addZoneLabel(g, 'Xưởng mộc', -30, 6, '#fed');
    g.add(mesh(new THREE.BoxGeometry(2.2, 1.0, 1.0), wood, -32, 0.55, 7));
    g.add(mesh(new THREE.BoxGeometry(1.6, 1.4, 0.8), wood, -28, 0.75, 8));
    g.add(mesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), wood, -30, 0.5, 5)); // cabinet
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.12, 0.8), wood, -26, 0.7, 6)); // table top
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([dx, dz]) => {
      g.add(mesh(geo('tleg', () => new THREE.BoxGeometry(0.1, 0.65, 0.1)), wood, -26 + dx, 0.35, 6 + dz, false));
    });

    // Quarantine wing
    addZoneLabel(g, 'Khu tạm giam', -42, -8, '#faa');
    g.add(mesh(new THREE.BoxGeometry(20, 0.12, 18), concrete, -42, 0.06, -8, false));
    // invisible-ish walls (visible fence)
    const fence = mat(0x555555);
    [[-42, 1, -8 - 9, 20, 0.2], [-42, 1, -8 + 9, 20, 0.2], [-42 - 10, 1, -8, 0.2, 18], [-42 + 10, 1, -8, 0.2, 18]].forEach(([fx, fy, fz, fw, fd]) => {
      g.add(mesh(new THREE.BoxGeometry(fw, 3.2, fd), fence, fx, fy + 1.2, fz, false));
    });
    // bunks in quarantine
    for (let i = 0; i < 4; i++) {
      g.add(mesh(geo('bed', () => new THREE.BoxGeometry(1.4, 0.2, 0.7)), mat(0x8a6040), -46 + (i % 2) * 4, 0.45, -12 + Math.floor(i / 2) * 4));
    }
    // intake desk + NPC spot marker
    g.add(mesh(new THREE.BoxGeometry(2.5, 1.0, 1.0), wood, -40, 0.55, -4));

    // Happiness room
    addZoneLabel(g, 'Phòng hạnh phúc', 36, -8, '#fdf');
    g.add(mesh(new THREE.BoxGeometry(10, 0.15, 10), new THREE.MeshLambertMaterial({ color: 0xe8d0c0 }), 36, 0.08, -8, false));
    addBlueWall(g, 36, 0, -13, 10, 4, 0.35);
    addBlueWall(g, 31, 0, -8, 0.35, 4, 10);
    addBlueWall(g, 41, 0, -8, 0.35, 4, 10);
    // cozy props
    g.add(mesh(new THREE.BoxGeometry(2.2, 0.7, 1.0), mat(0x8a5040), 36, 0.4, -10)); // sofa
    g.add(mesh(new THREE.BoxGeometry(1.2, 0.55, 1.2), wood, 34, 0.35, -7)); // table
    g.add(mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.9, 8), mat(0xff6688), 38, 0.5, -6, false)); // flower
    g.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), mat(0xffaa33), 38, 1.05, -6, false));

    // Yard / basketball
    addZoneLabel(g, 'Sân chơi', 0, 30, '#fff');
    g.add(mesh(new THREE.BoxGeometry(26, 0.12, 20), mat(0xc45a2a), 0, 0.02, 32, false));
    g.add(mesh(new THREE.BoxGeometry(10, 0.02, 0.08), mat(0xffffff), 0, 0.1, 32, false));
    g.add(mesh(new THREE.BoxGeometry(0.15, 3.2, 0.15), mat(0x888888), 0, 1.6, 23));
    g.add(mesh(new THREE.BoxGeometry(1.4, 0.9, 0.08), mat(0xffffff), 0, 3.3, 23, false));
    g.add(mesh(new THREE.TorusGeometry(0.45, 0.04, 8, 16), mat(0xff6600), 0, 2.9, 22.7, false));

    // Perimeter
    const wallGrey = concrete;
    [[0, 44, 36, 0.6], [-18, 32, 0.6, 24], [18, 32, 0.6, 24]].forEach(([wx, wz, ww, wd]) => {
      g.add(mesh(new THREE.BoxGeometry(ww, 5.5, wd), wallGrey, wx, 2.7, wz));
    });
    for (let i = -16; i <= 16; i += 2) {
      const coil = mesh(geo('coil', () => new THREE.TorusGeometry(0.35, 0.06, 6, 12)), mat(0x555555), i, 5.5, 44, false);
      coil.rotation.y = Math.PI / 2;
      g.add(coil);
    }
    g.add(mesh(new THREE.BoxGeometry(2.6, 8, 2.6), mat(0x6a7078), 14, 4, 40));
    g.add(mesh(new THREE.BoxGeometry(3.4, 0.3, 3.4), mat(0x4a5058), 14, 8.2, 40));
    g.add(mesh(new THREE.BoxGeometry(0.7, 0.7, 0.1), mat(0xffee88), 14, 9, 38.6, false));

    g.add(mesh(new THREE.BoxGeometry(6, 0.08, 14), mat(0x9a9ea4), 0, 0.04, 18, false));
  };

  World3D.prototype.spawnGuards = function () {
    const defs = [
      { id: 'g1', name: 'Cán bộ Hùng', x: -40, z: -5 },
      { id: 'g2', name: 'Cán bộ Hữu', x: 10, z: 4 },
      { id: 'g3', name: 'Cán bộ Lan', x: 12, z: 38 },
      { id: 'g4', name: 'Cán bộ Tiếp nhận', x: -42, z: -4 },
    ];
    defs.forEach((d) => {
      const meshG = createLivelyGuard(d.name);
      meshG.position.set(d.x, 0, d.z);
      meshG.rotation.y = Math.PI;
      meshG.userData.id = d.id;
      meshG.userData.nickname = d.name;
      meshG.userData.kind = 'guard';
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 5.5, 12, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false })
      );
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(0, 0.9, 2.6);
      meshG.add(cone);
      meshG.userData.cone = cone;
      this.root.add(meshG);
      this.guards.push(meshG);
    });
  };

  World3D.prototype.syncGuards = function (list) {
    if (!list || !list.length) return;
    const byId = Object.fromEntries(this.guards.map((gg) => [gg.userData.id, gg]));
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
      [9, 4], [12, 1], [-8, 8], [4, 8], [-34, 18], [-22, 17],
      [-30, 8], [0, 30], [-5, 34], [5, 33], [-42, -10], [28, 10],
      [36, -8], [16, 8],
    ];
    for (let i = 0; i < n; i++) {
      const name = FUNNY_NPC_NAMES[i % FUNNY_NPC_NAMES.length] + (i >= FUNNY_NPC_NAMES.length ? ' ' + (i + 1) : '');
      const countries = ['vn', 'us', 'cn', 'other'];
      const country = countries[i % countries.length];
      const stripe = { vn: 'bw', us: 'orange', cn: 'blue', other: 'brown' }[country];
      const genders = ['nam', 'nu', 'lgbt', 'nam', 'nu'];
      const gender = genders[i % genders.length];
      const bodyStyle = gender === 'nu' ? 'female' : (gender === 'lgbt' ? (i % 2 ? 'female' : 'male') : 'male');
      const hairStyles = ['default', 'short', 'long', 'bun', 'worker'];
      const skins = ['#e8b896', '#c68642', '#f1c27d', '#8d5524', '#ffdbac'];
      const hairs = ['#2a2218', '#1a1a1a', '#5a3a1a', '#c4a35a', '#708090'];
      const meshP = createLivelyPrisoner({
        skin: skins[i % skins.length],
        hair: hairs[i % hairs.length],
        country, gender, bodyStyle, hairStyle: hairStyles[i % hairStyles.length],
        rainbowBadge: gender === 'lgbt',
        stripe,
        number: String(1000 + i * 37),
      }, { npc: true, expression: 'smile' });
      const sp = spots[i % spots.length];
      meshP.position.set(sp[0] + (Math.random() - 0.5) * 2, 0, sp[1] + (Math.random() - 0.5) * 2);
      meshP.userData.nickname = name;
      meshP.userData.prisonerNo = String(1000 + i * 37);
      meshP.userData.wx = meshP.position.x;
      meshP.userData.wz = meshP.position.z;
      meshP.userData.phase = Math.random() * Math.PI * 2;
      meshP.userData.speed = 0.6 + Math.random() * 0.8;
      meshP.userData.radius = 1.2 + Math.random() * 2.2;
      this.root.add(meshP);
      this.npcs.push(meshP);
    }
  };

  World3D.prototype._bindInput = function () {
    const self = this;
    window.addEventListener('keydown', (e) => {
      self.keys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.code === 'KeyM' && self.onToggleMap) self.onToggleMap();
    });
    window.addEventListener('keyup', (e) => { self.keys[e.code] = false; });

    const ray = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let lastTap = 0;
    this.canvas.addEventListener('pointerdown', (e) => {
      if (e.target.closest && e.target.closest('.joystick,button,input,textarea,select,.panel-card,.sidebang,.botbar,.actbar,.dock,.chat-panel,.info-card,.right-menu,.top-tools,.mob-actions,#map-overlay,#minimap')) return;
      if (e.button === 2 || e.pointerType === 'pen' || e.shiftKey || e.button === 1) {
        self._drag = { x: e.clientX, y: e.clientY, orbit: true };
        return;
      }
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
        self._drag.orbit = true;
        self._drag.moved = true;
        self.orbitYaw -= dx * 0.005;
        self.orbitPitch = Math.max(0.15, Math.min(1.2, self.orbitPitch + dy * 0.004));
        self._drag.x = e.clientX; self._drag.y = e.clientY;
      }
    });
    window.addEventListener('pointerup', () => { self._drag = null; });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    this.canvas.addEventListener('wheel', (e) => {
      self.camDist = Math.max(5, Math.min(22, self.camDist + e.deltaY * 0.01));
    }, { passive: true });
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
    const key = (p.appearance && [p.appearance.stripe, p.appearance.skin, p.appearance.hair, p.appearance.country, p.appearance.gender, p.appearance.bodyStyle, p.appearance.hairStyle].join('|')) || '';
    const mk = () => createLivelyPrisoner(Object.assign({}, p.appearance || {}, { number: p.prisonerNo }), { expression: 'smile' });
    if (!meshP) {
      meshP = mk();
      meshP.userData.id = p.id;
      meshP.userData.nickname = p.nickname;
      meshP.userData.prisonerNo = p.prisonerNo;
      meshP.userData.appearKey = key;
      meshP.userData.isMe = !!p.isMe || p.id === this.myId;
      this.root.add(meshP);
      this.players.set(p.id, meshP);
    } else if (p.appearance && meshP.userData.appearKey !== key) {
      this.root.remove(meshP);
      meshP = mk();
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

  World3D.prototype.getMapSnapshot = function () {
    return {
      zones: this.mapZones,
      me: { x: this.localPos.x, z: this.localPos.z },
      players: [...this.players.values()].map((m) => ({ id: m.userData.id, x: m.position.x, z: m.position.z, me: m.userData.id === this.myId })),
    };
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
      if (this.onMapTick) this.onMapTick(this.getMapSnapshot());
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
    if (this.joy.active) { mx += this.joy.x; mz += this.joy.y; }
    if (mx || mz) {
      const cos = Math.cos(this.orbitYaw), sin = Math.sin(this.orbitYaw);
      const rx = mx * cos - mz * sin;
      const rz = mx * sin + mz * cos;
      mx = rx; mz = rz;
    }
    const me = this.players.get(this.myId);
    let moving = 0;
    if (me) {
      if (mx || mz) {
        this.targetPos = null;
        const len = Math.hypot(mx, mz) || 1;
        mx /= len; mz /= len;
        const run = !!(this.keys.ShiftLeft || this.keys.ShiftRight);
        const spd = this.speed * (run ? 1.45 : 1);
        this.localPos.x += mx * spd * dt;
        this.localPos.z += mz * spd * dt;
        this.localPos.rotY = Math.atan2(mx, mz);
        moving = spd;
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
          moving = this.speed;
          if (this.onStep) this.onStep();
        }
      }
      const b = this.zoneBounds;
      if (b) {
        this.localPos.x = Math.max(b.minX, Math.min(b.maxX, this.localPos.x));
        this.localPos.z = Math.max(b.minZ, Math.min(b.maxZ, this.localPos.z));
      } else {
        this.localPos.x = Math.max(-52, Math.min(48, this.localPos.x));
        this.localPos.z = Math.max(-52, Math.min(46, this.localPos.z));
      }
      me.position.set(this.localPos.x, 0, this.localPos.z);
      me.rotation.y = this.localPos.rotY;
      animateCharacter(me, dt, moving, me.userData.emote);

      const cy = Math.sin(this.orbitPitch) * this.camDist;
      const cz = Math.cos(this.orbitPitch) * this.camDist;
      const tx = this.localPos.x + Math.sin(this.orbitYaw) * cz;
      const tz = this.localPos.z + Math.cos(this.orbitYaw) * cz;
      const ty = cy + 2;
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
    this._lastMoveSpeed = moving;

    for (const [id, meshP] of this.players) {
      if (id === this.myId) continue;
      if (meshP.userData.tx == null) continue;
      const ox = meshP.position.x, oz = meshP.position.z;
      meshP.position.x += (meshP.userData.tx - meshP.position.x) * 0.22;
      meshP.position.z += (meshP.userData.tz - meshP.position.z) * 0.22;
      const tr = meshP.userData.tRot || 0;
      meshP.rotation.y += (tr - meshP.rotation.y) * 0.22;
      const spd = Math.hypot(meshP.position.x - ox, meshP.position.z - oz) / Math.max(dt, 0.001);
      animateCharacter(meshP, dt, spd > 0.4 ? Math.min(spd, 8) : 0, meshP.userData.emote);
    }

    const t = performance.now() * 0.001;
    this.npcs.forEach((n, i) => {
      const ang = t * n.userData.speed * 0.35 + n.userData.phase;
      const tx = n.userData.wx + Math.cos(ang) * n.userData.radius;
      const tz = n.userData.wz + Math.sin(ang) * n.userData.radius * 0.7;
      const ox = n.position.x, oz = n.position.z;
      n.position.x += (tx - n.position.x) * 0.04;
      n.position.z += (tz - n.position.z) * 0.04;
      n.rotation.y = Math.atan2(tx - n.position.x, tz - n.position.z) || n.rotation.y;
      const spd = Math.hypot(n.position.x - ox, n.position.z - oz) / Math.max(dt, 0.001);
      animateCharacter(n, dt, spd > 0.15 ? 3 : 0, null);
    });
    this.guards.forEach((gg) => {
      if (gg.userData.tx != null) {
        gg.position.x += (gg.userData.tx - gg.position.x) * 0.12;
        gg.position.z += (gg.userData.tz - gg.position.z) * 0.12;
        const tr = gg.userData.tRot || 0;
        let dy = tr - gg.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        gg.rotation.y += dy * 0.12;
      }
      animateCharacter(gg, dt, 1.5, null);
      if (gg.userData.lookingAway) gg.rotation.y += 0.02;
    });

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
      if (pos.z > 1) return;
      const x = (pos.x * 0.5 + 0.5) * w;
      const y = (-pos.y * 0.5 + 0.5) * h;
      if (x < -40 || x > w + 40 || y < -40 || y > h + 40) return;
      const name = meshP.userData.nickname || '?';
      const isMe = meshP.userData.id === this.myId;
      const isPlayer = !meshP.userData.isNpc && meshP.userData.kind !== 'guard';
      const tagCls = cls || (isMe || isPlayer ? 'ntag me' : 'ntag npc');
      const badge = (isPlayer || isMe) && meshP.userData.rankEmoji
        ? '<span class="rank-badge" title="' + escapeHtml(meshP.userData.rankName || '') + '">' + escapeHtml(meshP.userData.rankEmoji) + '</span>'
        : '';
      html += '<div class="' + tagCls + '" style="transform:translate(' + x + 'px,' + y + 'px) translate(-50%,-100%)">' + badge + escapeHtml(name) + '</div>';
      const bub = this.bubbles.get(meshP.userData.id);
      if (bub && bub.until > now) {
        html += '<div class="sbubble" style="transform:translate(' + x + 'px,' + (y - 28) + 'px) translate(-50%,-100%)">' + escapeHtml(bub.text) + '</div>';
      }
    };
    for (const [, meshP] of this.players) drawOne(meshP);
    for (const n of this.npcs) drawOne(n, 'ntag npc');
    for (const gg of this.guards) drawOne(gg, 'ntag guard');
    this.nametagEl.innerHTML = html;
  };

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  export { World3D };
  window.World3D = World3D;
