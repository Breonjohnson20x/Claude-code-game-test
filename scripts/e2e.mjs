#!/usr/bin/env node
// End-to-end check of the real app in headless Chromium.
//
//   npm run e2e                 # everything below
//   npm run e2e -- --sweep      # only the scenario sweep
//   npm run e2e -- --play       # only the playthrough
//   npm run e2e -- --pwa        # only the installable/offline build check
//
// Starts a Vite dev server, then:
//   1. Sweep: opens every dev scenario (/?scenario=<name>) at 390x844 (touch) and 1280x800,
//      screenshots it, and audits it: no console errors, one <h1>, no horizontal scroll,
//      every visible button has an accessible name and a >= 44px tap target on phones.
//   2. Playthrough: a whole reign through the real UI from the title screen — orders, a march
//      with duels played by keyboard, a campfire, the Passing, Legacies — into reign II, whose
//      first briefing must cite the first reign.
//   3. PWA: a production build under a sub-path (like GitHub Pages), served by `vite preview`:
//      the manifest and icons load, the service worker takes control, then the server is shut
//      down and the game must still load and start a reign offline.
// Screenshots and report.json go to e2e-artifacts/. Exits non-zero on any failure.
//
// Needs Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`
// (a globally installed Playwright is used when there is no local one).

import { createRequire } from 'node:module';
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e-artifacts');
const args = new Set(process.argv.slice(2));
const ONLY = ['--sweep', '--play', '--pwa'].filter((f) => args.has(f));
const runs = (flag) => ONLY.length === 0 || ONLY.includes(flag);

const VIEWPORTS = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
};

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    const globalRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    const require = createRequire(join(globalRoot, 'noop.js'));
    return require('playwright');
  }
}

async function startServer() {
  const { createServer } = await import('vite');
  const server = await createServer({ root: ROOT, logLevel: 'error', server: { port: 5390, strictPort: false, host: '127.0.0.1' } });
  await server.listen();
  const url = server.resolvedUrls.local[0].replace(/\/$/, '');
  return { server, url };
}

const failures = [];
const report = { sweep: [], play: [] };
const fail = (where, msg) => {
  failures.push(`${where}: ${msg}`);
  console.error(`  ✗ ${where}: ${msg}`);
};

function watchConsole(page, where) {
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e?.stack ?? e)));
  return () => {
    // Remote fonts may be unreachable offline; that is cosmetic, not a failure.
    const real = errors.filter((e) => !/fonts\.(googleapis|gstatic)\.com|net::ERR_/.test(e));
    for (const e of real) fail(where, `console error: ${e.slice(0, 300)}`);
    return real;
  };
}

async function audit(page, where, { phone }) {
  const result = await page.evaluate(
    ({ phone }) => {
      const out = { h1: document.querySelectorAll('h1').length, overflowX: 0, unnamed: [], small: [], clipped: [] };
      out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      // Text pushed past the right edge (hidden by an overflow clip, so overflowX can't see it).
      const vw = document.documentElement.clientWidth;
      const inScroller = (el) => {
        for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
          const ox = getComputedStyle(n).overflowX;
          if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth) return true;
        }
        return false;
      };
      for (const el of document.querySelectorAll('h1, h2, h3, p, li, button, label')) {
        const r = el.getBoundingClientRect();
        if (!r.width || r.right <= vw + 1 || el.closest('[aria-hidden="true"]') || inScroller(el)) continue;
        out.clipped.push(`${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 40)}" ends at ${Math.round(r.right)}px > ${vw}px`);
        if (out.clipped.length >= 5) break;
      }
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[aria-hidden="true"]');
      };
      for (const el of document.querySelectorAll('button, [role="button"], a[href], input, textarea, select')) {
        if (!visible(el)) continue;
        const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.labels?.[0]?.textContent || el.getAttribute('placeholder') || '').trim();
        const label = name.slice(0, 40) || el.outerHTML.slice(0, 80);
        if (!name) out.unnamed.push(label);
        if (phone && el.matches('button, [role="button"]')) {
          const r = el.getBoundingClientRect();
          if (r.height < 44 || r.width < 44) out.small.push(`${label} (${Math.round(r.width)}x${Math.round(r.height)})`);
        }
      }
      return out;
    },
    { phone },
  );
  if (result.h1 !== 1) fail(where, `expected exactly one <h1>, found ${result.h1}`);
  if (result.overflowX > 1) fail(where, `horizontal overflow of ${result.overflowX}px`);
  for (const c of result.clipped) fail(where, `content clipped past the right edge: ${c}`);
  for (const u of result.unnamed) fail(where, `control without an accessible name: ${u}`);
  for (const s of result.small) fail(where, `tap target under 44px: ${s}`);
  return result;
}

// The TopBar overlays, opened on a few rich states: each must open as a dialog, pass the audit,
// and close with Escape (returning focus to the page).
const OVERLAY_SCENARIOS = new Set(['war_room_t3', 'cycle2_war_room', 'passing_chronicle']);
const OVERLAYS = [
  ['chronicle', 'The Chronicle'],
  ['dossier', 'Council and factions'],
  ['saves', 'Save and load'],
  ['settings', 'Settings'],
];

async function overlays(page, where, vpName, scenario) {
  for (const [id, label] of OVERLAYS) {
    const w = `${where}/${id}`;
    await page.getByRole('button', { name: label, exact: true }).first().click();
    const dialog = page.getByRole('dialog');
    try {
      await dialog.first().waitFor({ timeout: 5000 });
    } catch {
      fail(w, `the ${label} overlay did not open`);
      continue;
    }
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, 'sweep', `${vpName}-${scenario}-overlay-${id}.png`) });
    await audit(page, w, { phone: vpName === 'phone' });
    if (id === 'dossier') {
      // Every tab renders.
      for (const tab of ['Factions', 'The World']) {
        await page.getByRole('tab', { name: tab }).click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: join(OUT, 'sweep', `${vpName}-${scenario}-overlay-${id}-${tab.replace(/\W/g, '')}.png`) });
      }
    }
    await page.keyboard.press('Escape');
    try {
      await dialog.first().waitFor({ state: 'detached', timeout: 3000 });
    } catch {
      fail(w, 'Escape did not close the overlay');
    }
  }
}

async function sweep(browser, baseUrl) {
  const { SCENARIOS } = await import(join(ROOT, 'src/game/dev/scenarios.js'));
  console.log(`\nSweep: ${Object.keys(SCENARIOS).length} scenarios × ${Object.keys(VIEWPORTS).length} viewports`);
  for (const [vpName, vp] of Object.entries(VIEWPORTS)) {
    const context = await browser.newContext({ ...vp, reducedMotion: 'reduce' });
    for (const name of Object.keys(SCENARIOS)) {
      const where = `sweep/${vpName}/${name}`;
      const page = await context.newPage();
      const done = watchConsole(page, where);
      await page.goto(`${baseUrl}/?scenario=${name}`);
      try {
        await page.waitForFunction((n) => globalThis.__elvia?.state && document.querySelector('h1'), name, { timeout: 15000 });
      } catch {
        fail(where, 'scenario did not render a game screen with an <h1>');
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: join(OUT, 'sweep', `${vpName}-${name}.png`), fullPage: true });
      const a = await audit(page, where, { phone: vpName === 'phone' });
      if (OVERLAY_SCENARIOS.has(name)) await overlays(page, `${where}`, vpName, name);
      report.sweep.push({ where, ...a, consoleErrors: done() });
      await page.close();
    }
    await context.close();
  }
}

// ─── Playthrough helpers ───────────────────────────────────────────────────────────────

const phaseOf = (page) => page.evaluate(() => globalThis.__elvia?.state?.phase ?? 'title');
const stateOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__elvia?.state ?? null)));

async function waitPhase(page, phase, timeout = 15000) {
  await page.waitForFunction((p) => (globalThis.__elvia?.state?.phase ?? 'title') === p, phase, { timeout });
}

let shotSeq = 0;
async function shot(page, label) {
  shotSeq += 1;
  const file = join(OUT, 'play', `${String(shotSeq).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  report.play.push({ shot: file });
}

/** Click the first visible button whose accessible name matches. */
async function press(page, name, { exact = false, timeout = 10000 } = {}) {
  const btn = page.getByRole('button', { name, exact }).filter({ visible: true }).first();
  await btn.waitFor({ state: 'visible', timeout });
  await btn.click();
}

async function play(browser, baseUrl, vpName) {
  const { playthrough } = await import(join(ROOT, 'scripts/e2e-play.mjs'));
  const context = await browser.newContext({ ...VIEWPORTS[vpName], reducedMotion: 'reduce' });
  const page = await context.newPage();
  const where = `play/${vpName}`;
  const done = watchConsole(page, where);
  try {
    await playthrough({ page, baseUrl, where, vpName, press, shot: (p, l) => shot(p, `${vpName}-${l}`), waitPhase, phaseOf, stateOf, fail, audit });
  } catch (err) {
    fail(where, `playthrough aborted: ${err.message}`);
    await page.screenshot({ path: join(OUT, 'play', `${vpName}-FAILED.png`) }).catch(() => {});
  }
  done();
  await context.close();
}

// ─── Installable, offline build ────────────────────────────────────────────────────────

async function pwa(browser) {
  console.log('\nInstallable build (PWA)');
  const where = 'pwa';
  const { preview } = await import('vite');
  const base = '/elvia-pwa/';
  const outDir = join(OUT, 'pwa-dist');
  // A separate process: the dev server already set NODE_ENV=development in this one, which would
  // make an in-process build a development build (no service worker).
  const env = { ...process.env, BASE_PATH: base };
  delete env.NODE_ENV;
  execFileSync(process.execPath, [join(ROOT, 'node_modules/vite/bin/vite.js'), 'build', '--outDir', outDir, '--emptyOutDir', '--logLevel', 'error'], { cwd: ROOT, env, stdio: 'inherit' });
  const server = await preview({ root: ROOT, base, logLevel: 'error', build: { outDir }, preview: { port: 5391, strictPort: false, host: '127.0.0.1' } });
  const url = server.resolvedUrls.local[0];
  const context = await browser.newContext({ ...VIEWPORTS.phone, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const done = watchConsole(page, where);
  const title = () => page.getByRole('heading', { level: 1, name: 'Empire of Elvia' }).waitFor({ timeout: 15000 });
  let serverOpen = true;
  try {
    await page.goto(url);
    await title();

    const href = await page.getAttribute('link[rel="manifest"]', 'href');
    if (!href?.startsWith(base)) fail(where, `manifest link should live under ${base}, got ${href}`);
    const manifestUrl = new URL(href, url).href;
    const manifest = await (await page.request.get(manifestUrl)).json();
    if (!manifest.name || !manifest.short_name || manifest.display !== 'standalone') fail(where, 'manifest is missing name, short_name or display');
    for (const size of ['192x192', '512x512']) {
      if (!manifest.icons?.some((i) => i.sizes === size && i.type === 'image/png')) fail(where, `manifest has no ${size} PNG icon`);
    }
    const appleHref = await page.getAttribute('link[rel="apple-touch-icon"]', 'href');
    const iconUrls = [...(manifest.icons ?? []).map((i) => new URL(i.src, manifestUrl).href), new URL(appleHref ?? '', url).href];
    for (const iconUrl of iconUrls) {
      const res = await page.request.get(iconUrl);
      const body = await res.body();
      const isPng = body.subarray(1, 4).toString('ascii') === 'PNG';
      if (!res.ok() || !isPng) fail(where, `icon ${iconUrl} did not load as a PNG (${res.status()})`);
    }

    const sw = await page.evaluate(async () => {
      const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 20000));
      const reg = await Promise.race([navigator.serviceWorker.ready, timeout]);
      return reg ? { state: reg.active?.state, scope: reg.scope, caches: await caches.keys() } : null;
    });
    if (!sw) throw new Error('no service worker became active within 20 s');
    if (!sw.scope.endsWith(base)) fail(where, `service worker scope ${sw.scope} is not the base path`);
    if (!sw.caches.some((k) => k.startsWith('elvia-'))) fail(where, `no precache found (caches: ${sw.caches.join(', ')})`);
    await page.reload();
    await title();
    if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) fail(where, 'the service worker does not control the page after a reload');

    // Pull the plug: the server goes away and the game must still run.
    await server.close();
    serverOpen = false;
    const direct = await page.request.get(url).then(
      () => true,
      () => false,
    );
    if (direct) fail(where, 'the preview server still answers after close; the offline check would prove nothing');
    await page.reload();
    await title();
    await shot(page, 'pwa-offline-title');
    await audit(page, `${where}/offline-title`, { phone: true });
    await press(page, /^begin a new reign/i);
    await press(page, /^take the crown/i);
    await page.getByRole('heading', { level: 1 }).filter({ hasNotText: 'Empire of Elvia' }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(400);
    await shot(page, 'pwa-offline-war-room');
    console.log('  ✓ manifest, icons, service worker, and an offline new reign');
  } catch (err) {
    fail(where, `PWA check aborted: ${err.message}`);
    await page.screenshot({ path: join(OUT, 'play', 'pwa-FAILED.png') }).catch(() => {});
  } finally {
    done();
    await context.close();
    if (serverOpen) await server.close();
    rmSync(outDir, { recursive: true, force: true });
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'sweep'), { recursive: true });
mkdirSync(join(OUT, 'play'), { recursive: true });

const { chromium } = await loadPlaywright();
const { server, url } = await startServer();
const browser = await chromium.launch();
try {
  if (runs('--sweep')) await sweep(browser, url);
  if (runs('--play')) {
    for (const vp of Object.keys(VIEWPORTS)) {
      console.log(`\nPlaythrough (${vp})`);
      await play(browser, url, vp);
    }
  }
  if (runs('--pwa')) await pwa(browser);
} finally {
  await browser.close();
  await server.close();
}

report.failures = failures;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${failures.length ? `✗ ${failures.length} failure(s)` : '✓ all checks passed'} — artifacts in e2e-artifacts/`);
process.exit(failures.length ? 1 : 0);
