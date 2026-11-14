import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

const BASE = import.meta.env.BASE_URL;

export const manager = new THREE.LoadingManager();
const draco = new DRACOLoader(manager).setDecoderPath(`${BASE}draco/`); // hosted locally, no CDN
const gltf = new GLTFLoader(manager).setDRACOLoader(draco);
const textures = new THREE.TextureLoader(manager);

const cache = new Map();

/** Loads /models/<name>.glb once, and returns a fresh clone with its own materials. */
export function loadModel(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      gltf.loadAsync(`${BASE}models/${name}.glb`).then((g) => g.scene)
    );
  }
  return cache.get(name).then((src) => {
    const root = src.clone(true);
    // Two materials per instance, so each object can be dimmed / lit independently.
    const palette = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, metalness: 0.0 });
    const glow = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    glow.color.setScalar(0.9);
    // un-textured screens get a calm blue instead of a bloom-heavy white
    const screen = new THREE.MeshBasicMaterial({ color: 0x3d7fc4, toneMapped: false });
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = /_Screen/.test(o.name) ? screen : o.material.name === 'Glow' ? glow : palette;
    });
    root.userData.palette = palette;
    root.userData.glow = glow;
    return root;
  });
}

/** Texture for a glTF screen quad (UVs are already flipped by the exporter). */
export function loadScreenTexture(file) {
  const t = textures.load(`${BASE}img/${file}`);
  t.flipY = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Replaces the material of a named screen mesh with an unlit textured one. */
export function setScreen(root, name, map, brightness = 1) {
  const mesh = root.getObjectByName(name);
  if (!mesh) return null;
  const mat = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  mat.color.setScalar(brightness);
  mesh.traverse((o) => { if (o.isMesh) o.material = mat; });
  return mat;
}

/** Scales a model so it is `height` units tall, keeping its base on y = 0. */
export function fitHeight(obj, height) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = height / Math.max(box.max.y - box.min.y, 1e-6);
  obj.scale.multiplyScalar(s);
  return obj;
}

// ---------- small shared procedural bits ----------

let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.12)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glowSprite(color, size, opacity = 0.6) {
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false })
  );
  s.scale.setScalar(size);
  return s;
}

/** Canvas texture helper: draw(ctx, w, h). */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A flat text sign (canvas texture on a plane). */
export function textSign(text, { color = '#ffd9a0', bg = 'rgba(10,14,34,0.85)', height = 0.32, font = '600 44px "Segoe UI", system-ui, sans-serif' } = {}) {
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 48;
  const h = 80;
  const tex = canvasTexture(w, h, (g) => {
    if (bg) {
      g.fillStyle = bg;
      g.beginPath();
      g.roundRect(2, 2, w - 4, h - 4, 18);
      g.fill();
    }
    g.font = font;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry((height * w) / h, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false })
  );
  return mesh;
}

/** Procedural placeholder shown until a model has loaded (and kept if loading fails). */
export function ghost(w, h, d) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ color: 0xffb454, wireframe: true, transparent: true, opacity: 0.35 })
  );
  m.position.y = h / 2;
  return m;
}
