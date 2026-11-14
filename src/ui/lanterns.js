// Hidden lanterns: one per scene, each holding a fact. Kept in memory only, so a new
// visit always starts at zero.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function initLanterns({ content, links, sceneUI }) {
  const L = content.lanterns;
  const total = L.facts.length;
  const found = new Set();
  const hud = $('#lantern-hud');
  const hudText = $('.hud-text', hud);
  const status = $('#lantern-status');
  let world = null;

  const fill = (tpl, n) => tpl.replace('{n}', n).replace('{total}', total);

  function render() {
    hudText.textContent = `${L.hudLabel} ${fill(L.hud, found.size)}`;
    hud.classList.toggle('is-complete', found.size === total);
    $$('.so-btn[data-hotspot^="lantern-"]').forEach((b) => {
      const i = Number(b.dataset.hotspot.split('-')[1]);
      b.textContent = found.has(i) ? L.collected : L.collect;
    });
  }

  function listCard(opts) {
    const lines = L.facts.map((f, i) => `${i + 1}. ${found.has(i) ? f : L.notFound}`);
    const done = found.size === total;
    sceneUI.show(
      {
        kicker: `${L.hudLabel} ${fill(L.hud, found.size)}`,
        title: done ? L.allTitle : L.listTitle,
        text: (done ? `${L.secret}\n\n` : `${L.listHint}\n\n`) + lines.join('\n'),
        link: done ? { label: L.secretLink, href: links.email } : null,
      },
      opts
    );
  }

  function collect(id, opts) {
    const i = Number(id.split('-')[1]);
    const isNew = !found.has(i);
    if (isNew) {
      found.add(i);
      world?.collectLantern?.(i);
      render();
      status.textContent = fill(L.announce, found.size);
    }
    const done = found.size === total;
    sceneUI.show(
      {
        kicker: fill(L.cardKicker, found.size),
        title: done && isNew ? L.allTitle : L.cardTitle.replace('{n}', i + 1),
        text: done && isNew ? `${L.facts[i]}\n\n${L.secret}` : L.facts[i],
        link: done && isNew ? { label: L.secretLink, href: links.email } : null,
      },
      { ...opts, id }
    );
  }

  sceneUI.handle('lantern-*', collect);
  hud.addEventListener('click', () => listCard({ from: hud, focus: true, anchor: { x: hud.getBoundingClientRect().left, y: hud.getBoundingClientRect().bottom + 120 } }));
  render();

  return {
    attach(w) {
      world = w;
      found.forEach((i) => w.collectLantern?.(i));
    },
    count: () => found.size,
  };
}
