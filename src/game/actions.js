// Game controller (reducer-style). Pure: dispatch(state, action) → { state, io, error, report }.
// The UI owns IO: it performs `io.autosave` (a reason from saveSystem.AUTOSAVE_REASONS) and
// `io.commitDynasty` after a successful dispatch. Nothing here touches storage, network or DOM.
//
// Phase flow (one reign = TURNS_PER_CYCLE turns):
//   war_room ──ISSUE_ORDER──▶ resolution ──CONTINUE──▶ war_room (next turn) … turn 5 ──▶ passing
//              resolution ──BEGIN_DEPLOYMENT──▶ expedition ──(camp)──▶ campfire? ──▶ resolution
//              resolution ──START_CAMPFIRE──▶ campfire ──CAMPFIRE_COMPLETE──▶ resolution
//   passing: campfire → chronicle → legacies → mantle ──BEGIN_NEXT_CYCLE──▶ war_room (cycle + 1)

import { commitEffects } from './core/effects.js';
import { makeRng, hashString } from './core/rng.js';
import { PHASES, TURNS_PER_CYCLE, seasonOf, seasonLabel, sovereignTitle, createNewGame } from './core/state.js';
import { resolveTurn } from './sim/resolver.js';
import { parseOrder, buildCustomOrder } from './sim/orderParser.js';
import { getCrisis, borderOutcome } from './content/crises.js';
import {
  createExpedition, currentBeatId, getBeat, deploymentOffers, duelOutcomeEffects, casualtiesFor, canRetreat, retreatEffects,
} from './content/expedition.js';
import { campfireOffer, getCampfireScene, campfireCompletionEffects, campfireCooldown, CAMPFIRE_MODES } from './content/campfire.js';
import { fallenList } from './content/names.js';
import { res, rel, mem, counter, flag, chron, region } from './content/effectHelpers.js';
import { beginPassing, advancePassing, chooseLegacies, beginNextCycle, passingFarewells, chronicleReadback, passingLegacyOptions } from './cycle/passing.js';

export const ACTION_TYPES = [
  'ISSUE_ORDER',
  'ISSUE_CUSTOM_ORDER',
  'CONTINUE',
  'BEGIN_DEPLOYMENT',
  'EXPEDITION_CHOICE',
  'EXPEDITION_DUEL_COMPLETE',
  'EXPEDITION_RETREAT',
  'START_CAMPFIRE',
  'CAMPFIRE_COMPLETE',
  'TRIAL_START',
  'TRIAL_CANCEL',
  'TRIAL_COMPLETE',
  'APPROVE_CHRONICLE',
  'ABDICATE',
  'PASSING_NEXT',
  'PASSING_CHOOSE_LEGACIES',
  'BEGIN_NEXT_CYCLE',
  'APPLY_AI_EFFECTS',
];

export const TRIAL_FOES = {
  blade_adept: { name: 'Sword-Master Ilvane', epithet: 'Who trained under the Iron Academies, and left' },
  warg_alpha: { name: 'Greymane', epithet: 'An old alpha from the royal menagerie' },
  fallen_champion: { name: 'The Lattice Echo', epithet: 'A sparring shade woven from your own recorded style' },
};

export function newGame(options) {
  return createNewGame(options);
}

function ok(state, extra = {}) {
  return { state, io: extra.io ?? {}, error: null, ...extra };
}

function fail(state, error) {
  return { state, io: {}, error };
}

function commit(state, effects) {
  return commitEffects(state, effects).state;
}

function requirePhase(state, ...phases) {
  return phases.includes(state.phase) ? null : `Not available during ${state.phase.replace('_', ' ')}.`;
}

// ─── View helpers (pure reads the UI can call every render) ─────────────────────────────

/** A campfire offer is available after a resolved turn when the day has weighed enough. */
export function availableCampfire(state) {
  if (state.phase !== PHASES.RESOLUTION) return null;
  const danger = deploymentOffers(state).some((o) => o.danger);
  const offer = campfireOffer(state, { majorResolved: true, immediateDanger: danger });
  return offer.eligible ? offer : null;
}

export function trialKey(state) {
  return `${state.cycle.number}-${state.turn}`;
}

export function getView(state) {
  const base = {
    phase: state.phase,
    season: seasonLabel(state),
    sovereign: sovereignTitle(state),
    cycle: state.cycle.number,
    turn: state.turn,
    turnsPerCycle: TURNS_PER_CYCLE,
  };
  switch (state.phase) {
    case PHASES.WAR_ROOM:
      return {
        ...base,
        crisis: getCrisis(state),
        trial: state.trial,
        trialRewardAvailable: state.trial.lastRewardedKey !== trialKey(state),
      };
    case PHASES.RESOLUTION:
      return {
        ...base,
        report: state.lastResolution,
        // Only the march that ended this turn; older summaries stay in state for the record.
        expedition: state.lastExpedition?.turn === state.turn && state.lastExpedition?.cycle === state.cycle.number ? state.lastExpedition : null,
        deployments: deploymentOffers(state),
        campfire: availableCampfire(state),
        isFinalTurn: state.turn >= TURNS_PER_CYCLE,
      };
    case PHASES.EXPEDITION:
      return { ...base, expedition: state.expedition, beat: getBeat(state), canRetreat: canRetreat(state.expedition) };
    case PHASES.CAMPFIRE:
      return { ...base, offer: state.campfire.offer, scene: getCampfireScene(state, 'enter'), shortScene: getCampfireScene(state, 'short') };
    case PHASES.PASSING:
      return {
        ...base,
        passing: state.passing,
        farewells: passingFarewells(state),
        readback: chronicleReadback(state),
        legacies: passingLegacyOptions(state),
      };
    default:
      return base;
  }
}

// ─── War Room ───────────────────────────────────────────────────────────────────────────

function issueOrder(state, { orderId }) {
  const blocked = requirePhase(state, PHASES.WAR_ROOM);
  if (blocked) return fail(state, blocked);
  const crisis = getCrisis(state);
  const order = crisis.orders.find((o) => o.id === orderId);
  if (!order) return fail(state, `No order "${orderId}" this turn.`);
  if (order.locked) return fail(state, order.locked);
  const { state: next, report } = resolveTurn(state, order);
  return ok(next, { report, io: { autosaveBefore: 'before_resolution', autosave: 'after_resolution' } });
}

function issueCustomOrder(state, { text, interpretation }) {
  const blocked = requirePhase(state, PHASES.WAR_ROOM);
  if (blocked) return fail(state, blocked);
  const clean = String(text ?? '').trim();
  if (clean.length < 3) return fail(state, 'Speak the decree first.');
  const interp = interpretation?.understood ? interpretation : parseOrder(clean);
  if (!interp.understood) return fail(state, interp.summary);
  const crisis = getCrisis(state);
  const order = buildCustomOrder(crisis, interp, clean);
  if (order.locked) return fail(state, order.locked);
  const { state: next, report } = resolveTurn(state, order, { custom: { text: clean, interpretation: interp } });
  return ok(next, { report, interpretation: interp, io: { autosaveBefore: 'before_resolution', autosave: 'after_resolution' } });
}

// Trial of Blades: practice with stakes, from the War Room (Cycle doc §10). Does not end the turn.
export function trialConfig(state, archetypeId = 'blade_adept') {
  const foe = TRIAL_FOES[archetypeId] ?? TRIAL_FOES.blade_adept;
  return {
    archetypeId: TRIAL_FOES[archetypeId] ? archetypeId : 'blade_adept',
    seed: hashString(`${state.campaignId}:trial:${state.cycle.number}:${state.turn}:${state.trial.count ?? 0}`),
    title: foe.name,
    subtitle: foe.epithet,
    modifiers: {
      cycleNumber: state.cycle.number,
      legacies: [...state.cycle.activeLegacies],
      companion: 'mara',
      champion: foe,
      stakes: 'practice',
    },
    allowRetreat: true,
    beat: 'trial',
  };
}

function trialStart(state, { archetypeId }) {
  const blocked = requirePhase(state, PHASES.WAR_ROOM);
  if (blocked) return fail(state, blocked);
  return ok({ ...state, trial: { ...state.trial, pending: trialConfig(state, archetypeId) } });
}

function trialCancel(state) {
  return ok({ ...state, trial: { ...state.trial, pending: null } });
}

function trialComplete(state, { result }) {
  if (!state.trial.pending) return fail(state, 'No Trial of Blades in progress.');
  if (!result || !['victory', 'defeat', 'retreat'].includes(result.outcome)) return fail(state, 'Invalid duel result.');
  const key = trialKey(state);
  const stakes = state.trial.lastRewardedKey !== key; // practice with stakes: once per turn
  const foe = state.trial.pending.title;
  const effects = [];
  if (result.outcome === 'victory') {
    effects.push(counter('duelsWon'), counter('trialWins'));
    if (stakes) {
      effects.push(
        res('readiness', 2),
        rel('mara', { respect: 2 }),
        mem('mara', 'WATCHED_THE_SOVEREIGN_TRAIN', `I watched the Sovereign beat ${foe} in the Trial of Blades.`, 3, 0.5),
      );
      if (!state.flags[`trial_won_${state.cycle.number}`]) {
        effects.push(
          flag(`trial_won_${state.cycle.number}`, true),
          chron('The Trial of Blades', `In ${seasonLabel(state)} the Sovereign stepped into the torch-lit circle and bested ${foe}. The garrison talked about little else for a week.`, 'duel'),
        );
      }
    }
  } else if (result.outcome === 'defeat') {
    effects.push(counter('duelsLost'));
    if (stakes) effects.push(res('readiness', -1)); // minor cost; retry allowed
  } else {
    effects.push(counter('retreats'));
  }
  let s = commit(state, effects);
  s = {
    ...s,
    trial: {
      ...s.trial,
      pending: null,
      count: (s.trial.count ?? 0) + 1,
      lastRewardedKey: stakes && result.outcome !== 'retreat' ? key : s.trial.lastRewardedKey,
      last: { outcome: result.outcome, foe, misreads: result.misreads ?? [], playerHpRemaining: result.playerHpRemaining, stakes },
    },
  };
  return ok(s);
}

/** Chronicler's Pen: approving a detailed entry (Cycle doc §3, §4). */
export function approvalDetail(state, entry) {
  const decision = state.decisions.find((d) => d.cycle === entry.cycle && d.turn === entry.turn);
  const witnesses = state.voices.filter((v) => v.cycle === entry.cycle && v.turn === entry.turn).slice(0, 2);
  const parts = [`Recorded in full in ${seasonOf(entry.turn)} ${entry.year} E.R.`];
  if (decision) parts.push(`The Crown's order that season: "${decision.label}" (${decision.category}).`);
  if (witnesses.length) parts.push(`Witnesses: ${witnesses.map((w) => w.speaker).join('; ')}.`);
  return parts.join(' ');
}

function approveChronicle(state, { entryId }) {
  const entry = state.chronicle.find((e) => e.id === entryId);
  if (!entry) return fail(state, 'No such Chronicle entry.');
  if (entry.approved) return fail(state, 'Already approved.');
  if (entry.cycle !== state.cycle.number) return fail(state, 'Only this reign\'s entries can be approved.');
  const { state: next, report } = commitEffects(state, [{ type: 'approval', entry: entryId, detail: approvalDetail(state, entry) }, counter('chronicleApproved')]);
  if (report.rejected.length) return fail(state, report.rejected[0].reason);
  return ok(next);
}

function abdicate(state) {
  const blocked = requirePhase(state, PHASES.WAR_ROOM, PHASES.RESOLUTION);
  if (blocked) return fail(state, blocked);
  return ok(beginPassing(state, 'abdication'), { io: { autosave: 'after_resolution' } });
}

// ─── Resolution → next turn / Passing ───────────────────────────────────────────────────

export function endTurn(state) {
  if (state.turn >= TURNS_PER_CYCLE) {
    let s = state;
    if (borderOutcome(s) === 'siege' && !s.flags[`laststand_done_${s.cycle.number}`] && !s.flags.sovereign_fell) {
      // The Sovereign did not ride out: the walls hold, at a price.
      s = commit(s, [
        region({ casualties: 12, damage: 25, state: 'AFTERMATH' }),
        res('stability', -5),
        rel('mara', { respect: -4 }),
        chron('The Siege Held Without Its Sovereign', 'The walls of the Marches held through the thaw. Twelve names were added to the wall at Greywater. The Sovereign watched from the Citadel.', 'battle'),
      ]);
    }
    return beginPassing(s, s.flags.sovereign_fell ? 'fall' : 'era');
  }
  const nextTurn = state.turn + 1;
  const wraps = seasonOf(nextTurn) === 'Spring';
  return {
    ...state,
    phase: PHASES.WAR_ROOM,
    turn: nextTurn,
    totalTurns: state.totalTurns + 1,
    year: wraps ? state.year + 1 : state.year,
    campfire: { ...state.campfire, cooldown: Math.max(0, state.campfire.cooldown - 1), offer: null },
    expedition: null,
    trial: { ...state.trial, pending: null },
  };
}

function continueTurn(state) {
  const blocked = requirePhase(state, PHASES.RESOLUTION);
  if (blocked) return fail(state, blocked);
  const next = endTurn(state);
  return ok(next, { io: next.phase === PHASES.PASSING ? { autosave: 'after_resolution' } : {} });
}

// ─── Expeditions ────────────────────────────────────────────────────────────────────────

function beginDeployment(state, { kind }) {
  const blocked = requirePhase(state, PHASES.RESOLUTION);
  if (blocked) return fail(state, blocked);
  const offer = deploymentOffers(state).find((o) => o.kind === kind);
  if (!offer) return fail(state, 'That deployment is not available now.');
  const exp = createExpedition(state, kind);
  return ok({ ...state, phase: PHASES.EXPEDITION, expedition: { ...exp, title: offer.title } }, { io: { autosave: 'expedition' } });
}

function finishExpedition(state) {
  const exp = state.expedition;
  const c = state.cycle.number;
  const effects = [flag(`${exp.kind === 'last_stand' ? 'laststand' : exp.kind}_done_${c}`, true)];
  if (exp.fallen.length) {
    effects.push(
      chron(
        exp.fallen.length === 1 ? 'A Name for the Wall at Greywater' : 'Names for the Wall at Greywater',
        `${exp.fallen.length === 1 ? 'One soldier' : `${exp.fallen.length} soldiers`} did not come home from ${exp.title ?? 'the march'}: ${exp.fallen.join('; ')}.`,
        'loss',
      ),
    );
  }
  let s = commit(state, effects);
  const summary = { kind: exp.kind, title: exp.title, duels: exp.duels, fallen: exp.fallen, picked: exp.picked, log: exp.log, cycle: c, turn: state.turn };
  s = { ...s, expedition: null, lastExpedition: summary };
  if (s.flags.sovereign_fell) return beginPassing({ ...s, phase: PHASES.RESOLUTION }, 'fall');
  const offer = campfireOffer(s, { majorResolved: true, immediateDanger: false });
  if (offer.eligible) return { ...s, phase: PHASES.CAMPFIRE, campfire: { ...s.campfire, offer } };
  return { ...s, phase: PHASES.RESOLUTION };
}

function expeditionChoice(state, { choiceId }) {
  const blocked = requirePhase(state, PHASES.EXPEDITION);
  if (blocked) return fail(state, blocked);
  const exp = state.expedition;
  if (exp.pendingDuel) return fail(state, 'A duel is waiting.');
  const beat = getBeat(state);
  const choice = beat.choices.find((c) => c.id === choiceId);
  if (!choice) return fail(state, 'That choice is not available.');
  if (choice.kind === 'duel') {
    const config = choice.duel(state, exp);
    return ok({ ...state, expedition: { ...exp, pendingDuel: config, pendingChoice: choice.id } });
  }
  let s = commit(state, choice.effects ?? []);
  const entry = { beat: beat.id, choiceId: choice.id, label: choice.label, lines: choice.result ?? [] };
  let nextExp = { ...exp, picked: [...exp.picked, choice.id], log: [...exp.log, entry], lastResult: entry };
  if (choice.kind === 'advance') {
    nextExp = { ...nextExp, index: exp.index + 1, phase: 'main', lastDuel: null };
    s = { ...s, expedition: nextExp };
    if (s.flags.sovereign_fell || nextExp.index >= exp.beats.length) {
      return ok(finishExpedition(s), { io: { autosave: s.flags.sovereign_fell ? 'after_resolution' : 'expedition' } });
    }
    return ok(s);
  }
  return ok({ ...s, expedition: nextExp });
}

function expeditionDuelComplete(state, { result }) {
  const blocked = requirePhase(state, PHASES.EXPEDITION);
  if (blocked) return fail(state, blocked);
  const exp = state.expedition;
  if (!exp.pendingDuel) return fail(state, 'No duel in progress.');
  if (!result || !['victory', 'defeat', 'retreat'].includes(result.outcome)) return fail(state, 'Invalid duel result.');
  const beat = currentBeatId(exp);
  let s = commit(state, duelOutcomeEffects(state, exp, result));
  let fallen = [];
  if (beat === 'champion' || beat === 'skirmish') {
    const dead = casualtiesFor(result, state.regions.southern_marches.state === 'FORTIFIED');
    if (dead) {
      const rng = makeRng(s.rngSeed);
      fallen = fallenList(rng, dead);
      s = { ...s, rngSeed: rng.seed };
    }
  }
  const duelRecord = {
    beat,
    archetypeId: result.archetypeId,
    enemyName: result.enemyName ?? exp.pendingDuel.title,
    outcome: result.outcome,
    playerHpRemaining: result.playerHpRemaining,
    misreads: result.misreads ?? [],
    attempt: (exp.attempts[beat] ?? 0) + 1,
  };
  const nextExp = {
    ...exp,
    pendingDuel: null,
    pendingChoice: null,
    phase: `after_${result.outcome}`,
    attempts: { ...exp.attempts, [beat]: (exp.attempts[beat] ?? 0) + 1 },
    duels: [...exp.duels, duelRecord],
    fallen: [...exp.fallen, ...fallen],
    lastDuel: { ...duelRecord, fallen },
    lastResult: null,
  };
  return ok({ ...s, expedition: nextExp }, { io: { autosave: 'expedition' } });
}

function expeditionRetreat(state) {
  const blocked = requirePhase(state, PHASES.EXPEDITION);
  if (blocked) return fail(state, blocked);
  const exp = state.expedition;
  if (!canRetreat(exp)) return fail(state, 'There is no turning back from here.');
  let s = commit(state, retreatEffects(state, exp));
  s = { ...s, expedition: null, lastExpedition: { kind: exp.kind, title: exp.title, duels: exp.duels, fallen: exp.fallen, picked: exp.picked, log: exp.log, retreated: true, cycle: state.cycle.number, turn: state.turn }, phase: PHASES.RESOLUTION };
  return ok(s, { io: { autosave: 'expedition' } });
}

// ─── Campfire ───────────────────────────────────────────────────────────────────────────

function startCampfire(state) {
  const offer = availableCampfire(state);
  if (!offer) return fail(state, 'There is no campfire tonight.');
  return ok({ ...state, phase: PHASES.CAMPFIRE, campfire: { ...state.campfire, offer } });
}

function campfireComplete(state, { mode = 'enter', responseId } = {}) {
  const blocked = requirePhase(state, PHASES.CAMPFIRE);
  if (blocked) return fail(state, blocked);
  if (!CAMPFIRE_MODES.includes(mode)) return fail(state, `Unknown campfire mode "${mode}".`);
  const sceneId = state.campfire.offer?.sceneId ?? null;
  let s = commit(state, campfireCompletionEffects(state, mode, responseId));
  s = {
    ...s,
    phase: PHASES.RESOLUTION,
    campfire: {
      cooldown: campfireCooldown(),
      offer: null,
      history: [...s.campfire.history, { cycle: s.cycle.number, turn: s.turn, sceneId, mode, responseId: mode === 'enter' ? responseId ?? null : null }],
    },
  };
  return ok(s, { io: { autosave: 'after_campfire' } });
}

// ─── The Passing ────────────────────────────────────────────────────────────────────────

function passingNext(state) {
  const blocked = requirePhase(state, PHASES.PASSING);
  if (blocked) return fail(state, blocked);
  if (state.passing.step === 'legacies' || state.passing.step === 'mantle') return fail(state, 'Choose what survives you first.');
  return ok(advancePassing(state));
}

function passingChoose(state, { ids }) {
  const blocked = requirePhase(state, PHASES.PASSING);
  if (blocked) return fail(state, blocked);
  if (state.passing.step !== 'legacies') return fail(state, 'Not yet.');
  const { state: next, error } = chooseLegacies(state, ids);
  if (error) return fail(state, error);
  return ok(next, { io: { commitDynasty: true } });
}

function nextCycle(state) {
  const blocked = requirePhase(state, PHASES.PASSING);
  if (blocked) return fail(state, blocked);
  if (state.passing.step !== 'mantle') return fail(state, 'Choose what survives you first.');
  return ok(beginNextCycle(state), { io: { autosave: 'cycle_start', commitDynasty: true } });
}

// ─── Optional narrator proposals (Master Build §19: AI may only *request* small changes) ──

function applyAiEffects(state, { effects }) {
  if (!Array.isArray(effects) || !effects.length) return ok(state);
  const { state: next, report } = commitEffects(state, effects.slice(0, 3), { source: 'ai' });
  return ok(next, { rejected: report.rejected });
}

// ─── Dispatch ───────────────────────────────────────────────────────────────────────────

const HANDLERS = {
  ISSUE_ORDER: issueOrder,
  ISSUE_CUSTOM_ORDER: issueCustomOrder,
  CONTINUE: continueTurn,
  BEGIN_DEPLOYMENT: beginDeployment,
  EXPEDITION_CHOICE: expeditionChoice,
  EXPEDITION_DUEL_COMPLETE: expeditionDuelComplete,
  EXPEDITION_RETREAT: expeditionRetreat,
  START_CAMPFIRE: startCampfire,
  CAMPFIRE_COMPLETE: campfireComplete,
  TRIAL_START: trialStart,
  TRIAL_CANCEL: trialCancel,
  TRIAL_COMPLETE: trialComplete,
  APPROVE_CHRONICLE: approveChronicle,
  ABDICATE: abdicate,
  PASSING_NEXT: passingNext,
  PASSING_CHOOSE_LEGACIES: passingChoose,
  BEGIN_NEXT_CYCLE: nextCycle,
  APPLY_AI_EFFECTS: applyAiEffects,
};

/**
 * @param {object} state GameState
 * @param {{type: string}} action
 * @returns {{ state: object, io: {autosave?: string, autosaveBefore?: string, commitDynasty?: boolean}, error: string|null, report?: object }}
 */
export function dispatch(state, action) {
  const handler = HANDLERS[action?.type];
  if (!handler) return fail(state, `Unknown action "${action?.type}".`);
  try {
    return handler(state, action);
  } catch (err) {
    return fail(state, err?.message ?? String(err));
  }
}


