#!/usr/bin/env node
// End-to-end check of the real app in headless Chromium.
//
//   npm run e2e                 # scenario sweep + full UI playthrough, phone and desktop
//   npm run e2e -- --sweep      # only the scenario sweep
//   npm run e2e -- --play       # only the playthrough
//
// Starts a Vite dev server, then:
//   1. Sweep: opens every dev scenario (/?scenario=<name>) at 390x844 (touch) and 1280x800,
//      screenshots it, and audits it: no console errors, one <h1>, no horizontal scroll,
//      every visible button has an accessible name and a >= 44px tap target on phones.
//   2. Playthrough: a whole reign through the real UI from the title screen — orders, a march
//      with duels played by keyboard, a campfire, the Passing, Legacies — into reign II, whose
//      first briefing must cite the first reign.
// Screenshots and report.json go to e2e-artifacts/. Exits non-zero on any failure.
//
// Needs Playwright with Chromium: `npm i -D playwright && npx playwright install chromium`
// (a globally installed Playwright is used when there is no local one).

import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'e2e-artifacts');
const args = new Set(process.argv.slice(2));
const RUN_SWEEP = !args.has('--play') || args.has('--sweep');
const RUN_PLAY = !args.has('--sweep') || args.has('--play');

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
      const out = { h1: document.querySelectorAll('h1').length, overflowX: 0, unnamed: [], small: [] };
      out.overflowX = document.documentElement.scrollWidth - document.documentElement.clientWidth;
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
  for (const u of result.unnamed) fail(where, `control without an accessible name: ${u}`);
  for (const s of result.small) fail(where, `tap target under 44px: ${s}`);
  return result;
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

// ─── Main ────────────────────────────────────────────────────────────────────────────────

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'sweep'), { recursive: true });
mkdirSync(join(OUT, 'play'), { recursive: true });

const { chromium } = await loadPlaywright();
const { server, url } = await startServer();
const browser = await chromium.launch();
try {
  if (RUN_SWEEP) await sweep(browser, url);
  if (RUN_PLAY) {
    for (const vp of Object.keys(VIEWPORTS)) {
      console.log(`\nPlaythrough (${vp})`);
      await play(browser, url, vp);
    }
  }
} finally {
  await browser.close();
  await server.close();
}

report.failures = failures;
writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\n${failures.length ? `✗ ${failures.length} failure(s)` : '✓ all checks passed'} — artifacts in e2e-artifacts/`);
process.exit(failures.length ? 1 : 0);
