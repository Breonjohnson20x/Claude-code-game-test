// Ceremony words for the Passing (Cycle doc §2, §8). The game owns every outcome; this file only
// holds the framing lines, shaded by how the reign ended: a fall grieves, an abdication is quiet,
// an era closes.

export const STEPS = [
  { id: 'campfire', numeral: 'I', label: 'The Last Fire' },
  { id: 'chronicle', numeral: 'II', label: 'The Chronicle' },
  { id: 'legacies', numeral: 'III', label: 'What Survives You' },
  { id: 'mantle', numeral: 'IV', label: 'The Mantle Passes' },
];

export function stepIndex(step) {
  const i = STEPS.findIndex((s) => s.id === step);
  return i < 0 ? 0 : i;
}

const TONES = {
  fall: {
    accent: 'ember',
    eyebrow: (who) => `The Fall of ${who}`,
    seal: 'The Lattice held the thread.',
    campfire:
      'They carried you back from the Siege of the Marches and laid you by the fire. The Lattice held the thread — it always does — but tonight belongs to the ones still breathing.',
    chronicle: 'The scribes read your reign back as the world will tell it: unfinished, interrupted, and still yours.',
    legacies: 'Your body fell at the Siege. What you built does not have to.',
    mantle: 'The Lattice held the thread. It will weave you again, decades from now, in a world that grieved and kept going.',
  },
  abdication: {
    accent: 'stone',
    eyebrow: (who) => `${who} lays down the crown`,
    seal: 'You stood up from the chair. No one asked you to.',
    campfire: 'The fire is small tonight, and nobody hurries. The Council still does not know what to do with its hands.',
    chronicle: 'A reign that ends by choice is read back slowly. The scribes take care with it.',
    legacies: 'You gave the crown back. Decide what you keep of it.',
    mantle: 'You gave the crown back. The Lattice will give it to you again — later, in a world that has had time to wonder why.',
  },
  era: {
    accent: 'gold',
    eyebrow: (who) => `An era closes · ${who}`,
    seal: 'Five seasons turned. The era is written.',
    campfire: 'An era closes the way winter does: slowly, then all at once. The fire is lit one last time.',
    chronicle: 'The Chronicle is read back in the world’s words — not as you meant it, but as it was remembered.',
    legacies: 'The era is over. One or two things may cross with you.',
    mantle: 'The era is written. The Lattice will weave you again, in a world that kept living without you.',
  },
};

export function toneFor(cause) {
  return TONES[cause] ?? TONES.era;
}

export const LEGACY_PROMPT = 'You cannot keep everything. That choice is the build, and it is also the story you are telling about yourself.';
export const NONE_LINE = 'Everything becomes history instead.';
export const WEAVE_LINE = 'The Lattice weaves you again…';
