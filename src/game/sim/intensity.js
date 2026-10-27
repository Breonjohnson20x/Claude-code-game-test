// NarrativeIntensity (Master Build §22) and Campfire eligibility (§23).
// Intensity is 0–100 and never shown to the player as a number.

export const INTENSITY = {
  minor_conflict: 8,
  major_combat: 18,
  revelation: 12,
  betrayal: 15,
  death: 20,
  major_victory: 14,
  major_defeat: 16,
  personal_confrontation: 10,
};

export const CAMPFIRE_THRESHOLD = 55;
export const CAMPFIRE_COOLDOWN_TURNS = 2;

export function intensityEffect(kind, reason = kind) {
  return { type: 'intensity', delta: INTENSITY[kind] ?? 0, reason };
}

// Natural decay after stabilization: quiet turns lower the temperature.
export function stabilizationEffects(state, { majorEventsThisTurn }) {
  if (majorEventsThisTurn > 0) return [];
  const drop = state.intensity > 70 ? -10 : -6;
  return [{ type: 'intensity', delta: drop, reason: 'stabilization' }];
}

/**
 * Campfires are earned emotional cooldowns, never random:
 *   NarrativeIntensity is high AND a major situation has resolved or stabilized
 *   AND there is no immediate danger requiring player action AND the cooldown allows it.
 */
export function campfireEligibility(state, { majorResolved, immediateDanger }) {
  const reasons = [];
  if (state.intensity < CAMPFIRE_THRESHOLD) reasons.push('the day has not weighed enough yet');
  if (!majorResolved) reasons.push('nothing has been settled');
  if (immediateDanger) reasons.push('danger is still close');
  if (state.campfire.cooldown > 0) reasons.push('a campfire was held recently');
  return { eligible: reasons.length === 0, reasons };
}
