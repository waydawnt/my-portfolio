// "Build a package": put three items in the box, press Build, watch it seal and ship.
// Works by dragging (mouse / pen), or by tapping / pressing Enter on each item.
import gsap from 'gsap';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initPackager({ content, reduce, getWorld }) {
  const P = content.steps.installing.packager;
  const el = $('.packager');
  const items = $$('.pk-item', el);
  const drop = $('[data-drop]', el);
  const count = $('.pk-count', el);
  const status = $('.pk-status', el);
  const bar = $('.pk-bar', el);
  const fill = $('.bar-fill', bar);
  const buildBtn = $('[data-build]', el);
  const resetBtn = $('[data-pk-reset]', el);
  const placed = new Set();
  let state = 'idle'; // idle | building | shipping | done
  let tl = null;

  const scene = () => getWorld()?.api('installing').pkg;

  function render() {
    items.forEach((b) => {
      const on = placed.has(b.dataset.item);
      b.setAttribute('aria-pressed', String(on));
      b.disabled = state !== 'idle';
    });
    count.textContent = `${placed.size} / ${items.length}`;
    el.dataset.state = state;
    el.dataset.count = placed.size;
    buildBtn.disabled = state !== 'idle' || placed.size < items.length;
    buildBtn.hidden = state === 'done';
    resetBtn.hidden = state !== 'done';
    if (state === 'idle') {
      status.textContent = placed.size === 0 ? P.statusEmpty : placed.size < items.length ? P.statusSome.replace('{n}', placed.size).replace('{total}', items.length) : P.statusReady;
      setBar(0);
    }
    scene()?.setItems(placed.size / items.length);
  }

  function setBar(v) {
    fill.style.transform = `scaleX(${v})`;
    bar.setAttribute('aria-valuenow', Math.round(v * 100));
  }

  function toggle(id, force) {
    if (state !== 'idle') return;
    const on = force ?? !placed.has(id);
    if (on) placed.add(id);
    else placed.delete(id);
    render();
  }

  function finish() {
    state = 'done';
    status.textContent = P.statusDone;
    render();
    resetBtn.focus({ preventScroll: true });
  }

  function ship() {
    state = 'shipping';
    status.textContent = P.statusShipping;
    render();
    const s = scene();
    if (s && !reduce) s.ship(finish);
    else { s?.ship(() => {}); finish(); }
  }

  function build() {
    if (state !== 'idle' || placed.size < items.length) return;
    state = 'building';
    render();
    if (reduce) {
      setBar(1);
      scene()?.seal();
      return ship();
    }
    const prog = { v: 0 };
    tl = gsap.timeline({ onComplete: ship });
    P.phases.forEach((text, i) => {
      tl.call(() => { status.textContent = text; if (i === P.phases.length - 1) scene()?.seal(); });
      tl.to(prog, { v: (i + 1) / P.phases.length, duration: 0.95, ease: 'power1.inOut', onUpdate: () => setBar(prog.v) });
    });
  }

  function reset() {
    tl?.kill();
    placed.clear();
    state = 'idle';
    scene()?.reset();
    render();
    items[0].focus({ preventScroll: true });
  }

  // ---------- tap / keyboard ----------
  let suppressClick = false;
  items.forEach((b) =>
    b.addEventListener('click', () => {
      if (suppressClick) { suppressClick = false; return; }
      toggle(b.dataset.item);
    })
  );
  buildBtn.addEventListener('click', build);
  resetBtn.addEventListener('click', reset);

  // ---------- drag (mouse and pen; touch uses tap so the page can still scroll) ----------
  let drag = null;
  const overBox = (x, y) => Boolean(document.elementFromPoint(x, y)?.closest('[data-drop]')) || getWorld()?.hitTest?.(x, y) === 'pkg';
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.ghost && Math.hypot(dx, dy) > 6) {
      drag.ghost = document.createElement('div');
      drag.ghost.className = 'pk-ghost';
      drag.ghost.textContent = drag.label;
      document.body.append(drag.ghost);
      drag.btn.classList.add('is-dragging');
    }
    if (drag.ghost) {
      drag.ghost.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
      drop.classList.toggle('is-over', overBox(e.clientX, e.clientY));
    }
  };
  const onUp = (e) => {
    if (!drag) return;
    const d = drag;
    drag = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    drop.classList.remove('is-over');
    d.btn.classList.remove('is-dragging');
    if (!d.ghost) return; // a plain click: handled by the click listener
    d.ghost.remove();
    suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    if (e.type === 'pointerup' && overBox(e.clientX, e.clientY)) toggle(d.btn.dataset.item, true);
  };
  items.forEach((b) =>
    b.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch' || e.button !== 0 || state !== 'idle') return;
      drag = { btn: b, x: e.clientX, y: e.clientY, ghost: null, label: $('strong', b).textContent };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    })
  );

  render();
  return {
    /** Re-applies the current state to the 3D box (after the scene loads or is rebuilt). */
    sync: render,
    focus() {
      el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      (items.find((b) => !b.disabled) || resetBtn).focus({ preventScroll: true });
    },
  };
}
