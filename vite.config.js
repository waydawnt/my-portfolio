import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderApp, renderHead } from './src/render.js';

const read = (p) => JSON.parse(readFileSync(fileURLToPath(new URL(p, import.meta.url)), 'utf8'));

// Renders all site text from src/content.json + src/links.json into index.html
// at dev and build time, so the content is real static HTML (SEO, no-JS, a11y).
function staticContent() {
  return {
    name: 'static-content',
    transformIndexHtml(html) {
      const content = read('./src/content.json');
      const links = read('./src/links.json');
      return html
        .replace('<!--HEAD-->', renderHead(content, links))
        .replace('<!--APP-->', renderApp(content, links));
    },
    // three's DRACOLoader bundles its own decoder copies; we serve ours from public/draco instead.
    generateBundle(_, bundle) {
      for (const k of Object.keys(bundle)) if (/draco_(decoder|wasm_wrapper)/.test(k)) delete bundle[k];
    },
    handleHotUpdate({ file, server }) {
      if (/(content|links)\.json$/.test(file)) server.ws.send({ type: 'full-reload' });
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [staticContent()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 900,
  },
});
