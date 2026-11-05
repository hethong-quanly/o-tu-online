import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

const ANIM_MAP = {
  idle: ['Idle', 'Idle_Neutral', 'idle'],
  walk: ['Walk', 'walk'],
  run: ['Run', 'run'],
  wave: ['Wave', 'wave'],
  work: ['Interact', 'Punch_Right', 'Idle'],
  sew: ['Interact', 'Idle'],
  hammer: ['Punch_Right', 'Interact', 'Idle'],
  sit: ['Idle_Neutral', 'Idle'],
  sleep: ['Idle_Neutral', 'Idle'],
  pushup: ['Kick_Left', 'Idle'],
};

/** Country → prisoner uniform id */
export const COUNTRY_UNIFORM = {
  vn: 'bw',
  us: 'orange',
  cn: 'blue',
  other: 'brown',
};

export function uniformFromAppearance(appearance) {
  const a = appearance || {};
  if (a.stripe === 'police' || a.role === 'guard') return 'police';
  if (a.country && COUNTRY_UNIFORM[a.country]) return COUNTRY_UNIFORM[a.country];
  if (a.stripe === 'bw' || a.stripe === 'stripe' || a.stripe === 'blue_white') return 'bw';
  if (a.stripe === 'blue' || a.stripe === 'blue_white_cn') return 'blue';
  if (a.stripe === 'brown') return 'brown';
  if (a.stripe === 'orange' || a.stripe === 'orange_solid') return 'orange';
  return 'bw'; // default VN
}

function pickClip(clips, names) {
  for (const n of names) {
    const c = clips.find((x) => x.name === n || x.name.toLowerCase() === n.toLowerCase());
    if (c) return c;
  }
  return clips[0] || null;
}

function makeFabricTex(drawFn, w = 128, h = 128, repeatU = 2, repeatV = 3) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  drawFn(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatU, repeatV);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Vertical stripes along body (bands vary in U / X). Soft fold shading. */
function verticalStripeTex(light, dark, opts = {}) {
  const stripeW = opts.stripeW || 10;
  return makeFabricTex((ctx, w, h) => {
    for (let x = 0; x < w; x += stripeW) {
      ctx.fillStyle = ((x / stripeW) % 2 === 0) ? light : dark;
      ctx.fillRect(x, 0, stripeW, h);
    }
    // fabric weave / folds (subtle)
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(0, 6 + i * 12, w, 2);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(4 + i * 22, 0, 1, h);
    }
    // collar band hint at top of atlas
    if (opts.collar) {
      ctx.fillStyle = opts.collar;
      ctx.fillRect(0, 0, w, 8);
    }
    // pocket hints
    if (opts.pocket) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(18, 40, 28, 22);
      ctx.strokeRect(82, 40, 28, 22);
    }
  }, 128, 128, opts.repeatU || 3, opts.repeatV || 2);
}

function solidFabricTex(hex, opts = {}) {
  return makeFabricTex((ctx, w, h) => {
    ctx.fillStyle = hex;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(8 + i * 15, 0, 3, h);
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(0, 4 + i * 12, w, 2);
    }
    if (opts.collar) {
      ctx.fillStyle = opts.collar;
      ctx.fillRect(0, 0, w, 10);
    }
    if (opts.pocket) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.strokeRect(20, 42, 30, 24);
      ctx.strokeRect(78, 42, 30, 24);
    }
  }, 128, 128, opts.repeatU || 2, opts.repeatV || 2);
}

function policeFabricTex() {
  // VN police green with collar/shoulder board cues
  return makeFabricTex((ctx, w, h) => {
    ctx.fillStyle = '#2f5a32';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.1)';
      ctx.fillRect(10 + i * 14, 0, 2, h);
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(0, 5 + i * 12, w, 2);
    }
    // collar strip
    ctx.fillStyle = '#1e3d22';
    ctx.fillRect(0, 0, w, 12);
    // red piping
    ctx.fillStyle = '#b01020';
    ctx.fillRect(0, 12, w, 3);
    // shoulder board rectangles
    ctx.fillStyle = '#1a3018';
    ctx.fillRect(8, 20, 36, 14);
    ctx.fillRect(84, 20, 36, 14);
    ctx.fillStyle = '#d4a857';
    ctx.fillRect(12, 24, 28, 3);
    ctx.fillRect(88, 24, 28, 3);
    // pocket flaps
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(22, 55, 28, 22);
    ctx.strokeRect(78, 55, 28, 22);
  }, 128, 128, 2, 2);
}

function textureForUniform(uid) {
  if (uid === 'police') return policeFabricTex();
  if (uid === 'orange') return solidFabricTex('#e07020', { collar: '#c85810', pocket: true });
  if (uid === 'brown') return solidFabricTex('#6b4423', { collar: '#4a2e18', pocket: true });
  if (uid === 'blue') return verticalStripeTex('#dce8ff', '#143a58', { stripeW: 16, collar: '#0d2030', pocket: true, repeatU: 6, repeatV: 1 });
  // bw vertical (VN)
  return verticalStripeTex('#f2f2f2', '#111111', { stripeW: 16, collar: '#222', pocket: true, repeatU: 6, repeatV: 1 });
}

function isClothingName(name) {
  // Quaternius material names: Worker_Yellow, Worker_Vest, White, Grey, Black,
  // Red_Dark, LightBlue, Orange, Swat, Swat_Black, LightBrown, Brown (pants/boots)
  return /worker|vest|pants|shirt|body|cloth|suit|casual|jacket|armor|swat|leg|torso|outfit|uniform|dress|top|bottom|sleeve|collar|\bwhite\b|\bgrey\b|\bgray\b|\bblack\b|red_dark|lightblue|lightbrown|\borange\b|\bbrown\b|\bbrown2\b/.test(name);
}
function isSkinName(name) {
  return /\bskin\b|face|hand|arm_skin|flesh|ear|\bneck\b|skin_darker|\bhead\b|\bskull\b/.test(name);
}
function isHairName(name) {
  return /hair|beard|brow|eyebrow|moustache|mustache/.test(name);
}
function isHatName(name) {
  return /hat|helmet|cap|hood|beret|mask|helm|visor/.test(name);
}
function isBootName(name) {
  return /boot|shoe|sole|foot_gear/.test(name);
}
function isEyeName(name) {
  return /\beye\b|pupil|iris/.test(name);
}

function classifyMat(name) {
  if (isHatName(name)) return 'hat';
  if (isEyeName(name)) return 'eye';
  if (isHairName(name)) return 'hair';
  if (isSkinName(name)) return 'skin';
  if (isBootName(name)) return 'boot';
  if (isClothingName(name)) return 'cloth';
  // unnamed / Cube.* leftovers → cloth so uniforms always paint
  return 'cloth';
}

function applyUniform(root, uid, appearance) {
  const tex = textureForUniform(uid);
  const hairColor = new THREE.Color((appearance && appearance.hair) || '#2a2218');
  const skinColor = new THREE.Color((appearance && appearance.skin) || '#e0b090');
  const bootHex = uid === 'police' ? 0x1a1a1a : 0x2a2218;
  const fallHex = ({
    bw: 0x9a9a9a, blue: 0x6a8fb0, orange: 0xe07020, brown: 0x6b4423, police: 0x2f5a32,
  })[uid] || 0x9a9a9a;

  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const oname = (o.name || '').toLowerCase();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const kinds = mats.map((m) => classifyMat(((m && m.name) || '') + ' ' + oname));

    // Hide prisoner hats / visors by material name
    if (uid !== 'police' && kinds.some((k) => k === 'hat')) {
      o.visible = false;
      return;
    }

    const next = mats.map((m, i) => {
      if (!m) return m;
      const kind = kinds[i];
      if (kind === 'eye') return m;
      if (kind === 'skin') {
        const nm = m.clone();
        nm.map = null;
        nm.color.copy(skinColor);
        nm.needsUpdate = true;
        return nm;
      }
      if (kind === 'hair') {
        const nm = m.clone();
        nm.map = null;
        nm.color.copy(hairColor);
        nm.needsUpdate = true;
        return nm;
      }
      if (kind === 'boot') {
        const nm = m.clone();
        nm.map = null;
        nm.color.setHex(bootHex);
        nm.needsUpdate = true;
        return nm;
      }
      // cloth — lambert + fabric map
      const nm = new THREE.MeshLambertMaterial({
        map: tex,
        color: 0xffffff,
        emissive: new THREE.Color(fallHex).multiplyScalar(0.04),
      });
      nm.name = (m.name || 'Cloth') + '_uniform';
      // Position-based vertical stripes (local X) so atlas UVs cannot scramble them
      if (uid === 'bw' || uid === 'blue') {
        const light = uid === 'blue' ? new THREE.Color('#dce8ff') : new THREE.Color('#f2f2f2');
        const dark = uid === 'blue' ? new THREE.Color('#143a58') : new THREE.Color('#111111');
        nm.onBeforeCompile = (shader) => {
          shader.uniforms.uStripeA = { value: light };
          shader.uniforms.uStripeB = { value: dark };
          shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vStripePos;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStripePos = transformed;');
          shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec3 vStripePos;\nuniform vec3 uStripeA;\nuniform vec3 uStripeB;')
            .replace('#include <map_fragment>',
              `#include <map_fragment>
               float bands = floor(vStripePos.x * 12.0);
               float stripe = mod(abs(bands), 2.0);
               diffuseColor.rgb = mix(uStripeB, uStripeA, stripe);
              `);
        };
        nm.customProgramCacheKey = () => 'vstripe-' + uid;
      }
      return nm;
    });
    o.material = Array.isArray(o.material) ? next : next[0];
  });
}

function addNumberPatch(root, number) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 60);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number || '000').slice(0, 6), 64, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), mat);
  mesh.position.set(0, 1.15, 0.28);
  mesh.name = 'numberPatch';
  root.add(mesh);
  return mesh;
}

function addRainbowBadge(root) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 40;
  const ctx = c.getContext('2d');
  const colors = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#24408e', '#732982'];
  colors.forEach((col, i) => {
    ctx.fillStyle = col;
    ctx.fillRect(0, (i * 40) / 6, 64, 40 / 6 + 1);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.08), mat);
  mesh.position.set(0.22, 1.2, 0.26);
  mesh.name = 'rainbowBadge';
  root.add(mesh);
  return mesh;
}

function addPoliceKit(model) {
  // Peaked cap: green crown, black brim, red band, gold emblem
  const cap = new THREE.Group();
  cap.name = 'policeCap';
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.19, 0.11, 16),
    new THREE.MeshLambertMaterial({ color: 0x2f5a32 })
  );
  crown.position.y = 0;
  cap.add(crown);
  const brim = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.035, 0.2),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
  );
  brim.position.set(0, -0.05, 0.1);
  cap.add(brim);
  const band = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.022, 8, 20),
    new THREE.MeshLambertMaterial({ color: 0xb01020 })
  );
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.02;
  cap.add(band);
  // gold emblem
  const emblem = new THREE.Mesh(
    new THREE.CircleGeometry(0.045, 12),
    new THREE.MeshLambertMaterial({ color: 0xd4a857, emissive: 0x332200, emissiveIntensity: 0.2 })
  );
  emblem.position.set(0, 0.02, 0.18);
  cap.add(emblem);
  const star = new THREE.Mesh(
    new THREE.ConeGeometry(0.025, 0.04, 5),
    new THREE.MeshLambertMaterial({ color: 0xffd700 })
  );
  star.rotation.x = Math.PI;
  star.position.set(0, 0.03, 0.185);
  cap.add(star);
  cap.position.set(0, 1.72, 0);
  model.add(cap);

  // Shoulder boards
  const boardMat = new THREE.MeshLambertMaterial({ color: 0x1a3018 });
  const pipMat = new THREE.MeshLambertMaterial({ color: 0xd4a857 });
  [[-0.22, 1.42, 0.05], [0.22, 1.42, 0.05]].forEach(([x, y, z], i) => {
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.18), boardMat);
    board.position.set(x, y, z);
    board.rotation.z = i === 0 ? 0.25 : -0.25;
    model.add(board);
    const pip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.015, 0.02), pipMat);
    pip.position.set(x, y + 0.025, z);
    model.add(pip);
  });
}

function resolveCharacterKey(kind, opts) {
  const a = opts.appearance || {};
  const uid = uniformFromAppearance({ ...a, stripe: opts.stripe || a.stripe, role: opts.role });
  const isGuard = kind === 'guard' || opts.role === 'guard' || uid === 'police';
  if (isGuard) return 'guard';

  const gender = a.gender || 'nam';
  let body = a.body;
  if (!body) {
    if (gender === 'nu') body = 'female';
    else if (gender === 'lgbt') body = a.bodyStyle === 'female' || a.bodyStyle === 'nu' ? 'female' : 'male';
    else body = 'male';
  }
  if (body === 'nu') body = 'female';
  if (body === 'nam') body = 'male';

  const style = a.hairStyle || 'default';
  if (body === 'female') {
    if (style === 'punk' || style === 'short') return 'prisoner_f_punk';
    if (style === 'formal' || style === 'bun') return 'prisoner_f_formal';
    if (style === 'worker') return 'prisoner_f_worker';
    return 'prisoner_f_casual';
  }
  // male — casual for vertical-stripe countries; worker vest base for solid jumpsuits
  if (uid === 'bw' || uid === 'blue') return 'prisoner_stripe';
  return 'prisoner_orange';
}

export class AssetLibrary {
  constructor() {
    this.ready = false;
    this.failed = false;
    this.manifest = null;
    this.templates = new Map();
    this.propTemplates = new Map();
    this.loader = null;
    this._zoneLoaded = new Set();
  }

  async init() {
    try {
      const draco = new DRACOLoader();
      draco.setDecoderPath('/assets/draco/');
      this.loader = new GLTFLoader();
      this.loader.setDRACOLoader(draco);
      const res = await fetch('/assets/manifest.json');
      this.manifest = await res.json();
      const chars = this.manifest.characters || {};
      await Promise.all(Object.entries(chars).map(async ([key, def]) => {
        try {
          const gltf = await this.loader.loadAsync(def.url);
          this.templates.set(key, { scene: gltf.scene, clips: gltf.animations || [], tint: def.tint, gender: def.gender });
        } catch (e) {
          console.warn('char load fail', key, e);
        }
      }));
      const coreProps = ['chair', 'table', 'bedBunk', 'desk', 'bench', 'cabinet'];
      await this.loadProps(coreProps);
      this.ready = this.templates.size > 0;
      if (!this.ready) this.failed = true;
      return this.ready;
    } catch (e) {
      console.warn('AssetLibrary init failed', e);
      this.failed = true;
      this.ready = false;
      return false;
    }
  }

  async loadProps(keys) {
    if (!this.manifest || !this.loader) return;
    const props = this.manifest.props || {};
    await Promise.all(keys.map(async (key) => {
      if (this.propTemplates.has(key)) return;
      const url = props[key];
      if (!url) return;
      try {
        const gltf = await this.loader.loadAsync(url);
        this.propTemplates.set(key, gltf.scene);
      } catch (e) {
        console.warn('prop fail', key, e.message || e);
      }
    }));
  }

  async ensureZone(zoneId) {
    if (!this.manifest || this._zoneLoaded.has(zoneId)) return;
    const keys = (this.manifest.zonesLazy && this.manifest.zonesLazy[zoneId]) || [];
    await this.loadProps(keys);
    this._zoneLoaded.add(zoneId);
  }

  createCharacter(kind, opts = {}) {
    if (!this.ready) return null;
    const appearance = opts.appearance || {};
    const uid = uniformFromAppearance({
      ...appearance,
      stripe: opts.stripe || appearance.stripe,
      role: opts.role || (kind === 'guard' ? 'guard' : undefined),
    });
    const key = resolveCharacterKey(kind, opts);
    const tpl = this.templates.get(key)
      || this.templates.get(uid === 'police' ? 'guard' : 'prisoner_orange')
      || this.templates.values().next().value;
    if (!tpl) return null;

    const root = new THREE.Group();
    const model = SkeletonUtils.clone(tpl.scene);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !!opts.shadows;
        o.receiveShadow = !!opts.shadows;
        if (o.material) {
          o.material = Array.isArray(o.material)
            ? o.material.map((m) => m.clone())
            : o.material.clone();
        }
        // Hide any hat-like meshes on prisoners
        if (uid !== 'police') {
          const n = ((o.name || '') + ' ' + (o.material && o.material.name || '')).toLowerCase();
          if (isHatName(n)) o.visible = false;
        }
      }
    });
    model.scale.setScalar(opts.scale || 0.95);
    applyUniform(model, uid, appearance);

    if (uid !== 'police') {
      addNumberPatch(model, opts.number || appearance.number || '007');
    } else {
      addPoliceKit(model);
    }

    if (appearance.gender === 'lgbt' && appearance.rainbowBadge !== false) {
      addRainbowBadge(model);
    }

    root.add(model);
    const mixer = new THREE.AnimationMixer(model);
    const actions = {};
    for (const [anim, names] of Object.entries(ANIM_MAP)) {
      const clip = pickClip(tpl.clips, names);
      if (clip) actions[anim] = mixer.clipAction(clip);
    }
    if (actions.idle) actions.idle.play();
    root.userData.gltf = true;
    root.userData.mixer = mixer;
    root.userData.actions = actions;
    root.userData.anim = 'idle';
    root.userData.kind = uid === 'police' ? 'guard' : 'prisoner';
    root.userData.limbs = null;
    root.userData.uniform = uid;
    root.userData.playAnim = (name) => {
      const next = actions[name] || actions.idle;
      if (!next) return;
      if (root.userData.anim === name && next.isRunning()) return;
      const prev = actions[root.userData.anim];
      if (prev) prev.fadeOut(0.15);
      next.reset().fadeIn(0.15).play();
      root.userData.anim = name;
    };
    return root;
  }

  createProp(key, opts = {}) {
    const tpl = this.propTemplates.get(key);
    if (!tpl) return null;
    const inst = tpl.clone(true);
    inst.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !!opts.shadows;
        o.receiveShadow = true;
      }
    });
    if (opts.scale) inst.scale.setScalar(opts.scale);
    if (opts.rotY) inst.rotation.y = opts.rotY;
    if (opts.x != null) inst.position.set(opts.x, opts.y || 0, opts.z || 0);
    return inst;
  }
}

export { ANIM_MAP, applyUniform, textureForUniform };
