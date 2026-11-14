// Pure string templates shared by the Vite build (static HTML) — no DOM access here.
// All text comes from content.json, all URLs from links.json.

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
        <div class="page-body">${body}</div>
        ${actions ? `<div class="page-actions">${actions}</div>` : ''}
      </div>
    </section>`;
  };

  const nextBtn = (label) =>
    `<button type="button" class="btn btn-primary" data-go="next">${esc(label)}</button>`;
  const backBtn = `<button type="button" class="btn" data-go="back">${esc(ui.back)}</button>`;

  // 1. Welcome
  const welcome = section(
    'welcome',
    `<p class="headline">${esc(c.person.headline)}</p>
     <p class="role">${esc(c.person.roleLine)}</p>
     <p>${esc(S.welcome.intro)}</p>
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
      .join('')}</ol>`,
    backBtn + nextBtn(S.license.primary)
  );

  // 3. Components
  const total = S.components.groups.reduce((a, g) => a + g.skills.length, 0);
  const components = section(
    'components',
    `<div class="comp-tools">
       <button type="button" class="btn btn-small" data-select-all data-label-all="${esc(S.components.selectAll)}" data-label-none="${esc(S.components.clearAll)}">${esc(S.components.selectAll)}</button>
       <p class="comp-count" role="status" data-template="${esc(S.components.countTemplate)}" data-total="${total}">${esc(
         S.components.countTemplate.replace('{n}', '0').replace('{total}', total)
       )}</p>
     </div>
     <div class="groups">${S.components.groups
       .map(
         (g) => `<fieldset class="group" data-group="${esc(g.id)}">
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
    `<div class="install" data-status-idle="${esc(I.statusIdle)}" data-status-prefix="${esc(I.statusPrefix)}" data-status-done="${esc(I.statusDone)}">
       <p class="install-status"><span class="status-text">${esc(I.statusDone)}</span> <span class="status-pct" aria-hidden="true">100%</span></p>
       <div class="bar" role="progressbar" aria-label="${esc(I.barLabel)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="100"><span class="bar-fill"></span></div>
       <ol class="stages">${I.stages
         .map(
           (st) => `<li class="stage is-done"><h3>${esc(st.title)}</h3><p class="meta">${esc(st.meta)}</p><p>${esc(st.text)}</p></li>`
         )
         .join('')}</ol>
       <p class="earlier">${esc(I.earlier)}</p>
       <button type="button" class="btn btn-small" data-replay>${esc(I.replay)}</button>
     </div>
     <div class="pipeline">
       <h3>${esc(I.pipeline.title)}</h3>
       <p class="meta">${esc(I.pipeline.tech)}</p>
       <ol class="pipe">${I.pipeline.steps
         .map((p) => `<li><strong>${esc(p.title)}</strong><span>${esc(p.text)}</span></li>`)
         .join('')}</ol>
     </div>`,
    backBtn + nextBtn(I.primary)
  );

  // 5. Programs
  const P = S.programs;
  const programs = section(
    'programs',
    `<ul class="programs">${P.items
      .map(
        (it) => `<li class="program" data-obj="${esc(it.object)}">
          ${programIcon(it)}
          <div class="p-body">
            <h3>${esc(it.title)}</h3>
            <p class="meta">${esc(it.type)} · ${esc(P.builtWith)} ${esc(it.tech)}</p>
            <p>${esc(it.text)}</p>
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
    `<p>${esc(J.text)}</p>
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
  const finish = section(
    'finish',
    `<p>${esc(F.text)}</p>
     <div class="finish-actions">
       <a class="btn btn-primary" id="launch" href="${esc(links.email)}">${esc(F.launch)} <span class="btn-sub">${esc(F.launchHint)}</span></a>
       ${links.resume ? `<a class="btn" href="${esc(links.resume)}" download="Vedant_Dalvi_Resume.pdf">${esc(F.resume)}</a>` : `<span class="todo-link">${esc(F.resume)} <em>(${esc(ui.todoLink)})</em></span>`}
       <a class="btn btn-lantern" id="release" href="${esc(links.globalWishes)}" target="_blank" rel="noopener" aria-label="${esc(F.lantern)} (${esc(ui.newTab)})">${esc(F.lantern)}</a>
     </div>
     <h3>${esc(F.contactTitle)}</h3>
     <dl class="contacts">${F.contacts
       .map((k) => `<div><dt>${esc(k.label)}</dt><dd>${anchor(c, links, k.link, k.text)}</dd></div>`)
       .join('')}</dl>`,
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

  <div id="app">
    <header class="titlebar">
      <div class="tb-left">
        <span class="tb-icon" aria-hidden="true"></span>
        <span class="tb-title">${esc(ui.appTitle)}</span>
        <span class="tb-step" id="tb-step"></span>
      </div>
      <div class="tb-right">
        ${links.resume ? `<a class="btn btn-small tb-resume" href="${esc(links.resume)}" download="Vedant_Dalvi_Resume.pdf">${esc(ui.resumeShort)}</a>` : ''}
        <button type="button" class="btn btn-small" id="view-toggle" data-label-classic="${esc(ui.classicView)}" data-label-immersive="${esc(ui.immersiveView)}" hidden>${esc(ui.classicView)}</button>
      </div>
    </header>

    <main id="main">
      ${welcome}${license}${components}${installing}${programs}${japanese}${finish}
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

  <canvas id="scene" aria-hidden="true" tabindex="-1"></canvas>`;
}
