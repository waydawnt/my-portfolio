// A pretend PowerShell terminal opened from the retro monitor.
// Commands come from a fixed lookup table. Typed text is only ever compared against that
// table and echoed with textContent: nothing is evaluated and nothing is parsed as HTML.
const $ = (s, r = document) => r.querySelector(s);

export function initTerminal({ content, links, onClose }) {
  const T = content.terminal;
  const S = content.steps;
  const el = $('#terminal');
  const log = $('.term-log', el);
  const form = $('.term-form', el);
  const input = $('#term-input', el);
  const sugg = $('.term-sugg', el);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const history = [];
  let hIndex = 0;
  let opener = null;

  // ---------- output helpers (text nodes only) ----------
  function line(text, { cls = '', href = null, label = null } = {}) {
    const row = document.createElement('div');
    row.className = `term-line ${cls}`.trim();
    row.textContent = text;
    if (href) {
      if (text) row.append(' ');
      const a = document.createElement('a');
      a.href = href;
      a.textContent = label || href;
      if (/^https?:/.test(href)) {
        a.target = '_blank';
        a.rel = 'noopener';
      }
      row.append(a);
    }
    log.append(row);
    while (log.childElementCount > 220) log.firstElementChild.remove();
  }
  const blank = () => line(' ');
  const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));

  // ---------- the commands ----------
  const commands = new Map([
    ['get-help', () => {
      line(T.helpIntro);
      T.commands.forEach((c) => line(`  ${pad(c.name, 30)}${c.about}`));
    }],
    ['get-skills', () => {
      S.components.groups.forEach((g) => line(`${pad(g.title, 14)}: ${g.skills.join(', ')}`));
    }],
    ['get-projects', () => {
      S.programs.items.forEach((p) => {
        line(p.title, { cls: 'term-strong' });
        line(`  ${p.type} · ${p.tech}`);
        const l = p.links[0];
        if (l && links[l.link]) line('  ', { href: links[l.link], label: l.label });
      });
    }],
    ['get-experience', () => {
      S.installing.stages.forEach((st) => {
        line(st.title, { cls: 'term-strong' });
        line(`  ${st.meta}`);
      });
      line(S.installing.earlier, { cls: 'term-dim' });
    }],
    ['get-contact', () => {
      S.finish.contacts.forEach((k) => {
        if (links[k.link]) line(`${pad(k.label, 11)}:`, { href: links[k.link], label: k.text });
      });
    }],
    ['start-process globalwishes', () => {
      line(T.starting);
      line('', { href: links.globalWishes, label: T.startLink });
      // runs inside the click / Enter handler, so browsers treat it as a user-opened tab
      try { window.open(links.globalWishes, '_blank', 'noopener'); } catch { /* the link above still works */ }
    }],
    ['clear-host', () => log.replaceChildren()],
  ]);
  const aliases = new Map([['help', 'get-help'], ['cls', 'clear-host'], ['clear', 'clear-host'], ['start-process globalwishes.in', 'start-process globalwishes']]);

  function run(raw) {
    const typed = String(raw).slice(0, 80).trim();
    line(`${T.prompt} ${typed}`, { cls: 'term-cmd' });
    if (!typed) return;
    const key = typed.toLowerCase().replace(/\s+/g, ' ');
    if (key === 'exit') return close(true);
    const fn = commands.get(aliases.get(key) || key);
    if (fn) fn();
    else if (key.startsWith('start-process')) line(T.startUsage, { cls: 'term-error' });
    else T.unknown.forEach((u) => line(u.split('{cmd}').join(typed.split(' ')[0]), { cls: 'term-error' }));
    blank();
    log.scrollTop = log.scrollHeight;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = input.value;
    if (v.trim()) { history.push(v); hIndex = history.length; }
    input.value = '';
    run(v);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    if (!history.length) return;
    e.preventDefault();
    hIndex = Math.max(0, Math.min(history.length, hIndex + (e.key === 'ArrowUp' ? -1 : 1)));
    input.value = history[hIndex] || '';
  });
  sugg.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cmd]');
    if (b) run(b.dataset.cmd);
  });
  $('.term-close', el).addEventListener('click', () => close(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !el.hidden) close(true);
  });

  function open(from = null) {
    opener = from;
    if (!el.hidden) return;
    el.hidden = false;
    if (!log.childElementCount) {
      T.banner.forEach((b) => line(b, { cls: 'term-dim' }));
      blank();
    }
    // on touch screens, focusing the field would pop the keyboard over the scene
    (coarse ? $('[data-cmd]', sugg) : input).focus({ preventScroll: true });
  }

  function close(restoreFocus = false) {
    if (el.hidden) return;
    el.hidden = true;
    const o = opener;
    opener = null;
    if (restoreFocus) onClose?.(o);
  }

  return { open, close, isOpen: () => !el.hidden };
}
