// Install paths: Typical / Custom / Minimal at "Choose Components".
// The chosen path reorders and emphasises content in the later steps. Session only.
import { session } from './session.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/** Moves the children of `parent` matching `selector` into the order given by `ids` (others keep their place after). */
function reorder(parent, selector, attr, ids) {
  if (!parent) return;
  const items = $$(selector, parent).filter((el) => el.parentElement === parent);
  const rank = (el) => {
    const i = ids.indexOf(el.getAttribute(attr));
    return i === -1 ? ids.length + items.indexOf(el) : i;
  };
  const sorted = [...items].sort((a, b) => rank(a) - rank(b));
  if (sorted.every((el, i) => el === items[i])) return;
  const active = document.activeElement;
  for (const el of sorted) parent.appendChild(el);
  if (active && parent.contains(active)) active.focus({ preventScroll: true });
}

export function initPaths({ content, onSelection }) {
  const cfg = content.steps.components.install;
  const root = document.documentElement;
  const modeInputs = $$('input[name="install-mode"]');
  const reasonBox = $('.install-reason');
  const reasonInputs = $$('input[name="install-reason"]');
  const summary = $('.install-summary');
  const chip = $('#tb-path');
  if (!modeInputs.length) return { current: () => 'typical' };

  const defaults = {
    groups: content.steps.components.groups.map((g) => g.id),
    programs: content.steps.programs.items.map((p) => p.id),
    contacts: content.steps.finish.contacts.map((c) => c.link),
  };
  let current = 'typical';

  function apply(pathId, { select = true } = {}) {
    const path = cfg.paths[pathId];
    if (!path) return;
    current = pathId;
    root.dataset.path = pathId;
    root.classList.toggle('install-minimal', pathId === 'minimal');

    // order
    reorder($('.groups'), '.group', 'data-group', path.groups || defaults.groups);
    reorder($('.programs'), '.program', 'data-id', path.programs || defaults.programs);
    reorder($('.contacts'), '.contacts > div', 'data-key', path.contacts || defaults.contacts);
    const body = $('#installing .page-body');
    const pipeline = $('.pipeline', body);
    const install = $('.install', body);
    if (pipeline && install) {
      if (path.pipelineFirst) body.insertBefore(pipeline, install);
      else body.insertBefore(install, pipeline);
      pipeline.classList.toggle('is-featured', Boolean(path.pipelineFirst));
    }

    // emphasis
    const feat = (els, key, list = []) => els.forEach((el) => el.classList.toggle('is-featured', list.includes(el.getAttribute(key))));
    feat($$('.group'), 'data-group', path.featureGroups);
    feat($$('.program'), 'data-id', path.featurePrograms);
    feat($$('.stage'), 'data-stage', (path.featureStages || []).map(String));

    // component ticks
    if (select && path.select) {
      $$('.group').forEach((fs) => {
        const on = path.select === 'all' || path.select.includes(fs.dataset.group);
        $$('input', fs).forEach((b) => (b.checked = on));
      });
      onSelection?.();
    }

    summary.textContent = path.summary;
    if (chip) chip.textContent = `${cfg.chip} ${path.label}`;
  }

  function save() {
    const mode = modeInputs.find((i) => i.checked)?.value || 'typical';
    const reason = reasonInputs.find((i) => i.checked)?.value || '';
    session.set('installPath', JSON.stringify({ mode, reason }));
  }

  function onMode(select = true) {
    const mode = modeInputs.find((i) => i.checked)?.value || 'typical';
    reasonBox.hidden = mode !== 'custom';
    if (mode === 'custom') {
      const reason = reasonInputs.find((i) => i.checked)?.value;
      if (reason) apply(reason, { select });
      else summary.textContent = cfg.customPrompt;
    } else {
      apply(mode, { select });
    }
  }

  modeInputs.forEach((i) => i.addEventListener('change', () => { onMode(); save(); }));
  reasonInputs.forEach((i) => i.addEventListener('change', () => { onMode(); save(); }));
  $$('[data-show-all]').forEach((b) =>
    b.addEventListener('click', () => {
      // leave Minimal without touching the ticked components
      const typical = modeInputs.find((i) => i.value === 'typical');
      typical.checked = true;
      onMode(false);
      save();
      b.closest('.page')?.querySelector('h2')?.focus({ preventScroll: true });
    })
  );

  // restore this session's choice (nothing is ticked on a first visit)
  let saved = null;
  try { saved = JSON.parse(session.get('installPath') || 'null'); } catch { saved = null; }
  if (saved && cfg.paths[saved.mode === 'custom' ? saved.reason || 'typical' : saved.mode]) {
    modeInputs.forEach((i) => (i.checked = i.value === saved.mode));
    reasonInputs.forEach((i) => (i.checked = i.value === saved.reason));
    onMode(true);
  } else {
    apply('typical', { select: false });
  }

  return { current: () => current };
}
