// Deterministic name pools. Every name is drawn through the seeded RNG so a save
// replays the same soldiers, the same heirs, the same incarnation names.

const GIVEN = [
  'Aldric', 'Bren', 'Cassia', 'Dovan', 'Elske', 'Fennick', 'Garet', 'Hollis', 'Ilsa', 'Joren',
  'Kestra', 'Lio', 'Maren', 'Nils', 'Orla', 'Pell', 'Quill', 'Rhosyn', 'Sefton', 'Tamsin',
  'Ulric', 'Vesna', 'Wren', 'Yara', 'Corin', 'Ada', 'Teodor', 'Sabeth', 'Mikkel', 'Rue',
];

const FAMILY = [
  'Ashdown', 'Brightwater', 'Carrow', 'Dunmere', 'Eastholt', 'Fallow', 'Greaves', 'Harrow', 'Ivers', 'Kell',
  'Larkspur', 'Morrow', 'Northam', 'Oakes', 'Penhallow', 'Quarry', 'Redfern', 'Stroud', 'Thorne', 'Underhill',
  'Vance', 'Whitlock', 'Yarrow', 'Cobb', 'Marlowe', 'Hale',
];

const HOMES = ['Harrowmere', 'Aldmoor', 'Greywater', 'Kestrel Point', 'Highbarrow', 'Saltmarch', 'Brennick', 'the Citadel wards'];

const REGNAL = [
  'Seraphine', 'Caedmon', 'Ysolde', 'Tiberian', 'Oriel', 'Maelis', 'Corvane', 'Isembard', 'Lucinde', 'Aurelian',
  'Valeria', 'Theron', 'Elowen', 'Dorian', 'Sabeline',
];

const ORDINALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];

export function soldierName(rng) {
  return `${rng.pick(GIVEN)} ${rng.pick(FAMILY)}`;
}

export function fallenList(rng, count) {
  const names = new Set();
  let guard = 0;
  while (names.size < count && guard++ < 200) {
    names.add(`${soldierName(rng)} of ${rng.pick(HOMES)}`);
  }
  return [...names];
}

// A new incarnation's regnal name; repeats a name only with a higher ordinal.
export function incarnationName(rng, previous = []) {
  const name = rng.pick(REGNAL);
  const used = previous.filter((p) => p.name === name).length;
  return { name, ordinal: ORDINALS[Math.min(used, ORDINALS.length - 1)] };
}

export function familyName(rng) {
  return rng.pick(FAMILY);
}

export function givenName(rng) {
  return rng.pick(GIVEN);
}
