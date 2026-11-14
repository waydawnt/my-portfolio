// Info card for objects in the 3D scene, plus the keyboard route to the same objects
// (the "Inspect: ..." buttons that appear when you Tab through each page).
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initSceneUI({ content, links }) {
  const card = $('#obj-card');
  const els = {
    kicker: $('.card-kicker', card),
    title: $('.card-title', card),
    text: $('.card-text', card),
    actions: $('.card-actions', card),
  };
  const objects = new Map(content.scene.objects.map((o) => [o.id, o]));
  const programs = new Map(content.steps.programs.items.map((p) => [p.id, p]));
  const handlers = new Map(); // id -> custom click handler (terminal, packager, lanterns)
  let world = null;
  let opener = null;
  let openId = null;

  /** Text + link for an object, resolved from content.json. */
  function describe(id) {
    const o = objects.get(id);
    if (!o) return null;
    if (o.program) {
      const p = programs.get(o.program);
      const l = p.links[0];
      return { kicker: `${p.type} · ${content.steps.programs.builtWith} ${p.tech}`, title: p.title, text: p.text, link: l && { label: l.label, href: links[l.link] } };
    }
    return { kicker: content.scene.cardKicker, title: o.title, text: o.text, link: o.link && links[o.link] ? { label: o.linkLabel, href: links[o.link] } : null };
  }

  function place(anchor) {
    const w = window.innerWidth, h = window.innerHeight;
    if (w < 761 || !anchor) {
      card.style.left = card.style.top = '';
      card.classList.add('card-sheet');
      return;
    }
    card.classList.remove('card-sheet');
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const left = anchor.x + 28 + cw > w - 12 ? anchor.x - 28 - cw : anchor.x + 28;
    card.style.left = `${Math.max(12, Math.min(left, w - cw - 12))}px`;
    card.style.top = `${Math.max(58, Math.min(anchor.y - ch / 2, h - ch - 76))}px`;
  }

  /**
   * Shows the card. data: { kicker, title, text, link?: {label, href}, buttons?: [{label, onClick}] }.
   * All strings are set with textContent.
   */
  function show(data, { anchor = null, from = null, id = null, focus = false } = {}) {
    opener = from;
    openId = id;
    els.kicker.textContent = data.kicker || '';
    els.title.textContent = data.title;
    els.text.textContent = data.text;
    els.actions.replaceChildren();
    if (data.link) {
      const a = document.createElement('a');
      a.className = 'link-btn';
      a.href = data.link.href;
      a.textContent = data.link.label;
      if (/^https?:/.test(data.link.href)) {
        a.target = '_blank';
        a.rel = 'noopener';
        a.setAttribute('aria-label', `${data.link.label} (${content.ui.newTab})`);
      }
      els.actions.append(a);
    }
    for (const b of data.buttons || []) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-small';
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      els.actions.append(btn);
    }
    card.hidden = false;
    place(anchor);
    if (focus) card.focus({ preventScroll: true });
  }

  function close(restoreFocus = false) {
    if (card.hidden) return;
    card.hidden = true;
    const o = opener;
    opener = null;
    openId = null;
    if (restoreFocus && o && o.isConnected) o.focus({ preventScroll: true });
  }

  function select(id, { anchor = null, from = null, focus = false } = {}) {
    world?.flash?.(id);
    const custom = handlers.get(id) || handlers.get(id.replace(/-\d+$/, '-*'));
    if (custom) return custom(id, { anchor: anchor || world?.screenOf?.(id), from, focus });
    const data = describe(id);
    if (!data) return;
    if (openId === id && !focus) return close();
    show(data, { anchor: anchor || world?.screenOf?.(id), from, id, focus });
  }

  $('.card-close', card).addEventListener('click', () => close(true));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !card.hidden) close(true);
  });

  // keyboard route: one button per object, inside the page it belongs to
  $$('.so-btn').forEach((btn) => {
    const id = btn.dataset.hotspot;
    btn.addEventListener('focus', () => world?.setFocused?.(id));
    btn.addEventListener('blur', () => world?.setFocused?.(null));
    btn.addEventListener('click', () => select(id, { from: btn, focus: true }));
  });

  return {
    show,
    close,
    select,
    describe,
    /** Lets another feature take over what happens when an object is chosen. */
    handle: (id, fn) => handlers.set(id, fn),
    attach(w) {
      world = w;
      w.on('select', (id, pos) => select(id, { anchor: pos }));
      w.on('miss', () => close());
    },
  };
}
