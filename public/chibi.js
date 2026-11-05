/* 3d-v10 — cute procedural chibi characters with country prison uniforms.
   Mobile-safe: CanvasTexture + MeshLambert, no custom shaders, no glTF dependency. */
import * as THREE from 'three';

const COUNTRY_STRIPE = { vn: 'bw', us: 'orange', cn: 'blue', other: 'brown' };

function makeTex(draw, w = 128, h = 128) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function resolveStripe(appearance) {
  appearance = appearance || {};
  if (appearance.stripe === 'police') return 'police';
  if (appearance.country && COUNTRY_STRIPE[appearance.country]) return COUNTRY_STRIPE[appearance.country];
  return appearance.stripe || 'bw';
}

/** Vertical stripes / solids with fabric folds + number patch. */
export function chibiUniformTexture(stripeId, number, kind /* shirt|pants */) {
  const isOrange = stripeId === 'orange' || stripeId === 'orange_solid';
  const isPolice = stripeId === 'police';
  const isBrown = stripeId === 'brown';
  const isBlue = stripeId === 'blue' || stripeId === 'blue_white';
  const light = isPolice ? '#2f6a36' : (isBlue ? '#eef4ff' : (isOrange ? '#FF6A00' : (isBrown ? '#9a6430' : '#f7f7f7')));
  const dark = isPolice ? '#1a3a1c' : (isBlue ? '#1a4a70' : (isOrange ? '#d85810' : (isBrown ? '#5c3818' : '#1a1a1a')));
  return makeTex((ctx, w, h) => {
    if (isOrange || isBrown || isPolice) {
      ctx.fillStyle = light;
      ctx.fillRect(0, 0, w, h);
      // fabric folds
      for (let i = 0; i < 7; i++) {
        ctx.fillStyle = isPolice ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(10 + i * 16, 0, 4, h);
      }
      if (isPolice) {
        ctx.fillStyle = '#b01020';
        ctx.fillRect(0, 0, w, 6);
        // pocket outlines
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(18, 48, 36, 28);
        ctx.strokeRect(74, 48, 36, 28);
        ctx.fillStyle = '#d4a857';
        ctx.fillRect(32, 58, 8, 3);
        ctx.fillRect(88, 58, 8, 3);
      } else if (isOrange) {
        ctx.strokeStyle = 'rgba(80,30,0,0.25)';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 40, 40, 30);
        ctx.strokeRect(68, 40, 40, 30);
      }
    } else {
      // VERTICAL stripes (VN / CN) — bands vary in X
      const n = 10;
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        ctx.fillStyle = i % 2 ? dark : light;
        ctx.fillRect(i * bw, 0, bw + 0.5, h);
      }
      // subtle horizontal stitch / fold
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.fillRect(0, 18 + i * 20, w, 2);
      }
    }
    if (kind !== 'pants') {
      // number / ID patch on chest
      ctx.fillStyle = '#fff';
      ctx.fillRect(40, 44, 48, 28);
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.strokeRect(40, 44, 48, 28);
      ctx.fillStyle = '#111';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(number || '001').slice(-3), 64, 58);
    }
  }, 128, 128);
}

/** Expressive chibi face: eyes with highlights, brows, mouth, blush. */
export function chibiFaceTexture(opts) {
  opts = opts || {};
  const gender = opts.gender || 'nam';
  const expression = opts.expression || 'smile';
  return makeTex((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // blush
    ctx.fillStyle = 'rgba(255,120,140,0.45)';
    ctx.beginPath(); ctx.ellipse(36, 78, 14, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(92, 78, 14, 8, 0, 0, Math.PI * 2); ctx.fill();

    // brows
    ctx.strokeStyle = opts.brow || '#2a1a10';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    const browY = gender === 'nu' ? 38 : 40;
    ctx.beginPath();
    ctx.moveTo(28, browY); ctx.quadraticCurveTo(42, browY - 6, 54, browY + 1);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(74, browY + 1); ctx.quadraticCurveTo(86, browY - 6, 100, browY);
    ctx.stroke();

    // eye whites
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(42, 56, 13, 15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(86, 56, 13, 15, 0, 0, Math.PI * 2); ctx.fill();

    // iris
    const iris = gender === 'lgbt' ? '#6a3d9a' : '#2a5080';
    ctx.fillStyle = iris;
    ctx.beginPath(); ctx.arc(42, 58, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(86, 58, 8, 0, Math.PI * 2); ctx.fill();

    // pupils
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(42, 58, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(86, 58, 4, 0, Math.PI * 2); ctx.fill();

    // highlights
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(39, 54, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(83, 54, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(45, 60, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(89, 60, 1.2, 0, Math.PI * 2); ctx.fill();

    // mouth
    ctx.strokeStyle = '#c05060';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    if (expression === 'smile' || expression === 'happy' || !expression) {
      ctx.arc(64, 88, 12, 0.15, Math.PI - 0.15);
    } else if (expression === 'talk') {
      ctx.fillStyle = '#802030';
      ctx.beginPath(); ctx.ellipse(64, 94, 7, 6, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.moveTo(52, 94); ctx.quadraticCurveTo(64, 100, 76, 94);
    }
    ctx.stroke();
  }, 128, 128);
}

function matColor(hex) {
  return new THREE.MeshLambertMaterial({ color: hex });
}

function matMap(tex) {
  return new THREE.MeshLambertMaterial({ map: tex });
}

function addMesh(parent, geo, material, x, y, z, sx, sy, sz) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x || 0, y || 0, z || 0);
  if (sx != null) m.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * Cute chibi: big head (~1 : 1.5 body), expressive face, gender hair, clear uniforms.
 * Prisoners never get hats. Guards get green VN police + peaked cap.
 */
export function createChibiCharacter(appearance, opts) {
  opts = opts || {};
  appearance = appearance || {};
  const g = new THREE.Group();
  const stripeId = resolveStripe(appearance);
  const isPolice = stripeId === 'police' || opts.role === 'guard';
  const gender = appearance.gender || 'nam';
  const female = gender === 'nu' || appearance.bodyStyle === 'female'
    || (gender === 'lgbt' && appearance.bodyStyle === 'female');
  const skinHex = new THREE.Color(appearance.skin || '#e8b896').getHex();
  const hairHex = new THREE.Color(appearance.hair || '#2a2218').getHex();
  const number = opts.number || appearance.number || '007';

  const skinMat = matColor(skinHex);
  const hairMat = matColor(hairHex);
  const shirtTex = chibiUniformTexture(isPolice ? 'police' : stripeId, number, 'shirt');
  const pantsTex = chibiUniformTexture(isPolice ? 'police' : stripeId, number, 'pants');
  const shirtMat = matMap(shirtTex);
  const pantsMat = matMap(pantsTex);
  const shoeMat = matColor(isPolice ? 0x1a1a1a : 0x2a2218);

  // Proportions: head ~0.42 tall, body stack ~0.65 → ~1:1.55
  const hips = new THREE.Group(); hips.name = 'hips'; g.add(hips);

  // --- short stubby legs ---
  const legL = new THREE.Group(); legL.position.set(-0.12, 0.28, 0); hips.add(legL);
  addMesh(legL, new THREE.CapsuleGeometry(0.09, 0.16, 4, 8), pantsMat, 0, 0.08, 0);
  const shinL = new THREE.Group(); shinL.position.set(0, 0, 0); legL.add(shinL);
  addMesh(shinL, new THREE.BoxGeometry(0.16, 0.08, 0.22), shoeMat, 0, -0.02, 0.04);

  const legR = new THREE.Group(); legR.position.set(0.12, 0.28, 0); hips.add(legR);
  addMesh(legR, new THREE.CapsuleGeometry(0.09, 0.16, 4, 8), pantsMat, 0, 0.08, 0);
  const shinR = new THREE.Group(); shinR.position.set(0, 0, 0); legR.add(shinR);
  addMesh(shinR, new THREE.BoxGeometry(0.16, 0.08, 0.22), shoeMat, 0, -0.02, 0.04);

  // --- torso (shirt) ---
  const torso = new THREE.Group(); torso.position.set(0, 0.28, 0); hips.add(torso);
  const torsoW = female ? 0.38 : 0.42;
  const body = addMesh(torso, new THREE.CapsuleGeometry(torsoW * 0.55, 0.28, 6, 12), shirtMat, 0, 0.34, 0);
  body.name = 'torso';
  // collar
  addMesh(torso, new THREE.TorusGeometry(0.16, 0.035, 8, 16),
    matColor(isPolice ? 0x1a3a1c : (stripeId === 'orange' ? 0xFF6A00 : (stripeId === 'brown' ? 0x7a4a20 : 0xdddddd))),
    0, 0.52, 0.02).rotation.x = Math.PI / 2;

  // arms
  const armL = new THREE.Group(); armL.position.set(-(torsoW * 0.55 + 0.08), 0.48, 0); torso.add(armL);
  addMesh(armL, new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), shirtMat, 0, -0.08, 0);
  const forearmL = new THREE.Group(); forearmL.position.set(0, -0.22, 0); armL.add(forearmL);
  addMesh(forearmL, new THREE.SphereGeometry(0.07, 10, 8), skinMat, 0, -0.02, 0); // hand

  const armR = new THREE.Group(); armR.position.set(torsoW * 0.55 + 0.08, 0.48, 0); torso.add(armR);
  addMesh(armR, new THREE.CapsuleGeometry(0.07, 0.18, 4, 8), shirtMat, 0, -0.08, 0);
  const forearmR = new THREE.Group(); forearmR.position.set(0, -0.22, 0); armR.add(forearmR);
  addMesh(forearmR, new THREE.SphereGeometry(0.07, 10, 8), skinMat, 0, -0.02, 0);

  // --- BIG HEAD ---
  const head = new THREE.Group(); head.position.set(0, 0.62, 0); torso.add(head);
  const skull = addMesh(head, new THREE.SphereGeometry(0.32, 20, 16), skinMat, 0, 0.28, 0);
  skull.name = 'head';
  // ears
  addMesh(head, new THREE.SphereGeometry(0.07, 8, 6), skinMat, -0.30, 0.28, 0);
  addMesh(head, new THREE.SphereGeometry(0.07, 8, 6), skinMat, 0.30, 0.28, 0);

  // face plane
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.52),
    new THREE.MeshLambertMaterial({
      map: chibiFaceTexture({ gender, expression: opts.expression || 'smile', brow: appearance.hair || '#2a1a10' }),
      transparent: true,
      depthWrite: false,
    })
  );
  face.position.set(0, 0.26, 0.30);
  head.add(face);

  // --- hair by gender / style (never a hat for prisoners) ---
  const hairStyle = appearance.hairStyle || 'default';
  addHair(head, hairMat, gender, female, hairStyle);

  // --- police peaked cap ONLY for guards ---
  if (isPolice) {
    const cap = addMesh(head, new THREE.CylinderGeometry(0.28, 0.32, 0.12, 16), matColor(0x2f5a32), 0, 0.54, 0);
    cap.name = 'policeCap';
    addMesh(head, new THREE.BoxGeometry(0.44, 0.035, 0.26), matColor(0x1a1a1a), 0, 0.47, 0.16); // brim
    addMesh(head, new THREE.CylinderGeometry(0.318, 0.318, 0.055, 20), matColor(0xb01020), 0, 0.485, 0); // red band
    const badge = addMesh(head, new THREE.CircleGeometry(0.06, 12), matColor(0xd4a857), 0, 0.52, 0.32);
    badge.rotation.x = -0.15;
    // shoulder boards
    addMesh(torso, new THREE.BoxGeometry(0.12, 0.035, 0.16), matColor(0x1a3018), -0.22, 0.52, 0.04);
    addMesh(torso, new THREE.BoxGeometry(0.12, 0.035, 0.16), matColor(0x1a3018), 0.22, 0.52, 0.04);
    addMesh(torso, new THREE.BoxGeometry(0.07, 0.012, 0.02), matColor(0xd4a857), -0.22, 0.54, 0.05);
    addMesh(torso, new THREE.BoxGeometry(0.07, 0.012, 0.02), matColor(0xd4a857), 0.22, 0.54, 0.05);
  }

  // LGBT rainbow badge
  if (gender === 'lgbt' && appearance.rainbowBadge !== false && !isPolice) {
    const rb = new THREE.Group();
    rb.position.set(0.18, 0.42, 0.22);
    const colors = [0xe40303, 0xff8c00, 0xffed00, 0x008026, 0x24408e, 0x732982];
    colors.forEach((c, i) => {
      addMesh(rb, new THREE.BoxGeometry(0.09, 0.012, 0.015), matColor(c), 0, 0.03 - i * 0.012, 0);
    });
    torso.add(rb);
  }

  g.userData.kind = isPolice ? 'guard' : 'prisoner';
  g.userData.isNpc = !!opts.npc;
  g.userData.chibi = true;
  g.userData.limbs = { hips, torso, head, legL, legR, shinL, shinR, armL, armR, forearmL, forearmR, face };
  g.userData.anim = 'idle';
  g.userData.animT = Math.random() * 10;
  g.userData.baseY = 0;
  // Scale whole chibi so feet sit near y=0 and height ~1.55
  g.scale.setScalar(1.05);
  return g;
}

function addHair(head, hairMat, gender, female, hairStyle) {
  // base cap
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.335, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  cap.position.set(0, 0.36, -0.01);
  head.add(cap);

  if (gender === 'nam' && (hairStyle === 'default' || hairStyle === 'short' || hairStyle === 'punk')) {
    // short fringe
    const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), hairMat);
    fringe.position.set(0, 0.42, 0.22);
    fringe.rotation.x = -0.4;
    head.add(fringe);
    if (hairStyle === 'punk') {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), hairMat);
      spike.position.set(0, 0.58, -0.02);
      head.add(spike);
    }
    return;
  }

  if (female || gender === 'nu' || hairStyle === 'long' || hairStyle === 'bun' || hairStyle === 'formal') {
    // longer sides
    [-1, 1].forEach((s) => {
      const side = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), hairMat);
      side.position.set(s * 0.26, 0.12, -0.02);
      head.add(side);
    });
    if (hairStyle === 'bun' || hairStyle === 'formal') {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), hairMat);
      bun.position.set(0, 0.52, -0.18);
      head.add(bun);
    } else {
      // back length
      const back = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.28, 4, 8), hairMat);
      back.position.set(0, 0.05, -0.22);
      head.add(back);
    }
    // bangs
    const bangs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.1), hairMat);
    bangs.position.set(0, 0.40, 0.24);
    bangs.rotation.x = -0.35;
    head.add(bangs);
    return;
  }

  // LGBT / either: stylish volume + side flick
  const vol = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
  vol.position.set(0, 0.38, -0.02);
  head.add(vol);
  const flick = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), hairMat);
  flick.position.set(0.22, 0.48, 0.1);
  flick.rotation.z = -0.6;
  head.add(flick);
}

export { COUNTRY_STRIPE, resolveStripe };
