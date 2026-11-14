// Pointer interaction for the scene: hover glow + tilt, click/tap to select, drag to look around.
// Raycasts only against a handful of invisible proxy boxes, and at most ~11 times a second.
import * as THREE from 'three';
import { glowSprite } from './models.js';

const UI = '.page, .titlebar, .wizard-foot, .overlay, .float-ui';
const RAY_MS = 90;
const MAX_YAW = 0.5, MAX_PITCH = 0.16;

export function createInteraction({ camera, reduce, low }) {
  const hotspots = new Map();
  const listeners = { select: [], miss: [], hover: [] };
  const emit = (type, ...args) => listeners[type].forEach((f) => f(...args));
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const v = new THREE.Vector3();
  const pivot = new THREE.Vector3(), turned = new THREE.Vector3();
  const fine = matchMedia('(pointer: fine)').matches;

  let stations = [];
  let activeIndex = 0;
  let enabled = true;
  let hovered = null;   // pointer
  let focused = null;   // keyboard
  const ptr = { x: 0, y: 0, moved: false, overUI: true, down: false, dragging: false, sx: 0, sy: 0, touch: false, lastRay: 0 };
  const look = { yaw: 0, pitch: 0, tYaw: 0, tPitch: 0 };

  /**
   * Registers a clickable object.
   * node: Object3D already attached to its parent. size/offset: proxy box in node-local units.
   */
  function add({ id, node, station, size, offset = [0, size[1] / 2, 0], tilt = true, glow = 0xffc46b, glowScale = 2.3 }) {
    let wrap = null;
    if (tilt && !reduce && fine) {
      wrap = new THREE.Group();
      node.parent.add(wrap);
      wrap.add(node);
    }
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]));
    proxy.position.fromArray(offset);
    proxy.visible = false; // never drawn; Raycaster still tests it
    proxy.userData.hotspot = id;
    node.add(proxy);
    const sprite = glowSprite(glow, Math.max(size[0], size[1]) * glowScale, 0);
    sprite.position.fromArray(offset);
    sprite.visible = false;
    node.add(sprite);
    const h = { id, node, wrap, proxy, sprite, station, offset, level: 0, rx: 0, ry: 0, boost: 0 };
    hotspots.set(id, h);
    return h;
  }

  const candidates = () => {
    const list = [];
    for (const h of hotspots.values()) if (h.station.index === activeIndex && h.station.group.visible && h.proxy.parent) list.push(h.proxy);
    return list;
  };

  function hitTest(clientX, clientY) {
    if (!enabled) return null;
    ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects(candidates(), false)[0];
    return hit ? hit.object.userData.hotspot : null;
  }

  function screenOf(id) {
    const h = hotspots.get(id);
    if (!h) return null;
    h.proxy.getWorldPosition(v).project(camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  function setHovered(id) {
    if (id === hovered) return;
    hovered = id;
    document.documentElement.classList.toggle('scene-hot', Boolean(id));
    emit('hover', id);
  }

  // ---------- pointer events (on window: the canvas sits behind the page) ----------
  const onMove = (e) => {
    ptr.x = e.clientX;
    ptr.y = e.clientY;
    ptr.moved = true;
    if (!ptr.down) {
      ptr.overUI = Boolean(e.target.closest?.(UI));
      return;
    }
    const dx = e.clientX - ptr.sx, dy = e.clientY - ptr.sy;
    if (!ptr.dragging && Math.hypot(dx, dy) > 7) {
      ptr.dragging = true;
      ptr.yaw0 = look.tYaw;
      ptr.pitch0 = look.tPitch;
      setHovered(null);
      document.documentElement.classList.add('scene-dragging');
    }
    if (ptr.dragging) {
      look.tYaw = THREE.MathUtils.clamp(ptr.yaw0 - dx * 0.0042, -MAX_YAW, MAX_YAW);
      if (!ptr.touch) look.tPitch = THREE.MathUtils.clamp(ptr.pitch0 + dy * 0.003, -MAX_PITCH, MAX_PITCH);
    }
  };
  const onDown = (e) => {
    if (!enabled || !e.isPrimary || e.button > 0) return;
    if (e.target.closest?.(UI)) return;
    ptr.down = true;
    ptr.dragging = false;
    ptr.touch = e.pointerType !== 'mouse';
    ptr.sx = e.clientX;
    ptr.sy = e.clientY;
  };
  const onUp = (e) => {
    if (!ptr.down) return;
    const wasDrag = ptr.dragging;
    ptr.down = false;
    ptr.dragging = false;
    document.documentElement.classList.remove('scene-dragging');
    if (wasDrag || e.type === 'pointercancel') return;
    const id = hitTest(e.clientX, e.clientY);
    if (id) emit('select', id, { x: e.clientX, y: e.clientY });
    else emit('miss');
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', onUp, { passive: true });
  window.addEventListener('pointercancel', onUp, { passive: true });

  return {
    add,
    hitTest,
    screenOf,
    look,
    on: (type, fn) => listeners[type].push(fn),
    setStations: (s) => { stations = s; },
    setEnabled: (on) => { enabled = on; if (!on) setHovered(null); },
    setFocused: (id) => { focused = id; },
    /** Briefly flashes a hotspot's glow (used when something is opened or collected). */
    flash(id) { const h = hotspots.get(id); if (h) h.boost = 1; },
    get: (id) => hotspots.get(id),

    /** Called once per frame from the render loop. */
    update(now, dt, p) {
      const idx = Math.round(p);
      if (idx !== activeIndex) {
        activeIndex = idx;
        look.tYaw = 0;
        look.tPitch = 0;
        setHovered(null);
      }
      const k = reduce ? 1 : Math.min(1, dt * 7);
      look.yaw += (look.tYaw - look.yaw) * k;
      look.pitch += (look.tPitch - look.pitch) * k;

      // hover: mouse only, throttled, and only while the pointer is over the scene
      if (fine && enabled && ptr.moved && !ptr.down && now - ptr.lastRay > RAY_MS) {
        ptr.moved = false;
        ptr.lastRay = now;
        setHovered(ptr.overUI ? null : hitTest(ptr.x, ptr.y));
      }

      const mx = (ptr.x / window.innerWidth) * 2 - 1, my = (ptr.y / window.innerHeight) * 2 - 1;
      for (const h of hotspots.values()) {
        if (!h.station.group.visible) continue;
        const on = h.id === hovered || h.id === focused;
        h.boost = Math.max(0, h.boost - dt * 1.4);
        h.level += ((on ? 1 : 0) - h.level) * k;
        const glow = Math.max(h.level, h.boost);
        h.sprite.visible = glow > 0.02;
        if (h.sprite.visible) h.sprite.material.opacity = glow * (low ? 0.6 : 0.42);
        if (!h.wrap) continue;
        // lean a little toward the pointer, pivoting on the object's own centre
        let rx = 0, ry = 0;
        if (h.id === hovered) {
          h.proxy.getWorldPosition(v).project(camera);
          ry = THREE.MathUtils.clamp((mx - v.x) * 0.9, -0.22, 0.22);
          rx = THREE.MathUtils.clamp((my + v.y) * 0.6, -0.14, 0.14);
        }
        h.rx += (rx - h.rx) * k;
        h.ry += (ry - h.ry) * k;
        if (Math.abs(h.rx) + Math.abs(h.ry) < 0.0005) {
          if (h.wrap.rotation.x || h.wrap.rotation.y) { h.wrap.rotation.set(0, 0, 0); h.wrap.position.set(0, 0, 0); }
          continue;
        }
        h.wrap.rotation.set(h.rx, h.ry, 0);
        pivot.copy(h.node.position).add(turned.fromArray(h.offset));
        turned.copy(pivot).applyEuler(h.wrap.rotation);
        h.wrap.position.copy(pivot).sub(turned);
      }
    },
  };
}
