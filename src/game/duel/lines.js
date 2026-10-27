// Authored duel lines (no AI needed). Short, in-character, picked by the duel's seeded RNG.
// Speakers: 'narrator' | 'enemy' | 'mara' | 'sparky' | 'cassian'.

export const SPEAKER_NAMES = {
  narrator: '',
  mara: 'General Mara Voss',
  sparky: 'Sparky',
  cassian: 'Cassian (whisper-stone)',
};

export const OPENING_LINES = {
  blade_adept: [
    { speaker: 'enemy', text: 'The Syndicate sends its regards, Majesty. Try to keep up.' },
    { speaker: 'enemy', text: 'Crowns are heavy. Allow me to lighten yours.' },
    { speaker: 'enemy', text: "I've studied your guard. It's honest. That's the problem." },
  ],
  warg_alpha: [
    { speaker: 'narrator', text: 'The Warg Alpha circles the stones, frost smoking from its jaws.' },
    { speaker: 'narrator', text: 'A low growl rolls across the circle. It is in no hurry.' },
  ],
  fallen_champion: {
    aegis: [{ speaker: 'enemy', text: 'I raised that same ward once. It did not save me either.' }],
    warg: [{ speaker: 'enemy', text: 'The wolves taught me patience. Let me teach you.' }],
    shadow: [{ speaker: 'enemy', text: 'You know the shape of a broken oath. So do I.' }],
    generic: [
      { speaker: 'enemy', text: 'I wore that crown before you. Show me why it chose you.' },
      { speaker: 'enemy', text: 'Every cycle ends. Let us see how yours does.' },
    ],
  },
};

export const HESITATION_LINE = { speaker: 'narrator', text: 'It hesitates. It remembers the truce.' };
export const HESITATION_BROKEN_LINE = { speaker: 'narrator', text: 'Steel bites. The memory of the truce goes cold in its eyes.' };

export const ROYAL_LINES = {
  mara: [
    "On your feet, Majesty. I didn't march this far to bury you.",
    'Breathe. Chin up. Now show it who holds this circle.',
    "The First Royal is watching. Let's give them a story worth telling.",
  ],
  mara_oath: [
    'By my oath: not one step back. Strike, and I keep your flank.',
    'I swore you would not fall alone. You will not fall at all.',
  ],
  sparky: [
    'Sparky shrieks and spits acid at its eyes!',
    'Sparky dives in with a furious shriek. Acid hisses across its face!',
    "A young drake's scream splits the night. Sparky spits, and the enemy reels!",
  ],
  cassian: [
    'It repeats itself, Majesty. Count the rhythm, then end it.',
    'My people have watched this one for weeks. It tires before you do.',
  ],
};

export const ROYAL_RALLY_LINE = 'The Sovereign raises the crown. Elvia answers.';
