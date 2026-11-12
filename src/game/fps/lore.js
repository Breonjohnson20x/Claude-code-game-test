// Words of the Greywater Front: what your council says in your ear, what the enemy left behind
// on paper, and what the Chronicle writes afterwards. All authored; nothing here needs an AI.

export const MISSION = Object.freeze({
  id: 'greywater_front',
  title: 'The Greywater Front',
  season: 'Winter, 412 E.R.',
  place: 'Southern Marches · Greywater Ford',
  brief: [
    'General Drae did not wait for his Chancellor. A walker lance crossed Greywater Ford in the night, took the Elvian checkpoint and lit the supply depot on the far bank.',
    'The First Royal is two days behind you. The families at the checkpoint do not have two days.',
    'You did not send someone. You came.',
  ],
});

/** Lines spoken over the linkstone. `who` is a character id from the main game. */
export const RADIO = Object.freeze({
  start: [
    { who: 'mara', text: 'Linkstone is live, Majesty. The road runs south to a picket, then the checkpoint. I count six at the picket.' },
    { who: 'mara', text: 'For the record, I advised against the Sovereign going first. The record can keep that.' },
  ],
  picket_seen: [{ who: 'mara', text: 'Picket ahead. They use the walls. So should you.' }],
  picket_clear: [
    { who: 'mara', text: 'Picket is down. The checkpoint gate is past the next rise. They will have heard that.' },
    { who: 'vale', text: 'Those carbines of theirs are purely mechanical. Not a thread of Lattice in them. They would call that a virtue.' },
  ],
  checkpoint_seen: [{ who: 'cassian', text: 'One on the watchtower, Majesty. He has been told you never come in person. Correct him.' }],
  checkpoint_clear: [{ who: 'mara', text: 'Yard is ours. The inner gate is barred from this side: there is a winch by the right-hand tower.' }],
  gate_start: [
    { who: 'mara', text: 'Gate is rising. It is not quiet and it is not quick. Hold the yard.' },
    { who: 'cassian', text: 'Reinforcements from the tents. A heavy with them. His pack is the soft part: it is on his back.' },
  ],
  gate_open: [{ who: 'mara', text: 'Gate is up. The ford is below you. So is their walker lamp.' }],
  ford_seen: [
    { who: 'vale', text: 'That searchlight is a walker lamp. If it holds you for a breath, the gun follows. Stay behind stone.' },
    { who: 'sparky', text: '(A low, unhappy chirr. He does not like the river and he likes the lamp less.)' },
  ],
  ford_rush: [{ who: 'mara', text: 'Shock-troopers in the water! Blades, not guns: do not let them close.' }],
  far_bank: [
    { who: 'mara', text: 'Far bank. The depot is burning: our grain, their fuel. The walker is in the yard.' },
    { who: 'vale', text: 'Walkers are armoured where it is easy and jointed where it is not. Break the knees and it has to kneel. Then the hatch is open to you.' },
  ],
  walker_engage: [{ who: 'cassian', text: 'Fuel casks in that yard, Majesty. I would not stand next to one. I would let the walker.' }],
  walker_kneel: [{ who: 'mara', text: 'It is down on its knees! Hatch, hatch, hatch!' }],
  walker_stand: [{ who: 'vale', text: 'It has re-braced. The joints are weaker each time. Again.' }],
  walker_reinforce: [{ who: 'cassian', text: 'More rifles from the back sheds. Drae spends people the way he spends fuel.' }],
  walker_down: [
    { who: 'mara', text: 'Walker is down. The hatch is opening. Majesty: someone is climbing out with their hands up.' },
    { who: 'mara', text: 'Your call. It was always going to be your call.' },
  ],
  low_health: [{ who: 'mara', text: 'You are hit. Get behind something and breathe.' }],
  respawn: [{ who: 'vale', text: 'The Lattice held the thread. Do not ask me how. Go again.' }],
  won: [{ who: 'sparky', text: '(A triumphant shriek from somewhere behind you, and the sound of a ration sack being opened.)' }],
});

/** Papers found on the field. */
export const DISPATCHES = Object.freeze({
  orders: {
    title: 'Royal order, countersigned',
    from: 'General Mara Voss, Commander of the First Royal',
    body: 'The Sovereign will walk the Greywater road in person. I have argued against this in council, in private and once in the stables. I am overruled. Hold the road behind us. If we are not back by dawn, do not send a patrol. Send everyone.',
  },
  picket: {
    title: 'Picket standing orders',
    from: 'Fourth Walker Lance, Iron Syndicate',
    body: 'No sorcery is to be answered with sorcery. We hold this road with powder, steel and discipline, the three things that have never burned a city down. If the Elvian king is seen, report it. He will not be. Kings send other people\'s children.',
  },
  ledger: {
    title: 'A sergeant\'s ledger',
    from: 'Checkpoint duty book',
    body: 'Arden family, four, passed north on the Sovereign\'s own seal. Girl called Mika asked if the walkers have names. Told her no. They do. Ours is called Patience. I did not think that would be funny to a child and I was right.',
  },
  wagon: {
    title: 'A letter, unfinished',
    from: 'An Elvian wagoner',
    body: 'Hesta, the grain is across and I will be home before the frost. There are lights on the far bank that are not ours. The sergeant says it is routine. I have driven this road nineteen years and I have never once seen routine carry a lamp that size.',
  },
  pilot: {
    title: 'Pilot\'s log, walker "Patience"',
    from: 'Lance-Corporal Renn Halder, Fourth Walker Lance',
    body: 'General Drae says the Chancellor will thank us afterwards. Lieutenant Kell would have asked "after what?" and that is why she is not here. I keep the lamp on the ford because I was told to. I keep hoping nobody walks into it.',
  },
});

/** How the Chronicle records the day. */
export function chronicleLine({ spared, deaths, dispatches }) {
  const how = deaths === 0 ? 'and did not fall once' : deaths === 1 ? 'and fell once, and stood again' : `and fell ${deaths} times, and stood again each time`;
  const mercy = spared
    ? 'When the walker knelt, the Sovereign took the pilot\'s surrender and sent her home with her name.'
    : 'When the walker knelt, the Sovereign left the pilot to the General\'s soldiers.';
  const papers = dispatches >= 5 ? ' The Sovereign read every paper the enemy left behind.' : '';
  return `At Greywater Ford the Sovereign walked the frontier road alone ${how}. ${mercy}${papers}`;
}

export const SPEAKERS = Object.freeze({
  mara: 'General Mara Voss',
  vale: 'Dr. Elias Vale',
  cassian: 'Director Cassian Rey',
  sparky: 'Sparky',
});
