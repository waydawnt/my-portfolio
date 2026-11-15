// Headless smoke test: walks all seven steps at desktop and 390px, saves screenshots,
// and reports console errors and horizontal overflow.
// Usage: node scripts/check.mjs [baseUrl] [outDir]     (needs Edge or Chrome installed)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'check-out';
const only = process.argv[4];
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  channel: process.env.BROWSER_CHANNEL || 'msedge',
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const views = [
  { name: 'desktop', viewport: { width: 1440, height: 810 }, deviceScaleFactor: 1 },
  { name: 'mobile', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
].filter((v) => !only || v.name === only);

let problems = 0;
for (const v of views) {
  const ctx = await browser.newContext(v);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[requestfailed] ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`[${r.status()}] ${r.url()}`); });

  await page.goto(base, { waitUntil: 'load' });
  await page.waitForSelector('#uac:not([hidden])', { timeout: 60000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${out}/${v.name}-0-uac.png` });
  await page.click('[data-uac="no"]');
  await page.waitForSelector('#uac', { state: 'hidden' });
  await page.click('[data-reg-skip]'); // the 'Register this copy to' prompt
  await page.waitForTimeout(4000);

  const n = await page.locator('.step').count();
  for (let i = 0; i < n; i++) {
    if (i > 0) {
      await page.evaluate((k) => window.scrollTo(0, document.querySelectorAll('.step')[k].offsetTop), i);
      await page.waitForTimeout(v.name === 'mobile' ? 2600 : 2600);
    }
    if (i === 2) {
      await page.click('[data-select-all]');
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: `${out}/${v.name}-${i + 1}.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 1) { errors.push(`horizontal overflow of ${overflow}px on step ${i + 1}`); }
  }

  // Classic view
  await page.click('#view-toggle');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/${v.name}-classic.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 1) errors.push(`horizontal overflow of ${overflow}px in classic view`);

  console.log(`--- ${v.name}: ${errors.length} issue(s)`);
  errors.forEach((e) => console.log('   ', e));
  problems += errors.length;
  await ctx.close();
}
await browser.close();
process.exit(problems ? 1 : 0);
