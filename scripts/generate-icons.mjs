// Renders the SVG icons in public/ to the PNG sizes iOS and the web manifest need.
// Usage: node scripts/generate-icons.mjs   (needs a Playwright Chromium)
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const targets = [
  { svg: 'public/icon.svg', out: 'public/apple-touch-icon.png', size: 180 },
  { svg: 'public/icon.svg', out: 'public/pwa-192.png', size: 192 },
  { svg: 'public/icon.svg', out: 'public/pwa-512.png', size: 512 },
  { svg: 'public/icon-maskable.svg', out: 'public/maskable-512.png', size: 512 },
];

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
for (const t of targets) {
  const svg = await readFile(t.svg, 'utf8');
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<html><body style="margin:0"><img style="display:block;width:${t.size}px;height:${t.size}px" src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"></body></html>`,
  );
  await page.screenshot({ path: t.out, clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('wrote', t.out);
}
await browser.close();
