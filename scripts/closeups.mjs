// Close-up screenshots of the 3D area for each step, for checking model overlaps.
// Usage: node scripts/closeups.mjs [baseUrl] [outDir]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || 'check-out';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`${base}?nointro&3d`, { waitUntil: 'load' });
await page.waitForSelector('#loader', { state: 'hidden', timeout: 60000 });
await page.addStyleTag({ content: '.titlebar,.wizard-foot{display:none!important}' });
await page.waitForTimeout(2500);

const n = await page.locator('.step').count();
for (let i = 0; i < n; i++) {
  await page.evaluate((k) => window.scrollTo(0, document.querySelectorAll('.step')[k].offsetTop), i);
  await page.waitForTimeout(11000);
  if (i === 2) { await page.click('[data-select-all]'); await page.waitForTimeout(5000); }
  if (i === 6) { await page.hover('#launch'); await page.waitForTimeout(5000); }
  await page.screenshot({ path: `${out}/close-${i + 1}.png`, clip: { x: 640, y: 60, width: 800, height: 700 } });
  if (i === 3) {
    // the machine and its gears, at two moments of the rotation
    for (const k of ['a', 'b']) {
      await page.screenshot({ path: `${out}/close-4-gears-${k}.png`, clip: { x: 930, y: 380, width: 300, height: 190 } });
      await page.waitForTimeout(900);
    }
  }
}
await browser.close();
console.log('issues:', errors.length, errors);
