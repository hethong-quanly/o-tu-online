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

function pickClip(clips, names) {
  for (const n of names) {
    const c = clips.find((x) => x.name === n || x.name.toLowerCase() === n.toLowerCase());
    if (c) return c;
  }
  return clips[0] || null;
}

function applyTint(root, tint) {
  root.traverse((o) => {
    if (!o.isMesh || !o.material) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((m) => {
      if (!m || !m.color) return;
      const name = (m.name || o.name || '').toLowerCase();
      const isSkin = /skin|face|head|hand|arm|leg_skin|flesh/.test(name);
      const isEye = /eye|brow|moustache|hair|beard/.test(name);
      if (isSkin || isEye) return;
      if (tint === 'orange') {
        if (/worker|vest|yellow|pants|shirt|body|cloth|suit|casual|jacket/.test(name) || true) {
          // recolor non-skin clothing toward orange jumpsuit
          if (!/boot|shoe|black|grey|gray|metal|weapon|gun/.test(name)) {
            m.color.setHex(0xe07020);
            m.emissive = m.emissive || new THREE.Color(0x000000);
          }
        }
      } else if (tint === 'stripe') {
        if (!/boot|shoe|black|metal|weapon|gun/.test(name)) {
          if (!m.userData._stripeMapped) {
            const c = document.createElement('canvas');
            c.width = 64; c.height = 64;
            const ctx = c.getContext('2d');
            for (let y = 0; y < 64; y += 8) {
              ctx.fillStyle = (y / 8) % 2 === 0 ? '#f5f5f5' : '#1a1a1a';
              ctx.fillRect(0, y, 64, 8);
            }
            const tex = new THREE.CanvasTexture(c);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            tex.repeat.set(2, 3);
            m.map = tex;
            m.color.setHex(0xffffff);
            m.userData._stripeMapped = true;
          }
        }
      } else if (tint === 'police') {
        if (/swat|armor|vest|body|suit|pants|shirt|cloth/.test(name) || !/boot|skin|eye|hair|weapon|gun/.test(name)) {
          m.color.setHex(0x3a4a28); // olive
        }
        if (/collar|shoulder|hat|helmet|cap/.test(name)) {
          m.color.setHex(0xb01020); // red accents
        }
      }
      m.needsUpdate = true;
    });
  });
}

function addNumberPatch(root, number, THREE_ref) {
  const T = THREE_ref || THREE;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, 128, 64);
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 60);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 28px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(number || '000').slice(0, 6), 64, 34);
  const tex = new T.CanvasTexture(c);
  const mat = new T.MeshBasicMaterial({ map: tex, transparent: true });
  const mesh = new T.Mesh(new T.PlaneGeometry(0.28, 0.14), mat);
  mesh.position.set(0, 1.15, 0.28);
  mesh.name = 'numberPatch';
  root.add(mesh);
  return mesh;
}

export class AssetLibrary {
  constructor() {
    this.ready = false;
    this.failed = false;
    this.manifest = null;
    this.templates = new Map(); // key -> {scene, clips}
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
      // preload core characters
      const chars = this.manifest.characters || {};
      await Promise.all(Object.entries(chars).map(async ([key, def]) => {
        try {
          const gltf = await this.loader.loadAsync(def.url);
          this.templates.set(key, { scene: gltf.scene, clips: gltf.animations || [], tint: def.tint });
        } catch (e) {
          console.warn('char load fail', key, e);
        }
      }));
      // preload common props (canteen/quarantine essentials)
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
    let key = 'prisoner_orange';
    const stripe = (opts.appearance && opts.appearance.stripe) || opts.tint || (opts.stripe === true ? 'stripe' : opts.stripe) || '';
    if (kind === 'guard' || opts.role === 'guard' || stripe === 'police') key = 'guard';
    else if (stripe === 'blue_white' || stripe === 'stripe' || stripe === 'bw' || opts.tint === 'stripe') key = 'prisoner_stripe';
    else key = 'prisoner_orange';
    const tpl = this.templates.get(key) || this.templates.values().next().value;
    if (!tpl) return null;
    const root = new THREE.Group();
    const model = SkeletonUtils.clone(tpl.scene);
    model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = !!opts.shadows;
        o.receiveShadow = !!opts.shadows;
        if (o.material) {
          o.material = o.material.clone();
        }
      }
    });
    // Quaternius chars ~1.8m; scale to game units
    model.scale.setScalar(opts.scale || 0.95);
    applyTint(model, tpl.tint || (key === 'guard' ? 'police' : key === 'prisoner_stripe' ? 'stripe' : 'orange'));
    if (key !== 'guard') addNumberPatch(model, opts.number || (opts.appearance && opts.appearance.number) || '007', THREE);
    // olive cap for guard
    if (key === 'guard') {
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.2, 0.12, 12),
        new THREE.MeshLambertMaterial({ color: 0x2a3a18 })
      );
      cap.position.set(0, 1.72, 0);
      const brim = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12),
        new THREE.MeshLambertMaterial({ color: 0x2a3a18 })
      );
      brim.position.set(0, -0.05, 0.06);
      cap.add(brim);
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.19, 0.025, 8, 16),
        new THREE.MeshLambertMaterial({ color: 0xb01020 })
      );
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.02;
      cap.add(band);
      model.add(cap);
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
    root.userData.kind = kind;
    // approximate limbs flag so old animateCharacter skips bone hacks
    root.userData.limbs = null;
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

export { ANIM_MAP, applyTint };
