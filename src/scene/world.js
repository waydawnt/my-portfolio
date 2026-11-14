// Night sky, drifting lanterns, camera rig and render loop.
import * as THREE from 'three';
import gsap from 'gsap';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { manager, loadModel, glowTexture } from './models.js';
import { buildStations, dirVec } from './stations.js';
import { createInteraction } from './interact.js';

const FOV = 38;

export async function createWorld({ canvas, low, reduce, labels, onProgress }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  let pixelRatio = Math.min(window.devicePixelRatio || 1, low ? 1.25 : 1.75);
  renderer.setPixelRatio(pixelRatio);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x000000, 0.0105);
  scene.fog.color.setRGB(0.034, 0.03, 0.09); // same as the sky's horizon colour, so the ground melts into it
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 900);

  // ---------- lights: few, no shadows ----------
  scene.add(new THREE.HemisphereLight(0x8fa6ff, 0x3a2416, 1.15));
  const moonDir = new THREE.Vector3(0.42, 0.5, -0.76).normalize();
  const moonLight = new THREE.DirectionalLight(0xb9ccff, 1.3);
  moonLight.position.copy(moonDir).multiplyScalar(50);
  scene.add(moonLight, moonLight.target);
  const key = new THREE.PointLight(0xffb066, 90, 22, 1.8); // warm lantern light, follows the active step
  scene.add(key);
  let rim = null;
  if (!low) {
    rim = new THREE.PointLight(0x6f8cff, 55, 20, 1.8);
    scene.add(rim);
  }

  // ---------- sky ----------
  const sky = new THREE.Group();
  scene.add(sky);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 24, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {},
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `
        varying vec3 vDir;
        void main(){
          float h = vDir.y;
          vec3 zenith = vec3(0.004, 0.007, 0.030);
          vec3 mid    = vec3(0.012, 0.020, 0.075);
          vec3 horizon= vec3(0.034, 0.030, 0.090);
          vec3 below  = vec3(0.034, 0.030, 0.090);
          vec3 c = mix(horizon, mid, smoothstep(0.0, 0.30, h));
          c = mix(c, zenith, smoothstep(0.22, 0.85, h));
          c = mix(c, below, smoothstep(0.0, -0.35, h));
          c += vec3(0.16, 0.06, 0.03) * exp(-max(h, 0.0) * 6.0) * 0.2 * smoothstep(0.0, 0.07, h);   // warm lantern haze at the horizon
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    })
  );
  dome.renderOrder = -10;
  sky.add(dome);

  const starLayers = [];
  for (let layer = 0; layer < 2; layer++) {
    const n = low ? 350 : 900;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const y = Math.pow(Math.random(), 0.8) * 0.95 + 0.03;
      const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(u) * r * 500, y * 500, Math.sin(u) * r * 500], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: layer ? 0xcfe0ff : 0xfff1dc, size: layer ? 1.6 : 2.3, sizeAttenuation: false, transparent: true, opacity: 0.85, fog: false, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.renderOrder = -9;
    sky.add(pts);
    starLayers.push(mat);
  }

  const moon = new THREE.Mesh(new THREE.CircleGeometry(15, 28), new THREE.MeshBasicMaterial({ color: 0xfff2d8, fog: false, toneMapped: false, depthWrite: false }));
  moon.material.color.multiplyScalar(1.15);
  moon.position.copy(moonDir).multiplyScalar(480);
  moon.lookAt(0, 0, 0);
  moon.renderOrder = -8;
  const moonHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x9fb6ff, transparent: true, opacity: 0.4, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
  moonHalo.scale.setScalar(150);
  moonHalo.position.copy(moon.position);
  moonHalo.renderOrder = -8;
  sky.add(moon, moonHalo);

  // ---------- ground: a dark, misty plain far below ----------
  const ground = new THREE.Mesh(new THREE.CircleGeometry(700, 40), new THREE.MeshStandardMaterial({ color: 0x0b1030, roughness: 0.55, metalness: 0.2 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(60, -9, 0);
  scene.add(ground);

  // ---------- drifting lanterns (one instanced draw call + one points halo) ----------
  const COUNT = low ? 170 : 340;
  const lanternGeo = new THREE.CylinderGeometry(0.2, 0.13, 0.44, 6, 1, false);
  {
    const p = lanternGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const k = p.getY(i) < 0 ? 1.0 : 0.62; // brighter near the flame
      col.set([k, k * 0.86, k * 0.62], i * 3);
    }
    lanternGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const lanterns = new THREE.InstancedMesh(lanternGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), COUNT);
  lanterns.frustumCulled = false;
  const L = { x: new Float32Array(COUNT), y: new Float32Array(COUNT), z: new Float32Array(COUNT), sp: new Float32Array(COUNT), ph: new Float32Array(COUNT), am: new Float32Array(COUNT) };
  const Y0 = -12, YR = 66; // vertical wrap range
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const haloPos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    L.x[i] = -45 + Math.random() * 215;
    L.y[i] = Math.random() * YR;
    // mostly behind the stations, a few beside them, none between camera and subject
    L.z[i] = -9 - Math.pow(Math.random(), 1.4) * (low ? 48 : 75); // always behind the deepest platform edge
    L.sp[i] = 0.25 + Math.random() * 0.45;
    L.ph[i] = Math.random() * 6.28;
    L.am[i] = 0.3 + Math.random() * 0.9;
    const s = 0.8 + Math.random() * 1.5;
    dummy.position.set(L.x[i], Y0 + L.y[i], L.z[i]);
    dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * 6.28, (Math.random() - 0.5) * 0.2);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    lanterns.setMatrixAt(i, dummy.matrix);
    tint.setHSL(0.055 + Math.random() * 0.05, 1, 0.5 + Math.random() * 0.1).multiplyScalar(1.25);
    lanterns.setColorAt(i, tint);
  }
  scene.add(lanterns);
  const haloGeo = new THREE.BufferGeometry();
  haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
  const halos = new THREE.Points(haloGeo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xff9838, size: low ? 5.5 : 4.2, sizeAttenuation: true, transparent: true, opacity: low ? 0.55 : 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  halos.frustumCulled = false;
  scene.add(halos);

  function updateLanterns(t) {
    const m = lanterns.instanceMatrix.array;
    for (let i = 0; i < COUNT; i++) {
      const y = Y0 + ((L.y[i] + t * L.sp[i]) % YR);
      const x = L.x[i] + Math.sin(t * 0.21 + L.ph[i]) * L.am[i];
      const z = L.z[i] + Math.cos(t * 0.17 + L.ph[i]) * L.am[i] * 0.6;
      const o = i * 16;
      m[o + 12] = x; m[o + 13] = y; m[o + 14] = z;
      const h = i * 3;
      haloPos[h] = x; haloPos[h + 1] = y; haloPos[h + 2] = z;
    }
    lanterns.instanceMatrix.needsUpdate = true;
    haloGeo.attributes.position.needsUpdate = true;
  }
  updateLanterns(0);

  // ---------- stations ----------
  const interact = createInteraction({ camera, reduce, low });
  const ctx = { scene, low, reduce, labels, hot: interact.add };
  const stations = buildStations(ctx);
  interact.setStations(stations);
  const last = stations.length - 1;

  // ---------- post-processing (high tier only) ----------
  let composer = null;
  let bloom = null;
  function makeComposer() {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, target);
    composer.addPass(new RenderPass(scene, camera));
    bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.38, 0.7, 0.9);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
  }
  if (!low) makeComposer();

  // ---------- camera rig ----------
  const state = { p: 0, intro: 0 }; // smoothed step progress (0..6) + intro fly-in, driven by GSAP
  let target = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let W = 1, H = 1, portrait = false;
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), lookA = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const sph = new THREE.Spherical();

  function stationCam(s, out) {
    // distance that fits the station into the part of the screen not covered by the panel
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    const fracW = portrait ? 0.9 : 0.47;
    const fracH = portrait ? 0.34 : 0.7;
    const dW = s.halfW / (fracW * tan * camera.aspect);
    const dH = s.halfH / (fracH * tan);
    const d = Math.max(dW, dH) * 1.04;
    return out.copy(s.dir).multiplyScalar(d).add(s.look);
  }

  function resize() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    portrait = W < 761;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    // phones look more level, so more lantern sky shows in the narrow band above the panel
    for (const s of stations) s.dir.copy(dirVec(s.yaw, portrait ? s.pitch * 0.45 : s.pitch));
    // keep the subject clear of the panel: to the right on desktop, in the top band on phones
    if (portrait) camera.setViewOffset(W, H, 0, H * 0.27, W, H);
    else camera.setViewOffset(W, H, -W * 0.235, -H * 0.01, W, H);
    camera.updateProjectionMatrix();
    if (composer) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(W, H);
    }
  }

  function updateCamera() {
    const p = THREE.MathUtils.clamp(state.p, 0, last);
    const a = Math.min(Math.floor(p), last - 1);
    const f = p - a;
    const e = f * f * (3 - 2 * f);
    const A = stations[a], B = stations[a + 1];
    stationCam(A, tmpA);
    stationCam(B, tmpB);
    camPos.lerpVectors(tmpA, tmpB, e);
    camPos.y += Math.sin(f * Math.PI) * 1.6; // gentle swoop between steps
    camPos.y += state.intro * 7;
    camPos.z += state.intro * 15;
    lookA.lerpVectors(A.look, B.look, e);
    if (interact.look.yaw || interact.look.pitch) {
      // drag-to-look: orbit a little around the subject, within fixed limits
      sph.setFromVector3(tmpA.copy(camPos).sub(lookA));
      sph.theta += interact.look.yaw;
      sph.phi = THREE.MathUtils.clamp(sph.phi - interact.look.pitch, 0.75, 1.56);
      camPos.setFromSpherical(sph).add(lookA);
    }
    mouse.sx += (mouse.x - mouse.sx) * 0.05;
    mouse.sy += (mouse.y - mouse.sy) * 0.05;
    camera.position.copy(camPos);
    camera.position.x += mouse.sx * 0.35;
    camera.position.y += -mouse.sy * 0.2;
    camera.lookAt(lookA);
    sky.position.copy(camera.position);
    key.position.lerpVectors(A.light, B.light, e);
    if (rim) rim.position.lerpVectors(A.look, B.look, e).add(tmpA.set(3.2, 1.6, -3.4));

    for (const s of stations) {
      const near = Math.abs(s.index - p) < 1.35;
      if (near && !s.built) s.build();
      s.group.visible = near;
    }
  }

  // ---------- loop ----------
  let running = false, raf = 0, t = 0;
  let slowFrames = 0, frames = 0;

  let prev = 0;
  function frame(now = performance.now()) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(Math.max((now - prev) / 1000, 0), 0.1);
    prev = now;
    if (!reduce) {
      t += dt;
      updateLanterns(t);
      starLayers[0].opacity = 0.7 + Math.sin(t * 0.9) * 0.18;
      starLayers[1].opacity = 0.7 + Math.cos(t * 0.6) * 0.18;
    }
    interact.update(now, dt, state.p);
    updateCamera();
    for (const s of stations) if (s.group.visible) s.update(t, dt);
    if (composer) composer.render(dt);
    else renderer.render(scene, camera);

    // Watchdog: if a "high" device cannot keep up, drop bloom and resolution for good.
    if (composer && ++frames > 90) {
      if (dt > 1 / 34) slowFrames++;
      if (frames > 330) {
        if (slowFrames > 130) degrade();
        frames = 91; slowFrames = 0;
      }
    }
  }

  function degrade() {
    composer?.dispose?.();
    composer = null;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 1.1);
    document.documentElement.classList.add('tier-low');
    resize();
  }

  const onMouse = (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (!reduce && !low && matchMedia('(pointer: fine)').matches) window.addEventListener('pointermove', onMouse, { passive: true });
  window.addEventListener('resize', resize);

  // ---------- initial load: decoder + first two stations' models ----------
  let done = 0;
  const first = ['box', 'lantern', 'monitor'];
  onProgress?.(0.08);
  await Promise.all(
    first.map((n) =>
      loadModel(n)
        .catch(() => null)
        .then(() => onProgress?.(0.08 + (++done / first.length) * 0.82))
    )
  );
  resize();
  stations[0].build();
  stations[1].build();
  updateCamera();
  renderer.compile(scene, camera);
  if (composer) composer.render(0); else renderer.render(scene, camera);
  onProgress?.(1);

  return {
    stations,
    manager,
    start() {
      if (running) return;
      running = true;
      interact.setEnabled(true);
      prev = performance.now();
      frame();
    },
    stop() {
      running = false;
      interact.setEnabled(false);
      cancelAnimationFrame(raf);
    },
    resize,
    /** p is the fractional step (0..6). */
    setProgress(p, instant = false) {
      if (Math.abs(p - target) < 1e-4 && !instant) return;
      target = p;
      gsap.to(state, { p, duration: reduce || instant ? 0 : 0.9, ease: 'power2.out', overwrite: 'auto' });
    },
    /** Intro: fly in from high above the first station. */
    intro() {
      if (reduce) return;
      gsap.fromTo(state, { intro: 1 }, { intro: 0, duration: 2.8, ease: 'power3.out' });
    },
    api: (id) => stations.find((s) => s.id === id)?.api ?? {},
    // scene interaction (see interact.js)
    on: interact.on,
    hitTest: interact.hitTest,
    screenOf: interact.screenOf,
    setFocused: interact.setFocused,
    flash: interact.flash,
  };
}
