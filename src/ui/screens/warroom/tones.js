// Category accents for the royal orders (War Room cards, medallion rings, Resolution).
// Every accent is a theme token (theme.css), never a new hue.

export const CATEGORY_TONE = {
  diplomacy: { accent: '#f0dc95', deep: '#7d6114', glow: '227 196 99', text: 'text-gold-300', name: 'gold' },
  military: { accent: '#d9726b', deep: '#7a1f1a', glow: '194 65 58', text: 'text-crimson-300', name: 'crimson' },
  clandestine: { accent: '#c3c7cc', deep: '#33373d', glow: '154 160 168', text: 'text-iron-200', name: 'iron' },
  research: { accent: '#ffe9ae', deep: '#7d6114', glow: '255 233 174', text: 'text-lattice-300', name: 'lattice' },
  economic: { accent: '#f4a35e', deep: '#8a3a1c', glow: '224 120 43', text: 'text-ember-300', name: 'ember' },
};

export function categoryTone(category) {
  const first = String(category ?? '').split('+')[0];
  return CATEGORY_TONE[first] ?? CATEGORY_TONE.diplomacy;
}

/** "Economic / Infrastructure" -> "Economic" (the short form for narrow cards). */
export function shortCategoryName(name) {
  return String(name ?? '').split('/')[0].trim();
}

// The illuminated initial for an opening paragraph: a large gilt Cinzel capital, two lines deep,
// with an engraved shadow and a warm glow. No box. Only a paragraph long enough to wrap the
// initial on at least three lines gets one (a short line beside a drop cap reads as a mistake).
const DROP_CAP =
  'first-letter:float-left first-letter:mr-2.5 first-letter:mt-[0.12em] first-letter:font-display first-letter:text-[3.55rem] first-letter:font-semibold first-letter:leading-[0.86] first-letter:text-gold-300 first-letter:[text-shadow:0_1px_0_#4f3d0d,0_2px_0_rgb(0_0_0/0.65),0_0_18px_rgb(227_196_99/0.35)]';

export function dropCapClass(text, minChars = 150) {
  return String(text ?? '').length >= minChars ? DROP_CAP : '';
}
