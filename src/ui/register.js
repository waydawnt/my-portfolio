// "Registered to you": an optional name asked once after the permission prompt, shown at
// Finish and on a licence-style PNG card drawn with canvas when asked for.
// The name lives in this tab only (sessionStorage, or memory if that is unavailable).
// It is never sent anywhere and only ever rendered as text (textContent / canvas fillText).
import gsap from 'gsap';
import { session } from './session.js';
import { cleanName, licenceKey } from '../licence-key.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initRegister({ content, reduce, hideOverlay }) {
  const R = content.register;
  const year = new Date().getFullYear();
  const status = $('.lic-status');
  const form = $('.lic-form');
  const field = $('#lic-name');
  const downloadBtn = $('[data-lic-download]');
  let name = cleanName(session.get('regName'));

  const shown = () => name || R.guest;
  const key = () => licenceKey(shown(), year);

  function render() {
    $$('[data-reg-name]').forEach((el) => (el.textContent = shown()));
    $$('[data-reg-key]').forEach((el) => (el.textContent = key()));
  }

  function set(raw) {
    name = cleanName(raw);
    session.set('regName', name);
    render();
    return shown();
  }

  // ---------- the PNG card ----------
  function draw() {
    const W = 1200, H = 675;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext('2d');
    const sans = '"Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
    const mono = 'Consolas, "Cascadia Mono", Menlo, monospace';

    const bg = c.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#070b1c');
    bg.addColorStop(1, '#1b2350');
    c.fillStyle = bg;
    c.fillRect(0, 0, W, H);
    // lantern glows
    for (const [x, y, r, a] of [[1010, 150, 190, 0.5], [860, 420, 110, 0.3], [1120, 520, 140, 0.34], [640, 110, 70, 0.22]]) {
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255, 190, 110, ${a})`);
      g.addColorStop(0.25, `rgba(255, 150, 60, ${a * 0.5})`);
      g.addColorStop(1, 'rgba(255, 150, 60, 0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.strokeStyle = '#ffb454';
    c.lineWidth = 4;
    c.strokeRect(26, 26, W - 52, H - 52);
    c.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    c.lineWidth = 1;
    c.strokeRect(40, 40, W - 80, H - 80);

    c.textBaseline = 'alphabetic';
    // header
    const ig = c.createRadialGradient(98, 100, 2, 98, 104, 24);
    ig.addColorStop(0, '#ffe1a6');
    ig.addColorStop(0.45, '#ff9d3c');
    ig.addColorStop(1, '#c2571f');
    c.fillStyle = ig;
    c.beginPath();
    c.arc(98, 104, 22, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#f1f3ff';
    c.font = `600 36px ${sans}`;
    c.fillText(content.ui.appTitle, 138, 117);
    c.textAlign = 'right';
    c.fillStyle = '#ffc978';
    c.font = `600 22px ${sans}`;
    c.fillText(R.cardHeading.toUpperCase(), W - 80, 113);
    c.textAlign = 'left';

    // name, shrunk to fit
    c.fillStyle = '#c2c9e8';
    c.font = `400 28px ${sans}`;
    c.fillText(R.registeredTo, 80, 250);
    c.fillStyle = '#ffffff';
    let size = 92;
    do {
      c.font = `700 ${size}px ${sans}`;
      size -= 4;
    } while (c.measureText(shown()).width > W - 160 && size > 22);
    c.fillText(shown(), 80, 345, W - 160);

    // key
    c.fillStyle = '#c2c9e8';
    c.font = `400 28px ${sans}`;
    c.fillText(R.keyLabel, 80, 445);
    c.fillStyle = '#ffc978';
    c.font = `700 46px ${mono}`;
    c.fillText(key(), 80, 505, W - 160);

    // footer
    c.fillStyle = '#f1f3ff';
    c.font = `600 30px ${sans}`;
    c.fillText(R.site, 80, 600);
    c.textAlign = 'right';
    c.fillStyle = '#c2c9e8';
    c.font = `400 22px ${sans}`;
    c.fillText(`${R.cardFooter} · ${year}`, W - 80, 598);
    return canvas;
  }

  function download() {
    const fail = () => { status.textContent = R.downloadFailed; };
    try {
      const canvas = draw();
      const save = (url, revoke) => {
        const a = document.createElement('a');
        a.href = url;
        a.download = R.fileName;
        document.body.append(a);
        a.click();
        a.remove();
        if (revoke) setTimeout(() => URL.revokeObjectURL(url), 4000);
        status.textContent = R.downloaded;
      };
      if (canvas.toBlob) canvas.toBlob((blob) => (blob ? save(URL.createObjectURL(blob), true) : fail()), 'image/png');
      else save(canvas.toDataURL('image/png'), false);
    } catch {
      fail();
    }
  }

  // ---------- Finish page controls (also the way in for Classic view and skipped intros) ----------
  if (form) {
    form.hidden = false;
    field.value = name;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      status.textContent = R.updated.replace('{name}', set(field.value));
      field.value = name;
    });
  }
  if (downloadBtn) {
    downloadBtn.hidden = false;
    downloadBtn.addEventListener('click', download);
  }
  render();

  // ---------- the prompt after the permission dialog ----------
  /** Resolves once the visitor registers or skips (Skip and Escape both mean "Guest"). */
  function prompt() {
    const el = $('#register');
    const box = $('.uac-box', el);
    const dlgForm = $('form', el);
    const input = $('#reg-name', el);
    const skip = $('[data-reg-skip]', el);
    const focusables = [input, $('[type="submit"]', el), skip];
    el.hidden = false;
    input.value = name;
    if (!reduce) gsap.from(box, { y: 24, scale: 0.94, opacity: 0, duration: 0.4, ease: 'back.out(1.6)' });
    // on touch screens, focusing the field would throw the keyboard over the question
    (matchMedia('(pointer: coarse)').matches ? box : input).focus({ preventScroll: true });
    return new Promise((resolve) => {
      let closed = false;
      const finish = async (value) => {
        if (closed) return;
        closed = true;
        set(value);
        if (field) field.value = name;
        document.removeEventListener('keydown', onKey);
        input.blur();
        await hideOverlay(el);
        resolve();
      };
      const onKey = (e) => {
        if (e.key === 'Escape') finish('');
        if (e.key === 'Tab') {
          // modal: Tab cycles inside, Escape or Skip leaves
          e.preventDefault();
          const i = focusables.indexOf(document.activeElement);
          const next = i === -1 ? (e.shiftKey ? focusables.length - 1 : 0) : (i + (e.shiftKey ? focusables.length - 1 : 1)) % focusables.length;
          focusables[next].focus();
        }
      };
      document.addEventListener('keydown', onKey);
      dlgForm.addEventListener('submit', (e) => { e.preventDefault(); finish(input.value); }, { once: true });
      skip.addEventListener('click', () => finish(''), { once: true });
    });
  }

  return { prompt, set, name: shown };
}
