#!/usr/bin/env node
// Screenshot the first-person mission (or its dev lab) in headless Chromium with software WebGL.
//   node scripts/fps-shot.mjs <outdir> <name>=<query> [...]
//   e.g. node scripts/fps-shot.mjs shots "yard=lab=fps&stage=checkpoint&x=0&z=-61&quality=high" "play=fps&autostart=1&quality=low"
//   env SIZE=phone (844x390 touch), WAIT=ms. Software rendering is slow: allow ~20-30 s per shot.
// Needs Playwright with Chromium (local or global), like scripts/e2e.mjs.
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const ROOT = resolve(process.env.ROOT || process.cwd());
const require = createRequire(join(execSync('npm root -g', { encoding: 'utf8' }).trim(), 'noop.js'));
const { chromium } = require('playwright');
const { createServer } = await import(join(ROOT, 'node_modules/vite/dist/node/index.js'));
const [outdir, ...shots] = process.argv.slice(2);
mkdirSync(outdir, { recursive: true });
const server = await createServer({ root: ROOT, configFile: join(ROOT, 'vite.config.js'), logLevel: 'error', server: { port: 5700 + Math.floor(Math.random() * 200), host: '127.0.0.1', hmr: false, watch: null } });
await server.listen();
const url = server.resolvedUrls.local[0].replace(/\/$/, '');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const phone = process.env.SIZE === 'phone';
const ctx = await browser.newContext(phone ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
for (const spec of shots) {
  const i = spec.indexOf('=');
  const name = spec.slice(0, i);
  const q = spec.slice(i + 1);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e).slice(0, 400)));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /THREE|WebGL|shader/i.test(m.text()))) errors.push(m.text().slice(0, 400)); });
  page.on('crash', () => errors.push('PAGE CRASHED'));
  const t0 = Date.now();
  try {
    await page.goto(`${url}/?${q}`);
    try { await page.waitForFunction(() => globalThis.__labReady, null, { timeout: 180000 }); } catch { errors.push('not ready in 180s'); }
    await page.waitForTimeout(Number(process.env.WAIT ?? 400));
    await page.screenshot({ path: join(outdir, `${name}.png`) });
    const stats = await page.evaluate(() => globalThis.__fpsStats ?? null);
    console.log(name, errors.length ? `ERRORS ${[...new Set(errors)].slice(0, 4).join(' | ')}` : 'ok', `${Date.now() - t0}ms`, stats ? JSON.stringify(stats) : '');
  } catch (e) { console.log(name, 'FAILED', String(e).slice(0, 300)); }
  await page.close();
}
await browser.close();
await server.close();
