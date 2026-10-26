// The UI playthrough used by scripts/e2e.mjs: one whole reign through the real interface, then
// save → quit → reload → continue, the Passing, and reign II's first briefing.
//
// Buttons are found by accessible name. Wherever the text comes from game data (order labels,
// march choices, deployment titles, Legacy names), the expected name is read from the real
// view (getView on the live state), so this script follows content changes automatically.
// Duels are played with real keyboard input that reacts to the engine's telegraph (the DuelScreen
// exposes the live duel read-only as window.__elviaDuel in dev builds).

import { getView } from '../src/game/actions.js';

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const nameRe = (text) => new RegExp(escape(String(text).trim().slice(0, 60)), 'i');

export async function playthrough(ctx) {
  const { page, baseUrl, where, press, shot, waitPhase, phaseOf, stateOf, fail } = ctx;
  const view = async () => {
    const s = await stateOf(page);
    return s ? getView(s) : null;
  };
  const expect = (cond, msg) => {
    if (!cond) fail(where, msg);
    return cond;
  };

  // ── Title → new reign ────────────────────────────────────────────────────────────────────
  await page.goto(`${baseUrl}/?seed=4242`);
  await page.getByRole('heading', { level: 1 }).waitFor();
  await shot(page, 'title');
  await press(page, /begin a new reign/i);
  await page.getByLabel(/regnal name/i).fill('Aurelian');
  await press(page, /take the crown/i);
  await waitPhase(page, 'war_room');
  await shot(page, 'war-room-t1');

  // ── Turn 1: open the northern road, then march ──────────────────────────────────────────
  await issueOrder(ctx, view, 'E');
  await shot(page, 'resolution-t1');
  await approveFirstChronicle(ctx);
  await beginDeployment(ctx, view, 'march');
  await waitPhase(page, 'expedition');

  const plan = [
    { beat: 'road', choose: ['ask_mara', 'ride_on'] },
    { beat: 'checkpoint', choose: ['walk_through'] },
    { beat: 'wilds', choose: ['face_alpha'] },
    { beat: 'wilds', choose: ['spare_alpha'] },
    { beat: 'ruin', choose: ['study', 'leave_ruin'] },
    { beat: 'champion', choose: ['challenge'] },
  ];
  for (const step of plan) {
    for (const id of step.choose) {
      const v = await view();
      const choice = v?.beat?.choices.find((c) => c.id === id);
      if (!expect(choice, `march: no choice "${id}" at beat ${v?.beat?.id}`)) continue;
      await press(page, nameRe(choice.label));
      if (choice.kind === 'duel') {
        const lose = v.beat.id === 'champion';
        await playDuel(ctx, { lose, label: `duel-${v.beat.id}${lose ? '-loss' : ''}` });
      } else {
        await page.waitForTimeout(150);
      }
    }
    await shot(page, `march-${step.beat}`);
  }

  // The Cycle doc success test: lose the first champion duel, name why, win the rematch.
  {
    const s = await stateOf(page);
    expect(s.expedition?.phase === 'after_defeat', `champion: expected after_defeat, got ${s.expedition?.phase}`);
    const misreads = s.expedition?.duels?.at(-1)?.misreads ?? [];
    expect(misreads.length > 0, 'champion: a lost duel must name at least one misread');
    const firstAdvice = misreads[0]?.advice;
    if (firstAdvice) expect(await page.getByText(nameRe(firstAdvice.slice(0, 40))).count(), 'champion: the misread advice is not shown after the defeat');
    await shot(page, 'march-champion-defeat');
    const v = await view();
    const rematch = v.beat.choices.find((c) => c.kind === 'duel');
    if (expect(rematch, 'champion: no rematch offered after a defeat')) {
      await press(page, nameRe(rematch.label));
      await playDuel(ctx, { lose: false, label: 'duel-champion-rematch' });
      const after = await stateOf(page);
      expect(after.expedition?.phase === 'after_victory', `rematch: expected after_victory, got ${after.expedition?.phase}`);
    }
  }
  // Finish the march: take whatever advance choices remain until it ends.
  for (let guard = 0; guard < 8 && (await phaseOf(page)) === 'expedition'; guard += 1) {
    const v = await view();
    const next = v.beat.choices.find((c) => c.id === 'release') ?? v.beat.choices.find((c) => c.kind === 'advance');
    if (!expect(next, `march: stuck at beat ${v.beat.id}`)) break;
    await press(page, nameRe(next.label));
    await page.waitForTimeout(200);
  }
  await shot(page, 'after-march');

  // ── Campfire, if offered right after the march ─────────────────────────────────────────
  if ((await phaseOf(page)) === 'campfire') await sitAtCampfire(ctx, view, 'enter');

  // ── Turns 2–4 ───────────────────────────────────────────────────────────────────────────
  const orders = { 2: 'A', 3: 'A', 4: 'B' };
  for (let turn = 2; turn <= 4; turn += 1) {
    await continueTurn(ctx, view);
    await waitPhase(page, 'war_room');
    if (turn === 3) await shot(page, 'war-room-t3');
    await issueOrder(ctx, view, orders[turn]);
    await approveFirstChronicle(ctx);
    const v = await view();
    if (turn === 4 && v.deployments?.some((d) => d.kind === 'skirmish')) {
      await beginDeployment(ctx, view, 'skirmish');
      await waitPhase(page, 'expedition');
      await shot(page, 'skirmish');
      const duelChoice = (await view()).beat.choices.find((c) => c.kind === 'duel');
      if (duelChoice) {
        await press(page, nameRe(duelChoice.label));
        await playDuel(ctx, { lose: false, label: 'duel-skirmish' });
      }
      for (let g = 0; g < 6 && (await phaseOf(page)) === 'expedition'; g += 1) {
        const c = (await view()).beat.choices.find((x) => x.kind === 'advance');
        if (!c) break;
        await press(page, nameRe(c.label));
        await page.waitForTimeout(200);
      }
    }
    if ((await phaseOf(page)) === 'campfire') await sitAtCampfire(ctx, view, turn === 3 ? 'skip' : 'short');
    const offered = (await view())?.campfire;
    if (offered && (await phaseOf(page)) === 'resolution') {
      await press(page, /^sit by the fire/i);
      await waitPhase(page, 'campfire');
      await sitAtCampfire(ctx, view, 'enter');
    }
  }

  // ── Save → quit → reload → continue: the world must remember ────────────────────────────
  {
    const before = await stateOf(page);
    await page.getByRole('button', { name: /save and load/i }).click();
    await press(page, /save (to |in )?slot 1|^save$|save here/i);
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^settings$/i }).click();
    await press(page, /quit to title|return to title|title screen/i);
    await page.waitForFunction(() => !globalThis.__elvia?.state);
    await page.reload();
    await page.getByRole('heading', { level: 1 }).waitFor();
    await shot(page, 'title-continue');
    await press(page, /^continue$/i);
    await page.waitForFunction(() => Boolean(globalThis.__elvia?.state));
    const after = await stateOf(page);
    expect(after.turn === before.turn && after.year === before.year, `reload: turn/year changed (${before.turn}/${before.year} → ${after.turn}/${after.year})`);
    expect(after.chronicle.length === before.chronicle.length, 'reload: the Chronicle lost entries');
    expect(JSON.stringify(after.flags) === JSON.stringify(before.flags), 'reload: flags differ');
    expect(after.characters.mika.status === before.characters.mika.status, 'reload: Mika was forgotten');
    await shot(page, 'after-reload');
  }

  // ── Turn 5: the Thaw, then the Passing ──────────────────────────────────────────────────
  if ((await phaseOf(page)) === 'resolution') await continueTurn(ctx, view);
  await waitPhase(page, 'war_room');
  await shot(page, 'war-room-t5');
  await issueOrder(ctx, view, 'A');
  await page.waitForTimeout(200);
  if ((await phaseOf(page)) === 'expedition') {
    // A siege last stand may be offered on turn 5; the order above avoids it, but stay safe.
    fail(where, 'turn 5: unexpected expedition');
  }
  if ((await phaseOf(page)) === 'campfire') await sitAtCampfire(ctx, view, 'skip');
  await shot(page, 'resolution-t5');
  await press(page, /^close the era/i);
  await page.getByRole('dialog').getByRole('button', { name: /begin the passing/i }).click();
  await waitPhase(page, 'passing');

  // I. The Last Fire
  await shot(page, 'passing-1-last-fire');
  await press(page, /^continue to the chronicle/i);
  await page.waitForFunction(() => globalThis.__elvia?.state?.passing?.step === 'chronicle');
  // II. The Chronicle
  await shot(page, 'passing-2-chronicle');
  await press(page, /^continue to what survives you/i);
  await page.waitForFunction(() => globalThis.__elvia?.state?.passing?.step === 'legacies');
  // III. Legacies: pick up to two earned ones
  await shot(page, 'passing-3-legacies');
  const legacies = (await view()).legacies.filter((l) => l.earned).slice(0, 2);
  for (const l of legacies) await page.getByRole('button', { name: nameRe(l.name) }).first().click();
  await press(page, /^carry/i);
  await page.getByRole('dialog').getByRole('button', { name: /seal the choice/i }).click();
  await page.waitForFunction(() => globalThis.__elvia?.state?.passing?.step === 'mantle');
  // IV. The Mantle
  await shot(page, 'passing-4-mantle');
  await press(page, /pass the mantle/i);
  await page.waitForFunction(() => globalThis.__elvia?.state?.cycle?.number === 2, null, { timeout: 20000 });
  await waitPhase(page, 'war_room');
  await page.waitForTimeout(600);
  await shot(page, 'reign-2-war-room');

  // The Cycle doc's memory test: reign II's first briefing must cite reign I.
  {
    const s = await stateOf(page);
    const v = getView(s);
    const prev = s.history.at(-1);
    const text = await page.locator('main').innerText();
    expect(prev, 'reign II: no history entry for reign I');
    const cites = v.crisis.briefing.slice(0, 3).join(' ');
    expect(/years|reign|Mika|Nyra|remember/i.test(cites), 'reign II: the first briefing does not cite reign I');
    expect(text.includes(v.crisis.briefing[0].slice(0, 30)), 'reign II: the first briefing line is not on screen');
    expect(chosenOk(s, legacies), 'reign II: the chosen Legacies are not active');
  }
}

function chosenOk(state, legacies) {
  const active = state.cycle.activeLegacies ?? [];
  return legacies.every((l) => active.includes(l.id));
}

// ─── Steps ─────────────────────────────────────────────────────────────────────────────────

async function issueOrder({ page, press, waitPhase, fail, where }, view, orderId) {
  const v = await view();
  const order = v.crisis.orders.find((o) => o.id === orderId);
  if (!order) return fail(where, `no order ${orderId}`);
  await page.getByRole('button', { name: nameRe(order.label) }).first().click();
  await press(page, /seal the order/i);
  await waitPhase(page, 'resolution');
}

async function approveFirstChronicle({ page }) {
  const btn = page.getByRole('button', { name: /approve/i }).filter({ visible: true }).first();
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(150);
  }
}

async function beginDeployment({ page, fail, where }, view, kind) {
  const v = await view();
  const d = v.deployments?.find((x) => x.kind === kind);
  if (!d) return fail(where, `no ${kind} deployment offered`);
  const byTitle = page.getByRole('button', { name: nameRe(d.title) }).filter({ visible: true });
  if (await byTitle.count()) await byTitle.first().click();
  else await page.getByRole('button', { name: /march|ride|deploy|lead/i }).filter({ visible: true }).first().click();
  const confirm = page.getByRole('dialog').getByRole('button', { name: /march|ride|deploy|lead|go|confirm/i });
  if (await confirm.count()) await confirm.first().click();
}

async function continueTurn({ page, press }, view) {
  const v = await view();
  if (v?.campfire) {
    // Leave the fire for later; Continue is always available.
  }
  await press(page, /^continue|next season|to the war room/i);
}

async function sitAtCampfire({ page, press, waitPhase, shot }, view, mode) {
  await shot(page, `campfire-offer`);
  if (mode === 'skip') {
    await press(page, /skip/i);
  } else if (mode === 'short') {
    await press(page, /short|a moment|brief/i);
    await press(page, /bank the fire/i);
  } else {
    await press(page, /^enter|sit with|stay/i);
    const v = await view();
    const resp = v.scene?.responses?.find((r) => r.id === 'honest') ?? v.scene?.responses?.[0];
    if (resp) await page.getByRole('button', { name: nameRe(resp.label) }).first().click();
    await shot(page, 'campfire-reply');
    await press(page, /bank the fire/i);
  }
  await waitPhase(page, 'resolution');
}

// ─── Duels with real keyboard input ───────────────────────────────────────────────────────

const KEYS = { strike: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' }, dodge: { left: 'a', right: 'd' } };

/**
 * Plays the duel on screen. lose=true idles (and holds guard into everything, the classic
 * newcomer mistake) so the result screen has misreads to explain; otherwise it reads the
 * telegraph like the engine's oracle bot and answers with keys.
 */
async function playDuel({ page, shot, fail, where }, { lose, label }) {
  await page.waitForFunction(() => Boolean(globalThis.__elviaDuel?.current), null, { timeout: 15000 });
  await page.waitForTimeout(300);
  await shot(page, `${label}-start`);
  let guard = false;
  let shotMid = false;
  const started = Date.now();
  while (Date.now() - started < 240000) {
    const d = await page.evaluate(() => {
      const duel = globalThis.__elviaDuel?.current;
      if (!duel) return null;
      const { phase, telegraph: t, player: p, enemy: e } = duel;
      return {
        phase,
        t: t ? { isFeint: t.isFeint, isHeavy: t.isHeavy, dir: t.dir, tti: t.timeToImpactMs, stepId: t.stepId } : null,
        p: { stun: p.stunMs, swing: p.swingMs, dodging: p.dodge.active, cd: p.dodge.cooldownMs, arc: p.arcCharge, royal: p.royalUsed, hp: p.hp },
        e: { state: e.state, guardSide: e.guardSide },
      };
    });
    if (!d || d.phase === 'over') break;
    if (!shotMid && d.t && d.t.tti < 300) {
      await shot(page, `${label}-telegraph`);
      shotMid = true;
    }
    if (lose) {
      if (!guard) {
        await page.keyboard.down(' ');
        guard = true;
      }
      await page.waitForTimeout(50);
      continue;
    }
    const free = d.p.stun <= 0 && d.p.swing <= 0 && !d.p.dodging;
    if (d.t && !d.t.isFeint) {
      if (d.t.isHeavy) {
        if (guard) {
          await page.keyboard.up(' ');
          guard = false;
        }
        if (d.t.tti <= 170 && free && d.p.cd <= 0) await page.keyboard.press(d.t.dir === 'left' ? 'd' : 'a');
      } else if (d.t.tti <= 150 && !guard) {
        await page.keyboard.down(' ');
        guard = true;
      }
    } else if (guard) {
      await page.keyboard.up(' ');
      guard = false;
    }
    if (free && !guard && ['recovery', 'staggered', 'open'].includes(d.e.state)) {
      if (d.p.arc >= 1) await page.keyboard.press('e');
      else await page.keyboard.press(KEYS.strike[d.e.guardSide === 'left' ? 'right' : d.e.guardSide === 'right' ? 'left' : 'up']);
    }
    if (!d.p.royal && d.p.hp < 45) await page.keyboard.press('r');
    await page.waitForTimeout(16);
  }
  if (guard) await page.keyboard.up(' ');
  // The result screen.
  const cont = page.getByRole('button', { name: /^continue/i }).filter({ visible: true }).first();
  try {
    await cont.waitFor({ timeout: 15000 });
  } catch {
    fail(where, `${label}: no Continue button on the duel result screen`);
    return;
  }
  await page.waitForTimeout(300);
  await shot(page, `${label}-result`);
  await cont.click();
  await page.waitForFunction(() => !globalThis.__elviaDuel?.current, null, { timeout: 10000 }).catch(() => {});
}
