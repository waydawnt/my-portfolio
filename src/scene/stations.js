// The seven installer "stations": floating platforms that rise through the lantern sky.
// Each station is built lazily the first time the camera gets near it.
import * as THREE from 'three';
import gsap from 'gsap';
import { loadModel, loadScreenTexture, setScreen, fitHeight, glowSprite, canvasTexture, textSign, ghost } from './models.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const rad = THREE.MathUtils.degToRad;
export const dirVec = (yaw, pitch) => V(Math.sin(rad(yaw)) * Math.cos(rad(pitch)), Math.sin(rad(pitch)), Math.cos(rad(yaw)) * Math.cos(rad(pitch)));

const WARM = 0xffa64a;
const DIM = new THREE.Color(0.1, 0.13, 0.26);
const WHITE = new THREE.Color(1, 1, 1);

// ---------- shared materials / geometry ----------
const stone = new THREE.MeshStandardMaterial({ color: 0x323c72, flatShading: true, roughness: 0.9 });
const rock = new THREE.MeshStandardMaterial({ color: 0x1b2148, flatShading: true, roughness: 1 });
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false });
const metal = new THREE.MeshStandardMaterial({ color: 0x5e78b8, flatShading: true, roughness: 0.55, metalness: 0.35 });
const dark = new THREE.MeshStandardMaterial({ color: 0x161c3a, flatShading: true, roughness: 0.8 });
const gold = new THREE.MeshStandardMaterial({ color: 0xf2b441, flatShading: true, roughness: 0.5, metalness: 0.3 });

function platform(r) {
  const g = new THREE.Group();
  const top = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.86, 0.36, 14), stone);
  top.position.y = -0.18;
  const under = new THREE.Mesh(new THREE.ConeGeometry(r * 0.86, r * 1.15, 9), rock);
  under.rotation.x = Math.PI;
  under.position.y = -0.36 - r * 0.575;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.94, 0.022, 5, 48), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.012;
  g.add(top, under, ring);
  return g;
}

function pedestal(r, h) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, h, 8), stone);
  m.position.y = h / 2;
  return m;
}

/** A holder that shows a wireframe placeholder until the GLB arrives. */
function slot(name, height, size, onReady) {
  const holder = new THREE.Group();
  const g = ghost(size[0], height, size[1]);
  holder.add(g);
  loadModel(name)
    .then((model) => {
      fitHeight(model, height);
      holder.remove(g);
      g.geometry.dispose();
      holder.add(model);
      holder.userData.model = model;
      onReady?.(model);
    })
    .catch((e) => console.warn(`Model "${name}" failed to load; keeping the placeholder.`, e));
  return holder;
}

/**
 * Spur gear sized by tooth count and module `m` (pitch radius = m * teeth / 2).
 * Any two gears built with the same module have the same tooth pitch, so they can mesh.
 */
function gear(teeth, m, depth, mat) {
  const g = new THREE.Group();
  const rp = (m * teeth) / 2;
  const h = m; // tooth height
  const root = rp - h * 0.55;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(root, root, depth, Math.max(16, teeth * 2)), mat);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const toothGeo = new THREE.BoxGeometry(((Math.PI * m) / 2) * 0.86, h + 0.02, depth);
  const pos = toothGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) if (pos.getY(i) > 0) pos.setX(i, pos.getX(i) * 0.5); // taper to the tip
  toothGeo.computeVertexNormals();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = new THREE.Mesh(toothGeo, mat);
    t.position.set(Math.cos(a) * (root + h / 2 - 0.01), Math.sin(a) * (root + h / 2 - 0.01), 0);
    t.rotation.z = a - Math.PI / 2;
    g.add(t);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(root * 0.32, root * 0.32, depth * 1.3, 8), dark);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  g.userData.teeth = teeth;
  g.userData.rp = rp;
  return g;
}

/**
 * Places gear `b` in mesh with gear `a` (centre distance = sum of pitch radii) in direction
 * `theta`, and returns spin(phi): turns `a` to phi and counter-rotates `b` by the tooth ratio,
 * phased so a tooth of one always sits in a gap of the other.
 */
function meshPair(a, b, theta) {
  const d = a.userData.rp + b.userData.rp;
  b.position.set(a.position.x + Math.cos(theta) * d, a.position.y + Math.sin(theta) * d, a.position.z);
  const ratio = a.userData.teeth / b.userData.teeth;
  return (phi) => {
    a.rotation.z = phi;
    b.rotation.z = theta + Math.PI + Math.PI / b.userData.teeth - (phi - theta) * ratio;
  };
}

// =====================================================================
export function buildStations(ctx) {
  const { scene, low, labels } = ctx;

  const defs = [
    { id: 'welcome', center: V(0, 0, 0), yaw: 10, pitch: 7, halfW: 1.9, halfH: 1.75, lookY: 1.35, r: 2.3 },
    { id: 'license', center: V(19, 2.6, -3), yaw: -14, pitch: 9, halfW: 1.9, halfH: 1.6, lookY: 1.1, r: 2.3 },
    { id: 'components', center: V(39, 5.2, 1), yaw: 8, pitch: 13, halfW: 3.0, halfH: 2.0, lookY: 1.3, r: 3.5 },
    { id: 'installing', center: V(60, 7.8, -3), yaw: -10, pitch: 9, halfW: 3.7, halfH: 2.5, lookY: 2.0, r: 4.0 },
    { id: 'programs', center: V(81, 10.4, 0), yaw: 10, pitch: 11, halfW: 3.3, halfH: 1.9, lookY: 1.25, r: 3.7 },
    { id: 'japanese', center: V(101, 13, -3), yaw: -12, pitch: 8, halfW: 2.2, halfH: 1.8, lookY: 1.3, r: 2.5 },
    { id: 'finish', center: V(120, 15.6, 0), yaw: 12, pitch: 6, halfW: 1.7, halfH: 1.75, lookY: 1.5, r: 2.2 },
  ];

  const builders = { welcome, license, components, installing, programs, japanese, finish };

  const stations = defs.map((d, i) => {
    const group = new THREE.Group();
    group.position.copy(d.center);
    group.visible = false;
    scene.add(group);
    const st = {
      ...d,
      index: i,
      group,
      look: d.center.clone().add(V(0, d.lookY, 0)),
      dir: dirVec(d.yaw, d.pitch),
      light: d.center.clone().add(V(-2.2, 3.4, 3.2)),
      built: false,
      ticks: [],
      api: {},
      build() {
        if (st.built) return;
        st.built = true;
        group.add(platform(d.r));
        builders[d.id](st);
      },
      update(t, dt) {
        for (const f of st.ticks) f(t, dt);
      },
    };
    return st;
  });

  return stations;

  // ---------- helpers bound to ctx ----------
  function floatLantern(st, pos, height, phase = 0) {
    const h = slot('lantern', height, [height * 0.55, height * 0.55]);
    h.position.copy(pos);
    const s = glowSprite(WARM, height * 3.2, low ? 0.5 : 0.38);
    s.position.y = height * 0.55;
    h.add(s);
    st.group.add(h);
    st.ticks.push((t) => {
      h.position.y = pos.y + Math.sin(t * 0.6 + phase) * 0.12;
      h.rotation.y = t * 0.15 + phase;
    });
    return h;
  }

  // ---------- 1. Welcome: the package box ----------
  function welcome(st) {
    const state = { lid: 0.4 };
    const box = slot('box', 1.05, [1.4, 1.4], (m) => {
      st.lid = m.getObjectByName('Box_Lid');
    });
    box.position.y = 0.75;
    const inner = glowSprite(0xffc46b, 3.4, 0.5);
    inner.position.y = 0.9;
    box.add(inner);
    st.group.add(box);

    floatLantern(st, V(-2.1, 2.1, -1.6), 0.8, 0);
    floatLantern(st, V(2.3, 2.8, -2.4), 0.65, 2);
    if (!low) floatLantern(st, V(0.6, 3.6, -3.4), 0.55, 4);

    st.ticks.push((t) => {
      box.position.y = 0.75 + Math.sin(t * 0.8) * 0.09;
      box.rotation.y = -0.45 + Math.sin(t * 0.25) * 0.35;
      box.rotation.z = Math.sin(t * 0.5) * 0.03;
      if (st.lid) st.lid.rotation.x = -state.lid;
      inner.material.opacity = 0.3 + state.lid * 0.45;
    });
    // The lid opens as the visitor moves on from the Welcome step.
    st.api.setOpen = (open) => gsap.to(state, { lid: open ? 1.9 : 0.4, duration: ctx.reduce ? 0 : 1.6, ease: 'power2.inOut', overwrite: true });
  }

  // ---------- 2. License: retro monitor showing the agreement ----------
  function license(st) {
    const tex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#0a1a14';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffcc7a';
      g.font = '700 20px Consolas, monospace';
      g.fillText('LICENSE.TXT', 14, 30);
      g.fillStyle = '#7dffb0';
      let y = 54;
      const rnd = mulberry(5);
      for (let i = 0; i < 12; i++) {
        g.font = '600 13px Consolas, monospace';
        g.fillText(`§${(i % 6) + 1}`, 14, y + 9);
        let x = 44;
        while (x < w - 30) {
          const len = 14 + rnd() * 40;
          g.fillRect(x, y, Math.min(len, w - 18 - x), 9);
          x += len + 8;
        }
        y += 17;
      }
    });
    tex.flipY = false;
    tex.wrapT = THREE.RepeatWrapping;
    const mon = slot('monitor', 1.5, [1.5, 1.6], (m) => setScreen(m, 'Monitor_Screen', tex, 0.85));
    mon.rotation.y = 0.3;
    mon.position.set(0.1, 0, -0.2);
    const s = glowSprite(0x7dffb0, 2.6, 0.22);
    s.position.set(0, 1.0, 0.6);
    mon.add(s);
    st.group.add(mon);
    floatLantern(st, V(-2.0, 2.3, -1.8), 0.7, 1);
    st.ticks.push((t) => {
      tex.offset.y = (t * 0.02) % 1;
    });
  }

  // ---------- 3. Components: six objects that light up ----------
  function components(st) {
    const layout = {
      packaging: { x: -2.0, z: 0.9, ph: 0.25, make: () => slot('box', 0.8, [1, 1]) },
      deployment: { x: 0, z: 0.9, ph: 0.25, make: () => { const p = slot('phone', 1.15, [0.55, 0.1]); p.rotation.set(-0.12, -0.3, 0); return p; } },
      automation: { x: 2.0, z: 0.9, ph: 0.25, make: gears },
      development: { x: -2.0, z: -1.2, ph: 1.0, make: () => { const m = slot('monitor', 0.86, [0.85, 0.9]); m.rotation.y = 0.3; m.position.z = -0.18; return m; } },
      games: { x: 0, z: -1.2, ph: 1.0, make: () => slot('arcade', 1.7, [0.7, 0.8]) },
      language: { x: 2.0, z: -1.2, ph: 1.0, make: () => { const b = slot('bookshelf', 1.35, [1.1, 0.4]); b.rotation.y = -0.3; return b; } },
    };
    const items = {};

    function gears() {
      const g = new THREE.Group();
      const m1 = metal.clone();
      const m2 = gold.clone();
      const a = gear(10, 0.07, 0.14, m1);
      a.position.set(-0.14, 0.48, 0);
      const b = gear(7, 0.07, 0.14, m2);
      g.add(a, b);
      const spin = meshPair(a, b, rad(40));
      let angle = 0, lastT = 0;
      spin(0);
      g.userData.spin = (t, lvl) => {
        angle += Math.max(0, Math.min(t - lastT, 0.1)) * 0.9 * lvl; // speed follows the lit level, no jumps
        lastT = t;
        spin(angle);
      };
      return g;
    }

    for (const [id, L] of Object.entries(layout)) {
      const g = new THREE.Group();
      g.position.set(L.x, 0, L.z);
      g.add(pedestal(0.72, L.ph));
      const holder = new THREE.Group();
      holder.position.y = L.ph;
      const obj = L.make();
      holder.add(obj);
      const halo = glowSprite(WARM, 3.0, 0);
      halo.position.y = 0.6;
      holder.add(halo);
      g.add(holder);
      st.group.add(g);

      const it = { level: 0, holder, obj, halo };
      const baseCols = new Map();
      it.apply = () => {
        const mats = [];
        obj.traverse((o) => {
          if (o.isMesh && o.material && !o.material.wireframe && !mats.includes(o.material)) mats.push(o.material);
        });
        for (const m of mats) {
          if (!baseCols.has(m)) baseCols.set(m, m.color.clone());
          const base = baseCols.get(m);
          if (m.isMeshBasicMaterial) m.color.copy(base).multiplyScalar(0.05 + 0.95 * it.level);
          else m.color.copy(base).multiply(DIM.clone().lerp(WHITE, it.level));
        }
        halo.material.opacity = it.level * (low ? 0.5 : 0.36);
      };
      items[id] = it;
      it.apply();
    }

    let last = 0;
    st.ticks.push((t) => {
      // models arrive asynchronously, so re-apply dimming a few times a second
      if (t - last > 0.25 || t < last) { last = t; for (const it of Object.values(items)) it.apply(); }
      for (const it of Object.values(items)) {
        it.obj.userData.spin?.(t, 0.15 + it.level);
        it.holder.position.y = layoutY(it) + Math.sin(t * 0.9 + it.holder.id) * 0.03 * it.level;
      }
    });
    const layoutY = (it) => it.baseY ?? (it.baseY = it.holder.position.y);

    st.api.setGroup = (id, level, pulse) => {
      const it = items[id];
      if (!it) return;
      gsap.to(it, { level, duration: ctx.reduce ? 0 : 0.5, overwrite: true, onUpdate: it.apply, onComplete: it.apply });
      if (pulse && !ctx.reduce) gsap.fromTo(it.holder.scale, { x: 1.16, y: 1.16, z: 1.16 }, { x: 1, y: 1, z: 1, duration: 0.6, ease: 'back.out(3)' });
    };
  }

  // ---------- 4. Installing: the ServiceNow -> Exchange conveyor ----------
  function installing(st) {
    const g = st.group;
    const beltY = 0.7;
    const belt = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.12, 0.8), dark);
    belt.position.y = beltY - 0.06;
    g.add(belt);
    const railGeo = new THREE.BoxGeometry(6.8, 0.05, 0.05);
    for (const z of [-0.42, 0.42]) {
      const rail = new THREE.Mesh(railGeo, ringMat);
      rail.position.set(0, beltY, z);
      g.add(rail);
    }
    const legGeo = new THREE.BoxGeometry(0.12, beltY - 0.1, 0.6);
    for (const x of [-3.1, -1.4, 1.4, 3.1]) {
      const leg = new THREE.Mesh(legGeo, metal);
      leg.position.set(x, (beltY - 0.1) / 2, 0);
      g.add(leg);
    }
    const rollerGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.84, 8);
    for (const x of [-3.4, 3.4]) {
      const r = new THREE.Mesh(rollerGeo, metal);
      r.rotation.x = Math.PI / 2;
      r.position.set(x, beltY - 0.06, 0);
      g.add(r);
    }

    // machine
    const bodyH = beltY + 1.73;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, bodyH, 1.3), new THREE.MeshStandardMaterial({ color: 0x39476f, flatShading: true, roughness: 0.7 }));
    body.position.y = bodyH / 2;
    g.add(body);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.14, 1.45), dark);
    cap.position.y = beltY + 1.78;
    g.add(cap);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x05070f });
    for (const sx of [-1, 1]) {
      const hole = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.56), holeMat);
      hole.rotation.y = (sx * Math.PI) / 2;
      hole.position.set(sx * 0.803, beltY + 0.3, 0);
      g.add(hole);
    }
    const winMat = new THREE.MeshBasicMaterial({ color: 0xffb454, toneMapped: false });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.42), winMat);
    win.position.set(0, beltY + 1.2, 0.652);
    g.add(win);
    const prompt = textSign('PS C:\\> _', { color: '#1d1304', bg: null, height: 0.26, font: '700 44px Consolas, monospace' });
    prompt.position.set(0, beltY + 1.2, 0.66);
    g.add(prompt);
    // two meshing gears mounted on the front of the machine (clear of the wall, window and belt)
    const cog = gear(10, 0.075, 0.12, gold);
    cog.position.set(0.36, beltY + 0.55, 0.735);
    const cog2 = gear(7, 0.075, 0.12, metal);
    g.add(cog, cog2);
    const spinCogs = meshPair(cog, cog2, rad(195));
    spinCogs(0);

    // Exchange Online: a mail cloud above the machine, linked by a beam
    const cloud = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({ color: 0x9fb4e6, flatShading: true, roughness: 0.9, emissive: 0x3355aa, emissiveIntensity: 0.12 });
    for (const [x, y, s] of [[-0.55, 0, 0.42], [0, 0.14, 0.58], [0.58, 0, 0.4], [0.1, -0.12, 0.45]]) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), cloudMat);
      b.position.set(x, y, 0);
      b.rotation.set(x, y * 3, s);
      cloud.add(b);
    }
    cloud.position.set(0, beltY + 3.25, -0.1);
    g.add(cloud);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 6), new THREE.MeshBasicMaterial({ color: 0x8fb7ff, toneMapped: false, transparent: true, opacity: 0.55 }));
    beam.position.set(0, beltY + 2.4, -0.1);
    g.add(beam);
    const pulses = [0, 1, 2].map(() => {
      const p = new THREE.Mesh(new THREE.OctahedronGeometry(0.08, 0), new THREE.MeshBasicMaterial({ color: 0xbfe0ff, toneMapped: false }));
      g.add(p);
      return p;
    });

    // signs
    const L = labels.pipeline;
    const sign = (text, x, y, z, opts) => {
      const s = textSign(text, opts);
      s.position.set(x, y, z);
      g.add(s);
      return s;
    };
    sign(L.in, -2.75, beltY + 1.25, 0.2, { color: '#ffd9a0' });
    sign(L.machine, 0, beltY + 2.12, 0.75, { color: '#ffd9a0', height: 0.28 });
    sign(L.side, 0, beltY + 4.15, 0, { color: '#cfe0ff' });
    sign(L.out, 2.75, beltY + 1.25, 0.2, { color: '#a8f5c4' });

    // tickets
    const ticketTex = (closed) =>
      canvasTexture(160, 120, (c, w, h) => {
        c.fillStyle = closed ? '#dcffe8' : '#fff3da';
        c.fillRect(0, 0, w, h);
        c.fillStyle = closed ? '#2fae6b' : '#ff8a2a';
        c.fillRect(0, 0, w, 34);
        c.fillStyle = '#fff';
        c.font = '700 22px "Segoe UI", sans-serif';
        c.fillText(closed ? L.closed : L.open, 10, 25);
        c.fillStyle = closed ? '#2fae6b' : '#9a6b40';
        if (closed) {
          c.lineWidth = 12;
          c.strokeStyle = '#2fae6b';
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(48, 78); c.lineTo(70, 98); c.lineTo(112, 54);
          c.stroke();
        } else {
          c.fillRect(12, 50, 120, 10); c.fillRect(12, 70, 96, 10); c.fillRect(12, 90, 70, 10);
        }
      });
    const matOpen = new THREE.MeshBasicMaterial({ map: ticketTex(false), side: THREE.DoubleSide, toneMapped: false });
    const matClosed = new THREE.MeshBasicMaterial({ map: ticketTex(true), side: THREE.DoubleSide, toneMapped: false });
    matOpen.color.setScalar(0.74);
    matClosed.color.setScalar(0.74);
    const tGeo = new THREE.PlaneGeometry(0.5, 0.375);
    const N = low ? 6 : 8;
    const span = 6.8;
    const tickets = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(tGeo, matOpen);
      m.rotation.x = -0.3;
      m.userData.off = (i / N) * span;
      g.add(m);
      tickets.push(m);
    }
    const place = (t) => {
      for (const m of tickets) {
        const x = ((m.userData.off + t * 0.45) % span) - span / 2;
        m.position.set(x, beltY + 0.2, 0);
        m.material = x > 0 ? matClosed : matOpen;
        m.visible = Math.abs(x) > 0.55;
      }
    };
    place(0);

    st.ticks.push((t) => {
      place(t);
      spinCogs(t * 1.1);
      winMat.color.setRGB(1, 0.7, 0.33).multiplyScalar(0.8 + Math.sin(t * 3) * 0.12);
      cloud.position.y = beltY + 3.25 + Math.sin(t * 0.7) * 0.06;
      pulses.forEach((p, i) => {
        const f = (t * 0.6 + i / 3) % 1;
        const up = i % 2 === 0 ? f : 1 - f;
        p.position.set(0, beltY + 1.9 + up * 1.0, -0.1);
        p.rotation.y = t * 2;
      });
    });
  }

  // ---------- 5. Installed Programs ----------
  function programs(st) {
    const items = {};
    const add = (key, x, z, ph, obj, y = 0, pr = 0.6) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      if (ph > 0) g.add(pedestal(pr, ph));
      const holder = new THREE.Group();
      holder.position.y = ph + y;
      holder.add(obj);
      g.add(holder);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(pr + 0.06, 0.03, 5, 32), new THREE.MeshBasicMaterial({ color: 0xffb454, toneMapped: false, transparent: true, opacity: 0 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = ph + 0.03;
      g.add(ring);
      st.group.add(g);
      items[key] = { holder, ring, baseY: ph + y, hot: 0 };
      return holder;
    };

    // Global Wishes: lantern
    const lan = slot('lantern', 1.15, [0.7, 0.7]);
    const lg = glowSprite(WARM, 3.6, low ? 0.55 : 0.42);
    lg.position.y = 0.6;
    lan.add(lg);
    add('lantern', -2.5, -0.4, 0.3, lan, 0.45);

    // The Void: arcade cabinet
    const arc = slot('arcade', 2.15, [0.9, 1.0], (m) => setScreen(m, 'Arcade_Screen', loadScreenTexture('tex-void.webp'), 0.8));
    arc.rotation.y = 0.18;
    add('arcade', -0.95, -1.3, 0.12, arc, 0, 0.85);

    // J-Station + JLPT Flashcards: phones
    const phone = (file, ry) => {
      const p = slot('phone', 1.45, [0.7, 0.1], (m) => setScreen(m, 'Phone_Screen', loadScreenTexture(file), 0.72));
      p.rotation.set(-0.14, ry, 0);
      return p;
    };
    add('phoneA', 0.45, 0.8, 0.3, phone('tex-jstation.webp', 0.12));
    add('phoneB', 1.9, 0.55, 0.3, phone('tex-flashcards.webp', -0.2));

    // 3D art: a low-poly sculpt on a turntable
    const art = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshStandardMaterial({ color: 0x7a5cc7, flatShading: true, roughness: 0.75, metalness: 0.0 }));
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.62, 1)), new THREE.LineBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.7 }));
    art.add(gem, wire);
    art.position.y = 0.75;
    add('art', 2.75, -1.1, 0.7, art);

    st.ticks.push((t) => {
      gem.rotation.set(t * 0.3, t * 0.5, 0);
      wire.rotation.set(-t * 0.2, t * 0.35, 0);
      const l = items.lantern.holder;
      l.position.y = items.lantern.baseY + Math.sin(t * 0.7) * 0.1;
      l.rotation.y = t * 0.2;
    });

    st.api.highlight = (key) => {
      for (const [k, it] of Object.entries(items)) {
        const on = k === key;
        const s = on ? 1.12 : 1;
        gsap.to(it.holder.scale, { x: s, y: s, z: s, duration: ctx.reduce ? 0 : 0.35, ease: 'power2.out', overwrite: true });
        gsap.to(it.ring.material, { opacity: on ? 1 : 0, duration: ctx.reduce ? 0 : 0.3, overwrite: true });
      }
    };
  }

  // ---------- 6. Japanese: bookshelf ----------
  function japanese(st) {
    const shelf = slot('bookshelf', 2.1, [1.7, 0.6]);
    shelf.rotation.y = 0.28;
    shelf.position.set(0.2, 0, -0.2);
    const s = glowSprite(WARM, 3.2, 0.22);
    s.position.set(0, 1.4, 0.5);
    shelf.add(s);
    st.group.add(shelf);
    floatLantern(st, V(-1.9, 1.5, 0.2), 0.75, 3);

    const chars = ['日', '本', '語'].map((ch, i) => {
      const m = textSign(ch, { color: '#ffe2b0', bg: 'rgba(214,48,74,0.85)', height: 0.55, font: '600 52px "Yu Gothic UI", "Meiryo", "Noto Sans JP", "Hiragino Sans", sans-serif' });
      m.position.set(1.75, 2.5 - i * 0.68, 0.3 - i * 0.1);
      st.group.add(m);
      return m;
    });
    st.ticks.push((t) => {
      chars.forEach((m, i) => {
        m.position.y = 2.5 - i * 0.68 + Math.sin(t * 0.8 + i * 1.3) * 0.06;
        m.rotation.y = -0.25 + Math.sin(t * 0.5 + i) * 0.12;
      });
    });
  }

  // ---------- 7. Finish: mailbox + released lanterns ----------
  function finish(st) {
    const state = { flag: 0, door: 0 };
    let flag, door;
    const box = slot('mailbox', 2.3, [0.7, 0.9], (m) => {
      flag = m.getObjectByName('Mailbox_Flag');
      door = m.getObjectByName('Mailbox_Door');
    });
    box.rotation.y = 0.5;
    const g = glowSprite(0xffc46b, 2.6, 0);
    g.position.set(0, 2.0, 0.6);
    box.add(g);
    st.group.add(box);
    floatLantern(st, V(1.9, 2.4, -1.4), 0.7, 5);

    st.ticks.push(() => {
      if (flag) flag.rotation.x = -state.flag * (Math.PI / 2);
      if (door) door.rotation.x = state.door * 1.45;
      g.material.opacity = state.door * 0.45;
    });
    st.api.setFlag = (up) => gsap.to(state, { flag: up ? 1 : 0, duration: ctx.reduce ? 0 : 0.9, ease: 'back.out(2)', overwrite: 'auto' });
    st.api.setDoor = (open) => gsap.to(state, { door: open ? 1 : 0, duration: ctx.reduce ? 0 : 0.6, ease: 'power2.out', overwrite: 'auto' });

    let live = 0;
    st.api.release = (count = 1) => {
      for (let i = 0; i < count; i++) {
        if (live >= (low ? 5 : 10)) return;
        live++;
        const h = slot('lantern', 0.5 + Math.random() * 0.25, [0.3, 0.3]);
        const sp = glowSprite(WARM, 2.6, 0.45);
        sp.position.y = 0.4;
        h.add(sp);
        h.position.set((Math.random() < 0.5 ? -1 : 1) * (0.9 + Math.random() * 1.3), 0.3, -1.6 + Math.random() * 1.6);
        h.scale.setScalar(0.01);
        st.group.add(h);
        if (ctx.reduce) {
          h.scale.setScalar(1);
          h.position.y = 3.5 + Math.random() * 2;
          continue; // stays as a still lantern
        }
        const dur = 9 + Math.random() * 4;
        gsap.to(h.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(2)', delay: i * 0.25 });
        gsap.to(h.position, { y: 11 + Math.random() * 3, x: h.position.x + (Math.random() - 0.5) * 3, duration: dur, ease: 'sine.in', delay: i * 0.25 });
        gsap.to(h.rotation, { y: Math.PI * (Math.random() - 0.5) * 2, duration: dur, delay: i * 0.25, onComplete: () => { st.group.remove(h); live--; } });
      }
    };
  }
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
