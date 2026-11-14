// Captures public/og-image.png (1200x630) from the running site.
// Usage: node scripts/og.mjs [baseUrl]
import { chromium } from 'playwright-core';
const base = process.argv[2] || 'http://localhost:4173/';
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.goto(`${base}?nointro&3d`, { waitUntil: 'load' });
await page.waitForSelector('#loader', { state: 'hidden', timeout: 60000 });
await page.addStyleTag({ content: '.titlebar,.wizard-foot,.page-actions{display:none!important} html.mode-3d .step{padding:0!important}' });
await page.waitForTimeout(3500);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('wrote public/og-image.png');
