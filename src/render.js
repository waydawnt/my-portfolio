// Pure string templates shared by the Vite build (static HTML) — no DOM access here.
// All text comes from content.json, all URLs from links.json.

import { licenceKey } from './licence-key.js';

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isExternal = (url) => /^https?:/.test(url);

function anchor(c, links, key, label, cls = '', extra = '') {
  const url = links[key];
  if (!url) {
    return `<span class="todo-link ${cls}">${esc(label)} <em>(${esc(c.ui.todoLink)})</em></span>`;
  }
  const ext = isExternal(url)
    ? ` target="_blank" rel="noopener" aria-label="${esc(label)} (${esc(c.ui.newTab)})"`
    : '';
  return `<a class="${cls}" href="${esc(url)}"${ext}${extra}>${esc(label)}</a>`;
}

const ICONS = {
  cube: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 5 41 14v20L24 43 7 34V14z" fill="#39476f"/><path d="M24 5 41 14 24 23 7 14z" fill="#8fb7ff"/><path d="M24 23v20L7 34V14z" fill="#5e78b8"/></svg>`,
};

function programIcon(item) {
  if (item.icon === 'cube') return `<span class="p-icon">${ICONS.cube}</span>`;
  return `<span class="p-icon"><img src="/img/icon-${esc(item.icon)}.webp" alt="" width="64" height="64" loading="lazy" decoding="async" /></span>`;
}

export function renderHead(c, links) {
  const m = c.meta;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: c.person.name,
    url: links.site,
    email: links.email,
    jobTitle: 'Application Packaging Engineer',
    address: { '@type': 'PostalAddress', addressLocality: 'Pune', addressCountry: 'IN' },
    sameAs: [links.linkedin, links.github, links.artstation].filter(Boolean),
  };
  return `<title>${esc(m.title)}</title>
    <meta name="description" content="${esc(m.description)}" />
    <meta name="author" content="${esc(c.person.name)}" />
    <meta name="theme-color" content="${esc(m.themeColor)}" />
    <meta name="color-scheme" content="dark" />
    <link rel="canonical" href="${esc(links.site)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="${esc(m.siteName)}" />
    <meta property="og:title" content="${esc(m.title)}" />
    <meta property="og:description" content="${esc(m.description)}" />
    <meta property="og:url" content="${esc(links.site)}" />
    <meta property="og:image" content="${esc(links.ogImage)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${esc(m.ogAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(m.title)}" />
    <meta name="twitter:description" content="${esc(m.description)}" />
    <meta name="twitter:image" content="${esc(links.ogImage)}" />
    <script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`;
}

export function renderApp(c, links) {
  const ids = c.order;
  const n = ids.length;
  const S = c.steps;
  const ui = c.ui;

  // Objects in the 3D scene: keyboard buttons in wizard mode, plain notes in Classic view.
  const programTitle = (pid) => S.programs.items.find((p) => p.id === pid).title;
  const sceneList = (id) => {
    const objs = c.scene.objects.filter((o) => o.step === id);
    const hasNotes = objs.some((o) => !o.program);
    const lantern = `<li class="so-ref"><button type="button" class="so-btn btn btn-small" data-hotspot="lantern-${ids.indexOf(id)}">${esc(c.lanterns.collect)}</button></li>`;
    return `<div class="scene-notes${hasNotes ? '' : ' sn-empty'}">
      <h3 class="sn-title">${esc(c.scene.notesTitle)}</h3>
      <ul class="scene-objects" aria-label="${esc(c.scene.notesTitle)}">${objs
        .map((o) => {
          const title = o.program ? programTitle(o.program) : o.title;
          const body = o.program
            ? ''
            : `<div class="so-body"><strong>${esc(title)}.</strong> ${esc(o.text)}${o.link ? ` ${anchor(c, links, o.link, o.linkLabel)}` : ''}</div>`;
          const label = o.button || `${c.scene.inspect} ${title}`;
          return `<li${o.program ? ' class="so-ref"' : ''}><button type="button" class="so-btn btn btn-small" data-hotspot="${esc(o.id)}">${esc(label)}</button>${body}</li>`;
        })
        .join('')}${lantern}</ul>
    </div>`;
  };

  const section = (id, body, actions, { h1 = false } = {}) => {
    const i = ids.indexOf(id);
    const s = S[id];
    const tag = h1 ? 'h1' : 'h2';
    const title = h1 ? c.person.name : s.title;
    return `
    <section class="step" id="${id}" data-step="${i}" aria-labelledby="${id}-title">
      <div class="page">
        <header class="page-head">
          <p class="kicker"><span class="kicker-step">${esc(ui.step)} ${i + 1} ${esc(ui.of)} ${n}</span> ${esc(h1 ? s.kicker : s.nav)}</p>
          <${tag} id="${id}-title" tabindex="-1">${esc(title)}${s.titleJa ? ` <span class="ja" lang="ja">${esc(s.titleJa)}</span>` : ''}</${tag}>
          ${s.lead ? `<p class="lead">${esc(s.lead)}</p>` : ''}
        </header>
        <div class="page-body">${body}${sceneList(id)}</div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      </div>
    </section>`;
  };

  const nextBtn = (label) =>
    `<button type="button" class="btn btn-primary" data-go="next">${esc(label)}</button>`;
  const backBtn = `<button type="button" class="btn" data-go="back">${esc(ui.back)}</button>`;
  // only shown on the Minimal install path
  const showAll = `<span class="minimal-note"><span>${esc(S.components.install.minimalNote)}</span> <button type="button" class="btn btn-small" data-show-all>${esc(S.components.install.showAll)}</button></span>`;

  // 1. Welcome
  const welcome = section(
    'welcome',
    `<p class="headline">${esc(c.person.headline)}</p>
     <p class="role">${esc(c.person.roleLine)}</p>
     <p>${esc(S.welcome.intro)}</p>
     <p class="scene-hint">${esc(ui.sceneHint)}</p>
     <dl class="facts">${S.welcome.facts
       .map((f) => `<div><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`)
       .join('')}</dl>`,
    nextBtn(S.welcome.primary),
    { h1: true }
  );

  // 2. License
  const license = section(
    'license',
    `<ol class="terms" tabindex="0" aria-label="${esc(S.license.title)}">${S.license.terms
      .map((t) => `<li><strong>${esc(t.title)}.</strong> ${esc(t.text)}</li>`)
      .join('')}</ol>
     <p class="term-open"><button type="button" class="btn btn-small" data-open-terminal><span class="term-glyph" aria-hidden="true">&gt;_</span> ${esc(c.terminal.open)}</button></p>`,
    backBtn + nextBtn(S.license.primary)
  );

  // 3. Components
  const total = S.components.groups.reduce((a, g) => a + g.skills.length, 0);
  const components = section(
    'components',
    `<fieldset class="install-type">
       <legend>${esc(S.components.install.legend)}</legend>
       <div class="seg">${S.components.install.modes
         .map((m, i) => `<label class="seg-opt"><input type="radio" name="install-mode" value="${esc(m.id)}"${i === 0 ? ' checked' : ''} /><span><strong>${esc(m.label)}</strong><small>${esc(m.hint)}</small></span></label>`)
         .join('')}</div>
     </fieldset>
     <fieldset class="install-reason" hidden>
       <legend>${esc(S.components.install.question)}</legend>
       <div class="seg seg-stack">${S.components.install.reasons
         .map((r) => `<label class="seg-opt"><input type="radio" name="install-reason" value="${esc(r.id)}" /><span><strong>${esc(r.label)}</strong></span></label>`)
         .join('')}</div>
     </fieldset>
     <p class="install-summary" role="status"></p>
     <div class="comp-tools">
       <button type="button" class="btn btn-small" data-select-all data-label-all="${esc(S.components.selectAll)}" data-label-none="${esc(S.components.clearAll)}">${esc(S.components.selectAll)}</button>
       <p class="comp-count" role="status" data-template="${esc(S.components.countTemplate)}" data-total="${total}">${esc(
         S.components.countTemplate.replace('{n}', '0').replace('{total}', total)
       )}</p>
     </div>
     <div class="groups">${S.components.groups
       .map(
         (g) => `<fieldset class="group" data-group="${esc(g.id)}" data-badge="${esc(S.components.install.badge)}">
           <legend><span class="lamp" aria-hidden="true"></span>${esc(g.title)} <span class="obj">${esc(g.object)}</span></legend>
           <div class="chips">${g.skills
             .map((sk) => `<label class="chk"><input type="checkbox" name="${esc(g.id)}" value="${esc(sk)}" /><span>${esc(sk)}</span></label>`)
             .join('')}</div>
         </fieldset>`
       )
       .join('')}</div>`,
    backBtn + nextBtn(S.components.primary)
  );

  // 4. Installing
  const I = S.installing;
  const installing = section(
    'installing',
    `${showAll}<div class="install" data-status-idle="${esc(I.statusIdle)}" data-status-prefix="${esc(I.statusPrefix)}" data-status-done="${esc(I.statusDone)}">
       <p class="install-status"><span class="status-text">${esc(I.statusDone)}</span> <span class="status-pct" aria-hidden="true">100%</span></p>
       <div class="bar" role="progressbar" aria-label="${esc(I.barLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span class="bar-fill"></span></div>
       <ol class="stages">${I.stages
         .map(
           (st, k) => `<li class="stage is-done" data-stage="${k}" data-badge="${esc(S.components.install.badge)}"><h3>${esc(st.title)}</h3><p class="meta">${esc(st.meta)}</p><p class="detail">${esc(st.text)}</p></li>`
         )
         .join('')}</ol>
       <p class="earlier detail">${esc(I.earlier)}</p>
       <button type="button" class="btn btn-small" data-replay>${esc(I.replay)}</button>
     </div>
     <div class="pipeline" data-badge="${esc(S.components.install.badge)}">
       <h3>${esc(I.pipeline.title)}</h3>
       <p class="meta">${esc(I.pipeline.tech)}</p>
       <ol class="pipe">${I.pipeline.steps
         .map((p) => `<li><strong>${esc(p.title)}</strong><span class="detail">${esc(p.text)}</span></li>`)
         .join('')}</ol>
     </div>
     <div class="packager" data-state="idle">
       <h3>${esc(I.packager.title)}</h3>
       <p class="meta">${esc(I.packager.hint)}</p>
       <div class="pk-row">
         <ul class="pk-items">${I.packager.items
           .map((it) => `<li><button type="button" class="pk-item" data-item="${esc(it.id)}" aria-pressed="false"><strong>${esc(it.title)}</strong><small>${esc(it.text)}</small></button></li>`)
           .join('')}</ul>
         <div class="pk-box" data-drop><span class="pk-lid" aria-hidden="true"></span><span class="pk-label">${esc(I.packager.boxLabel)}</span><span class="pk-count">0 / ${I.packager.items.length}</span></div>
       </div>
       <p class="pk-status" role="status"></p>
       <div class="bar pk-bar" role="progressbar" aria-label="${esc(I.packager.barLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span class="bar-fill"></span></div>
       <p class="pk-actions">
         <button type="button" class="btn btn-primary" data-build disabled>${esc(I.packager.build)}</button>
         <button type="button" class="btn" data-pk-reset hidden>${esc(I.packager.again)}</button>
       </p>
     </div>`,
    backBtn + nextBtn(I.primary)
  );

  // 5. Programs
  const P = S.programs;
  const programs = section(
    'programs',
    `${showAll}<ul class="programs">${P.items
      .map(
        (it) => `<li class="program" data-obj="${esc(it.object)}" data-id="${esc(it.id)}" data-badge="${esc(S.components.install.badge)}">
          ${programIcon(it)}
          <div class="p-body">
            <h3>${esc(it.title)}</h3>
            <p class="meta">${esc(it.type)} · ${esc(P.builtWith)} ${esc(it.tech)}</p>
            <p class="detail">${esc(it.text)}</p>
            <p class="p-links">${it.links.map((l) => anchor(c, links, l.link, l.label, 'link-btn')).join('')}</p>
          </div>
        </li>`
      )
      .join('')}</ul>`,
    backBtn + nextBtn(P.primary)
  );

  // 6. Japanese
  const J = S.japanese;
  const japanese = section(
    'japanese',
    `${showAll}<p class="detail">${esc(J.text)}</p>
     <h3>${esc(J.jlptTitle)}</h3>
     <ul class="jlpt">${J.levels
       .map(
         (l) => `<li class="jlpt-${esc(l.state)}"><span class="jlpt-level">${esc(l.level)}</span><span class="jlpt-status">${esc(l.status)}</span><span class="bar" aria-hidden="true"><span class="bar-fill"></span></span></li>`
       )
       .join('')}</ul>
     <h3>${esc(J.appsTitle)}</h3>
     <ul class="plain-links">${J.apps.map((a) => `<li>${anchor(c, links, a.link, a.label)}</li>`).join('')}</ul>`,
    backBtn + nextBtn(J.primary)
  );

  // 7. Finish
  const F = S.finish;
  const R = c.register;
  const [thanksA, thanksB = ''] = R.thanks.split('{name}');
  const finish = section(
    'finish',
    `<p class="thanks">${esc(thanksA)}<strong data-reg-name>${esc(R.guest)}</strong>${esc(thanksB)}</p>
     <p>${esc(F.text)}</p>
     <div class="finish-actions">
       <a class="btn btn-primary" id="launch" href="${esc(links.email)}">${esc(F.launch)} <span class="btn-sub">${esc(F.launchHint)}</span></a>
       ${links.resume ? `<a class="btn" href="${esc(links.resume)}" download="Vedant_Dalvi_Resume.pdf">${esc(F.resume)}</a>` : `<span class="todo-link">${esc(F.resume)} <em>(${esc(ui.todoLink)})</em></span>`}
       <a class="btn btn-lantern" id="release" href="${esc(links.globalWishes)}" target="_blank" rel="noopener" aria-label="${esc(F.lantern)} (${esc(ui.newTab)})">${esc(F.lantern)}</a>
     </div>
     <h3>${esc(F.contactTitle)}</h3>
     <dl class="contacts">${F.contacts
       .map((k) => `<div data-key="${esc(k.link)}"><dt>${esc(k.label)}</dt><dd>${anchor(c, links, k.link, k.text)}</dd></div>`)
       .join('')}</dl>
     <div class="licence">
       <h3>${esc(R.cardTitle)}</h3>
       <div class="lic-card">
         <p class="lic-brand"><span class="tb-icon" aria-hidden="true"></span>${esc(ui.appTitle)}<span class="lic-kind">${esc(R.cardHeading)}</span></p>
         <p class="lic-label">${esc(R.registeredTo)}</p>
         <p class="lic-name" data-reg-name>${esc(R.guest)}</p>
         <p class="lic-label">${esc(R.keyLabel)}</p>
         <p class="lic-key" data-reg-key>${esc(licenceKey(R.guest, new Date().getFullYear()))}</p>
         <p class="lic-site">${esc(R.site)}</p>
       </div>
       <p class="meta">${esc(R.disclaimer)}</p>
       <form class="lic-form" autocomplete="off" hidden>
         <label for="lic-name">${esc(R.changeLabel)}</label>
         <input id="lic-name" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="${esc(R.placeholder)}" />
         <button type="submit" class="btn btn-small">${esc(R.update)}</button>
       </form>
       <p class="lic-actions"><button type="button" class="btn" data-lic-download hidden>${esc(R.download)}</button></p>
       <p class="lic-status meta" role="status"></p>
     </div>`,
    backBtn
  );

  const U = c.uac;
  return `
  <a class="skip" href="#main">${esc(ui.skip)}</a>

  <div id="loader" class="overlay" hidden>
    <div class="loader-box" role="status" aria-live="polite">
      <p class="loader-title">${esc(ui.loading)}</p>
      <div class="bar"><span class="bar-fill" id="loader-fill"></span></div>
      <p class="loader-hint"><span>${esc(ui.loadingHint)}</span> <span id="loader-pct">0%</span></p>
    </div>
  </div>

  <div id="uac" class="overlay" hidden>
    <div class="uac-box" role="alertdialog" aria-modal="true" aria-labelledby="uac-q" aria-describedby="uac-d">
      <p class="uac-bar">${esc(U.window)}</p>
      <div class="uac-main">
        <p class="uac-q" id="uac-q">${esc(U.question)}</p>
        <div class="uac-app"><span class="uac-icon" aria-hidden="true"></span><strong>${esc(U.app)}</strong></div>
        <p id="uac-d" class="uac-d">${esc(U.publisher)}<br />${esc(U.origin)}<br />${esc(U.details)}</p>
        <p class="uac-note">${esc(U.note)}</p>
        <p class="uac-reply" role="status" data-reply="${esc(U.noReply)}"></p>
      </div>
      <div class="uac-actions">
        <button type="button" class="btn btn-primary" data-uac="yes">${esc(U.yes)}</button>
        <button type="button" class="btn" data-uac="no">${esc(U.no)}</button>
      </div>
    </div>
  </div>

  <div id="register" class="overlay" hidden>
    <div class="uac-box" role="dialog" aria-modal="true" aria-labelledby="reg-q" aria-describedby="reg-note" tabindex="-1">
      <p class="uac-bar">${esc(R.window)}</p>
      <form autocomplete="off">
        <div class="uac-main">
          <label class="uac-q" id="reg-q" for="reg-name">${esc(R.question)}</label>
          <input id="reg-name" class="reg-input" type="text" maxlength="40" autocomplete="off" spellcheck="false" placeholder="${esc(R.placeholder)}" />
          <p class="uac-note" id="reg-note">${esc(R.note)}</p>
        </div>
        <div class="uac-actions">
          <button type="submit" class="btn btn-primary">${esc(R.submit)}</button>
          <button type="button" class="btn" data-reg-skip>${esc(R.skip)}</button>
        </div>
      </form>
    </div>
  </div>

  <div id="app">
    <header class="titlebar">
      <div class="tb-left">
        <span class="tb-icon" aria-hidden="true"></span>
        <span class="tb-title">${esc(ui.appTitle)}</span>
        <span class="tb-step" id="tb-step"></span>
        <span class="tb-path" id="tb-path"></span>
      </div>
      <div class="tb-right">
        ${links.resume ? `<a class="btn btn-small tb-resume" href="${esc(links.resume)}" download="Vedant_Dalvi_Resume.pdf">${esc(ui.resumeShort)}</a>` : ''}
        <button type="button" class="btn btn-small" id="view-toggle" data-label-classic="${esc(ui.classicView)}" data-label-immersive="${esc(ui.immersiveView)}" hidden>${esc(ui.classicView)}</button>
      </div>
    </header>

    <main id="main">
      ${welcome}${license}${components}${installing}${programs}${japanese}${finish}
      <section class="lantern-facts" aria-labelledby="lf-title">
        <div class="page">
          <header class="page-head"><h2 id="lf-title">${esc(c.lanterns.classicTitle)}</h2><p class="lead">${esc(c.lanterns.classicLead)}</p></header>
          <div class="page-body"><ol class="lf-list">${c.lanterns.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ol></div>
        </div>
      </section>
      <p class="site-foot">${esc(ui.footer)}</p>
    </main>

    <nav class="wizard-foot" aria-label="${esc(ui.stepsNav)}">
      <button type="button" class="btn" id="nav-back" data-go="back">${esc(ui.back)}</button>
      <ol class="dots">${ids
        .map((id, i) => `<li><a href="#${id}" data-dot="${i}"><span class="dot-n" aria-hidden="true">${i + 1}</span><span class="dot-label">${esc(S[id].nav)}</span></a></li>`)
        .join('')}</ol>
      <button type="button" class="btn btn-primary" id="nav-next" data-go="next">${esc(ui.next)}</button>
    </nav>
  </div>

  <button type="button" id="lantern-hud" class="float-ui hud" aria-haspopup="dialog"><span class="hud-icon" aria-hidden="true"></span><span class="hud-text"></span></button>
  <p id="lantern-status" class="visually-hidden" role="status"></p>

  <section id="terminal" class="float-ui term" role="dialog" aria-labelledby="term-title" hidden>
    <header class="term-bar">
      <span class="term-glyph" aria-hidden="true">&gt;_</span>
      <h2 id="term-title">${esc(c.terminal.title)}</h2>
      <button type="button" class="term-close card-close" aria-label="${esc(c.terminal.close)}">&times;</button>
    </header>
    <div class="term-log" role="log" aria-live="polite" aria-label="${esc(c.terminal.outputLabel)}" tabindex="0"></div>
    <div class="term-sugg" role="group" aria-label="${esc(c.terminal.suggestLabel)}">${c.terminal.commands
      .map((k) => `<button type="button" class="term-chip" data-cmd="${esc(k.name)}">${esc(k.name)}</button>`)
      .join('')}</div>
    <form class="term-form" autocomplete="off">
      <label for="term-input" class="term-prompt">${esc(c.terminal.prompt)}</label>
      <input id="term-input" type="text" maxlength="80" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="${esc(c.terminal.inputLabel)}" />
    </form>
  </section>

  <div id="obj-card" class="float-ui card" role="dialog" aria-labelledby="obj-card-title" tabindex="-1" hidden>
    <button type="button" class="card-close" aria-label="${esc(ui.close)}">&times;</button>
    <p class="card-kicker"></p>
    <h3 class="card-title" id="obj-card-title"></h3>
    <p class="card-text"></p>
    <p class="card-actions"></p>
  </div>

  <canvas id="scene" aria-hidden="true" tabindex="-1"></canvas>`;
}
