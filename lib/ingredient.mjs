// Parses one ingredient line ("200 g Mehl, glatt") into
// { qty: {min, max} | null, unit, name, note, approx, optional, scalable }.
// Throws IngredientError with a human-readable reason when a line can't be parsed.

export { unitLabel } from '../site/scale.js';

export class IngredientError extends Error {}

// canonical unit -> spellings (matched case-insensitively, with or without trailing ".")
const UNIT_SPELLINGS = {
  g: ['g', 'gr', 'gramm'],
  kg: ['kg'],
  mg: ['mg'],
  ml: ['ml'],
  cl: ['cl'],
  dl: ['dl'],
  l: ['l', 'liter'],
  EL: ['el', 'esslöffel'],
  TL: ['tl', 'teelöffel'],
  Msp: ['msp', 'messerspitze', 'messerspitzen'],
  Prise: ['prise', 'prisen'],
  Dose: ['dose', 'dosen'],
  Bund: ['bund'],
  Zehe: ['zehe', 'zehen'],
  Stück: ['stück', 'stk'],
  Stange: ['stange', 'stangen'],
  Zweig: ['zweig', 'zweige'],
  Scheibe: ['scheibe', 'scheiben'],
  Becher: ['becher'],
  Pkg: ['pkg', 'packung', 'packungen', 'pck'],
  Flasche: ['flasche', 'flaschen'],
  Glas: ['glas', 'gläser'],
  Tasse: ['tasse', 'tassen'],
  Spritzer: ['spritzer'],
  Schuss: ['schuss'],
  Handvoll: ['handvoll'],
  Blatt: ['blatt', 'blätter'],
  Würfel: ['würfel'],
  Messlöffel: ['messlöffel'],
  cm: ['cm'],
};

// units whose amount does not change with the portion count
const UNSCALABLE = new Set(['Prise', 'Msp']);

const IMPERIAL = ['tbsp', 'tbs', 'tsp', 'cup', 'cups', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds', 'pint', 'pints', 'quart', 'stick', 'sticks'];

const UNIT_LOOKUP = new Map();
for (const [canon, spellings] of Object.entries(UNIT_SPELLINGS)) {
  for (const s of spellings) UNIT_LOOKUP.set(s, canon);
}

export function lookupUnit(word) {
  return UNIT_LOOKUP.get(word.toLowerCase().replace(/\.$/, '')) ?? null;
}

export function isScalableUnit(unit) {
  return !UNSCALABLE.has(unit);
}

const VULGAR = { '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅛': 0.125, '⅕': 0.2 };
const VULGAR_CLASS = '½⅓⅔¼¾⅛⅕';

// one number: "2", "1,5", "1.5", "1/2", "½", "1 1/2", "1½"
const NUM = `(?:\\d+\\s+\\d+/\\d+|\\d+/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[${VULGAR_CLASS}])?|[${VULGAR_CLASS}])`;
const QTY_RE = new RegExp(`^(${NUM})(?:\\s*[-–]\\s*(${NUM}))?`);

export function parseNumber(s) {
  s = s.trim();
  let m;
  if ((m = s.match(new RegExp(`^(\\d+)\\s*([${VULGAR_CLASS}])$`)))) return +m[1] + VULGAR[m[2]];
  if ((m = s.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return frac(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^(\d+)\/(\d+)$/))) return frac(0, +m[1], +m[2]);
  if (s in VULGAR) return VULGAR[s];
  if (/^\d+(?:[.,]\d+)?$/.test(s)) return parseFloat(s.replace(',', '.'));
  throw new IngredientError(`kann Zahl "${s}" nicht lesen`);
}

function frac(whole, num, den) {
  if (den === 0) throw new IngredientError(`Bruch mit Nenner 0`);
  return whole + num / den;
}

const PREFIXES = [
  [/^(?:etwa|ca\.|circa|ungefähr|~)\s*/i, 'approx'],
  [/^(?:evtl\.|eventuell|optional)\s+/i, 'optional'],
];

export function parseIngredient(line) {
  let rest = line.trim();
  if (!rest) throw new IngredientError('leere Zutat');
  const out = { qty: null, unit: null, modifier: '', name: '', note: '', noteRaw: '', approx: false, optional: false, scalable: true };

  for (let again = true; again; ) {
    again = false;
    for (const [re, flag] of PREFIXES) {
      if (re.test(rest)) { rest = rest.replace(re, ''); out[flag] = true; again = true; }
    }
  }

  const q = rest.match(QTY_RE);
  if (q) {
    const min = parseNumber(q[1]);
    const max = q[2] ? parseNumber(q[2]) : min;
    if (max < min) throw new IngredientError(`Bereich ${q[0]} ist absteigend`);
    if (min <= 0) throw new IngredientError(`Menge muss größer 0 sein`);
    out.qty = { min, max };
    rest = rest.slice(q[0].length);
    if (/^\s*[-–]\s*(?:$|\s)/.test(rest)) throw new IngredientError(`unvollständiger Bereich "${q[0]}-"`);

    // "gehäufte EL", "gestrichener TL": keep the modifier, then read the unit
    const mod = rest.match(/^\s+(gehäufte[rn]?|gestrichene[rn]?)(?=\s)/i);
    if (mod) {
      const after = rest.slice(mod[0].length).match(/^\s+([A-Za-zÄÖÜäöüß]+\.?)(?=[\s(,]|$)/);
      if (after && lookupUnit(after[1])) { out.modifier = mod[1]; rest = rest.slice(mod[0].length); }
    }

    // unit, possibly glued to the number ("200g", "4tl")
    const glued = !/^\s/.test(rest);
    const u = rest.match(/^\s*([A-Za-zÄÖÜäöüß]+\.?)(?=[\s(,]|$)/);
    if (u) {
      const word = u[1];
      const unit = lookupUnit(word);
      if (/^[x×]$/i.test(word)) {
        throw new IngredientError(`"Nx" Schreibweise: bitte als Menge mit Einheit schreiben`);
      } else if (unit) {
        out.unit = unit;
        rest = rest.slice(u[0].length);
      } else if (IMPERIAL.includes(word.toLowerCase().replace(/\.$/, ''))) {
        throw new IngredientError(`amerikanische Einheit "${word}": bitte in g/ml/EL/TL umrechnen`);
      } else if (glued) {
        throw new IngredientError(`unbekannte Einheit "${word}" direkt nach der Zahl`);
      }
    } else if (glued && /^[A-Za-zÄÖÜäöüß]/.test(rest)) {
      throw new IngredientError(`unbekannte Einheit direkt nach der Zahl: "${rest.split(/\s/)[0]}"`);
    } else if (/^\s*[x×]\s/i.test(rest)) {
      throw new IngredientError(`"Nx" Schreibweise: bitte als Menge mit Einheit schreiben`);
    }
  } else {
    // "Prise Salz" / "Bund Petersilie": unit word without a number
    const u = rest.match(/^([A-Za-zÄÖÜäöüß]+\.?)\s+(?=\S)/);
    if (u && lookupUnit(u[1]) && !isScalableUnit(lookupUnit(u[1]))) {
      out.unit = lookupUnit(u[1]);
      rest = rest.slice(u[0].length);
    }
    if (/^\d/.test(rest)) throw new IngredientError(`kann Menge am Anfang von "${rest}" nicht lesen`);
  }

  rest = rest.trim();
  if (out.qty && /^\d/.test(rest)) throw new IngredientError(`zweite Zahl nach der Menge: "${rest}"`);

  // note: everything after the first ", " or the first "(" that isn't at the very start
  const comma = rest.indexOf(', ');
  const paren = rest.indexOf('(');
  let cut = -1;
  if (comma > 0 && (paren <= 0 || comma < paren)) cut = comma;
  else if (paren > 0) cut = paren;
  if (cut > 0) {
    out.name = rest.slice(0, cut).trim();
    out.noteRaw = rest.slice(cut).trim(); // as written, with its "," or "(…)"
    out.note = out.noteRaw.replace(/^,\s*/, '').trim();
    if (out.note.startsWith('(') && out.note.endsWith(')') && !out.note.slice(1, -1).includes('(')) {
      out.note = out.note.slice(1, -1).trim();
    }
  } else {
    out.name = rest;
  }
  if (!out.name) throw new IngredientError('Zutat ohne Namen');
  if (out.name.includes(')') && !out.name.includes('(')) throw new IngredientError('Klammer ohne öffnende Klammer');

  out.scalable = out.qty !== null && (out.unit === null || isScalableUnit(out.unit));
  return out;
}
