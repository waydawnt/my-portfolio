// UI logic. The page is fully readable without this file (Classic view is the base);
// this adds the installer wizard behaviour and lazy-loads the 3D scene.
import gsap from 'gsap';
import content from './content.json';
import { initPaths } from './ui/paths.js';

const doc = document.documentElement;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

const ids = content.order;
const steps = $$('.step');
const N = steps.length;
const toggle = $('#view-toggle');
const tbStep = $('#tb-step');
const navBack = $('#nav-back');
const navNext = $('#nav-next');
const dots = $$('[data-dot]');

let world = null;
let is3D = false;
let current = 0;

// ---------------------------------------------------------------- device tier
function isLowTier() {
  const n = navigator;
  const small = window.innerWidth < 761;
  const weak = (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || (n.deviceMemory && n.deviceMemory <= 4);
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(n.userAgent) || (n.maxTouchPoints > 1 && matchMedia('(pointer: coarse)').matches);
  return Boolean(small || weak || mobile || n.connection?.saveData || params.has('low'));
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- components step
const groups = $$('.group');
const countEl = $('.comp-count');
const selectAllBtn = $('[data-select-all]');

function syncGroup(fs, pulse = false) {
  const boxes = $$('input', fs);
  const level = boxes.filter((b) => b.checked).length / boxes.length;
  $('.lamp', fs).style.setProperty('--lvl', level.toFixed(3));
  world?.api('components').setGroup?.(fs.dataset.group, level, pulse);
}
function syncCount() {
  const all = $$('.group input');
  const n = all.filter((b) => b.checked).length;
  countEl.textContent = countEl.dataset.template.replace('{n}', n).replace('{total}', all.length);
  const full = n === all.length;
  selectAllBtn.textContent = full ? selectAllBtn.dataset.labelNone : selectAllBtn.dataset.labelAll;
  selectAllBtn.dataset.full = full ? '1' : '';
}
groups.forEach((fs) =>
  fs.addEventListener('change', () => {
    syncGroup(fs, true);
    syncCount();
  })
);
selectAllBtn.addEventListener('click', () => {
  const check = !selectAllBtn.dataset.full;
  $$('.group input').forEach((b) => (b.checked = check));
  groups.forEach((fs, i) => setTimeout(() => syncGroup(fs, check), reduce ? 0 : i * 90));
  syncCount();
});

// ---------------------------------------------------------------- installing step
const install = (() => {
  const el = $('.install');
  const stages = $$('.stage', el);
  const fill = $('.bar-fill', el);
  const bar = $('.bar', el);
  const text = $('.status-text', el);
  const pct = $('.status-pct', el);
  const titles = stages.map((s) => $('h3', s).textContent);
  const prog = { v: 1 };
  let played = false;

  function render(v) {
    fill.style.transform = `scaleX(${v})`;
    const p = Math.round(v * 100);
    pct.textContent = `${p}%`;
    bar.setAttribute('aria-valuenow', p);
    const idx = Math.min(Math.floor(v * stages.length), stages.length - 1);
    stages.forEach((s, i) => {
      const done = v >= 1 || i < idx;
      const active = v > 0 && v < 1 && i === idx;
      s.classList.toggle('is-done', done);
      s.classList.toggle('is-active', active);
      s.classList.toggle('is-pending', !done && !active);
    });
    text.textContent = v >= 1 ? el.dataset.statusDone : v <= 0 ? el.dataset.statusIdle : `${el.dataset.statusPrefix} ${titles[idx]}…`;
  }

  const tl = gsap.timeline({ paused: true });
  stages.forEach((_, i) => {
    tl.to(prog, { v: (i + 1) / stages.length, duration: 2.4, ease: 'power1.inOut', onUpdate: () => render(prog.v) }, i === 0 ? 0.3 : '>0.35');
  });

  $('[data-replay]', el).addEventListener('click', () => {
    if (reduce) return render(1);
    prog.v = 0;
    tl.restart();
  });

  return {
    /** Wizard mode: start empty, then play once when the step is first reached. */
    arm() {
      if (reduce || played) return;
      prog.v = 0;
      render(0);
    },
    play() {
      if (reduce || played) return;
      played = true;
      tl.restart();
    },
    /** Classic view: everything shown as installed. */
    complete() {
      tl.pause();
      prog.v = 1;
      render(1);
      played = true;
    },
  };
})();

// ---------------------------------------------------------------- programs + finish hooks
$$('.program').forEach((li) => {
  const on = () => { li.classList.add('is-hot'); world?.api('programs').highlight?.(li.dataset.obj); };
  const off = () => { li.classList.remove('is-hot'); world?.api('programs').highlight?.(null); };
  li.addEventListener('pointerenter', on);
  li.addEventListener('pointerleave', off);
  li.addEventListener('focusin', on);
  li.addEventListener('focusout', off);
});

const launch = $('#launch');
['pointerenter', 'focus'].forEach((e) => launch.addEventListener(e, () => world?.api('finish').setDoor?.(true)));
['pointerleave', 'blur'].forEach((e) => launch.addEventListener(e, () => world?.api('finish').setDoor?.(false)));
// The link itself opens globalwishes.in in a new tab; the scene also lets a lantern go.
$('#release').addEventListener('click', () => world?.api('finish').release?.(1));

// ---------------------------------------------------------------- step tracking
let tops = [];
let heights = [];
function measure() {
  tops = steps.map((s) => s.offsetTop);
  heights = steps.map((s) => s.offsetHeight);
}

/** Fractional step from the scroll position. The camera rests while a tall page is being read. */
function progress() {
  const y = window.scrollY;
  const vh = window.innerHeight;
  let i = 0;
  while (i < N - 1 && y >= tops[i + 1]) i++;
  if (i >= N - 1) return N - 1;
  const hold = Math.max(0, heights[i] - vh);
  const start = tops[i] + hold;
  const f = (y - start) / Math.max(1, tops[i + 1] - start);
  return i + Math.min(1, Math.max(0, f));
}

let finishCelebrated = false;
function setStep(i) {
  current = i;
  const s = content.steps[ids[i]];
  tbStep.textContent = `${content.ui.step} ${i + 1} ${content.ui.of} ${N}: ${s.nav}`;
  dots.forEach((d, k) => {
    if (k === i) d.setAttribute('aria-current', 'step');
    else d.removeAttribute('aria-current');
    d.classList.toggle('is-past', k < i);
  });
  navBack.disabled = i === 0;
  navNext.disabled = i === N - 1;
  navNext.textContent = s.primary || content.ui.next;

  if (!world) return;
  world.api('welcome').setOpen?.(i > 0);
  if (ids[i] === 'components') groups.forEach((fs) => syncGroup(fs));
  if (ids[i] === 'installing') install.play();
  const fin = world.api('finish');
  fin.setFlag?.(ids[i] === 'finish');
  if (ids[i] === 'finish' && !finishCelebrated && fin.release) {
    finishCelebrated = true;
    fin.release(4);
  }
}

let ticking = false;
function onScroll() {
  if (!is3D || ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    if (!is3D) return;
    const p = progress();
    world?.setProgress(p);
    const i = Math.round(p);
    if (i !== current) setStep(i);
  });
}

function goTo(i, focus = true) {
  i = Math.min(N - 1, Math.max(0, i));
  window.scrollTo({ top: tops[i], behavior: reduce ? 'auto' : 'smooth' });
  if (focus) $(`#${ids[i]}-title`)?.focus({ preventScroll: true });
}

document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (go) return goTo(current + (go.dataset.go === 'next' ? 1 : -1));
  const dot = e.target.closest('[data-dot]');
  if (dot && is3D) {
    e.preventDefault();
    goTo(Number(dot.dataset.dot));
  }
});

// ---------------------------------------------------------------- overlays
const loader = $('#loader');
const loaderFill = $('#loader-fill');
const loaderPct = $('#loader-pct');
function setLoader(v) {
  gsap.to(loaderFill, { scaleX: v, duration: reduce ? 0 : 0.35, ease: 'power1.out', overwrite: true });
  loaderPct.textContent = `${Math.round(v * 100)}%`;
}
function hideOverlay(el) {
  return new Promise((res) => {
    if (reduce) { el.hidden = true; return res(); }
    gsap.to(el, { autoAlpha: 0, duration: 0.45, onComplete: () => { el.hidden = true; gsap.set(el, { clearProps: 'all' }); res(); } });
  });
}

/** The fake UAC prompt. Yes, No and Escape all start the site. */
function uacPrompt() {
  const uac = $('#uac');
  const box = $('.uac-box', uac);
  const btns = $$('[data-uac]', uac);
  const reply = $('.uac-reply', uac);
  uac.hidden = false;
  if (!reduce) gsap.from(box, { y: 24, scale: 0.94, autoAlpha: 0, duration: 0.45, ease: 'back.out(1.6)' });
  btns[0].focus();
  return new Promise((resolve) => {
    let closing = false;
    const close = (delay) => {
      if (closing) return;
      closing = true;
      setTimeout(async () => {
        uac.removeEventListener('keydown', onKey);
        await hideOverlay(uac);
        resolve();
      }, delay);
    };
    const answer = (yes) => {
      if (yes) return close(0);
      reply.textContent = reply.dataset.reply;
      btns.forEach((b) => (b.disabled = true));
      close(reduce ? 700 : 1100);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') answer(false);
      if (e.key === 'Tab') {
        // keep focus inside the dialog
        e.preventDefault();
        const i = btns.indexOf(document.activeElement);
        btns[(i + (e.shiftKey ? btns.length - 1 : 1)) % btns.length].focus();
      }
    };
    uac.addEventListener('keydown', onKey);
    btns.forEach((b) => b.addEventListener('click', () => answer(b.dataset.uac === 'yes'), { once: true }));
  });
}

// ---------------------------------------------------------------- view modes
function setToggleLabel() {
  toggle.textContent = is3D ? toggle.dataset.labelClassic : toggle.dataset.labelImmersive;
  toggle.setAttribute('aria-pressed', String(!is3D));
}

function enterClassic(remember = true) {
  const keep = current;
  is3D = false;
  doc.classList.remove('mode-3d', 'is-intro');
  world?.stop();
  loader.hidden = true;
  $('#uac').hidden = true;
  install.complete();
  tbStep.textContent = '';
  setToggleLabel();
  if (remember) store.set('view', 'classic');
  if (keep > 0) steps[keep].scrollIntoView();
}

async function enter3D({ intro = false, remember = true } = {}) {
  const keep = current;
  const low = isLowTier();
  is3D = true;
  doc.classList.add('mode-3d');
  doc.classList.toggle('tier-low', low);
  setToggleLabel();
  if (remember) store.set('view', '3d');

  if (!world) {
    doc.classList.add('is-intro');
    loader.hidden = false;
    setLoader(0.03);
    try {
      const { createWorld } = await import('./scene/world.js');
      world = await createWorld({
        canvas: $('#scene'),
        low,
        reduce,
        labels: { pipeline: content.steps.installing.pipeline.sceneLabels },
        onProgress: setLoader,
      });
    } catch (err) {
      console.warn('3D view unavailable, using Classic view.', err);
      world = null;
      toggle.hidden = true;
      enterClassic(false);
      return;
    }
    if (!is3D) return; // switched away while loading
    await new Promise((r) => setTimeout(r, reduce ? 0 : 350));
    world.start();
    await hideOverlay(loader);
  } else {
    world.resize();
    world.start();
  }

  measure();
  install.arm();
  if (keep > 0) window.scrollTo(0, tops[keep]);
  const p = progress();
  world.setProgress(p, true);
  setStep(Math.round(p));

  if (intro) await uacPrompt();
  doc.classList.remove('is-intro');
  if (intro && Math.round(p) === 0) {
    world.intro();
    if (!reduce) gsap.from('#welcome .page', { y: 30, autoAlpha: 0, duration: 0.9, delay: 0.5, ease: 'power3.out', clearProps: 'all' });
    $('#welcome-title').focus({ preventScroll: true });
  }
}

toggle.hidden = false;
toggle.addEventListener('click', () => (is3D ? enterClassic() : enter3D()));

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { if (is3D) { measure(); onScroll(); } });
if ('ResizeObserver' in window) new ResizeObserver(() => { if (is3D) { measure(); onScroll(); } }).observe($('#main'));

syncCount();
initPaths({ content, onSelection: () => { groups.forEach((fs) => syncGroup(fs)); syncCount(); } });
const wantClassic = params.has('classic') || (store.get('view') === 'classic' && !params.has('3d'));
if (wantClassic || !hasWebGL()) {
  if (!hasWebGL()) toggle.hidden = true;
  enterClassic(false);
} else {
  // The prompt is a one-time gag: once per browser session, never on later page loads.
  let seen = false;
  try { seen = sessionStorage.getItem('introSeen') === '1'; sessionStorage.setItem('introSeen', '1'); } catch { /* private mode */ }
  enter3D({ intro: !params.has('nointro') && !seen, remember: false });
}
