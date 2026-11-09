// Shared by the build (Node) and the recipe pages (browser): rescaling and
// formatting quantities with kitchen-friendly rounding.

const DISPLAY = {
  Prise: ['Prise', 'Prisen'], Dose: ['Dose', 'Dosen'], Zehe: ['Zehe', 'Zehen'],
  Stange: ['Stange', 'Stangen'], Zweig: ['Zweig', 'Zweige'], Scheibe: ['Scheibe', 'Scheiben'],
  Flasche: ['Flasche', 'Flaschen'], Glas: ['Glas', 'Gläser'], Tasse: ['Tasse', 'Tassen'],
  Blatt: ['Blatt', 'Blätter'], Pkg: ['Pkg.', 'Pkg.'], Msp: ['Msp.', 'Msp.'],
};

export function unitLabel(unit, amount) {
  if (!unit) return '';
  const d = DISPLAY[unit];
  if (!d) return unit;
  return amount !== null && amount > 1 ? d[1] : d[0];
}

const METRIC = { mg: ['mg', 1], g: ['g', 1], kg: ['g', 1000], ml: ['ml', 1], cl: ['ml', 10], dl: ['ml', 100], l: ['ml', 1000] };

const FRACTIONS = [[0.125, '⅛'], [0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1 / 3, '⅓'], [2 / 3, '⅔']];

function decimal(n, digits) {
  return String(+n.toFixed(digits)).replace('.', ',');
}

function roundTo(n, step) {
  return Math.round(n / step) * step;
}

// Rounds a metric amount and picks g/kg or ml/l. Returns [value, unit].
function metric(value, unit) {
  if (unit === 'mg') return [Math.round(value), 'mg'];
  const [base, f] = METRIC[unit];
  let v = value * f;
  if (base === 'g' && v >= 1000) return [roundTo(v, 50) / 1000, 'kg'];
  if (base === 'ml' && v >= 1000 && unit !== 'cl' && unit !== 'dl') return [roundTo(v, 50) / 1000, 'l'];
  if (unit === 'cl' || unit === 'dl') return [roundSmall(value), unit];
  if (v < 10) v = roundTo(v, 0.5);
  else if (v < 100) v = Math.round(v);
  else v = roundTo(v, 5);
  return [v, base];
}

// counts, spoons, cans …: eighths below ½, quarters (or exact thirds) below 3, halves below 10, whole above
function roundSmall(v) {
  if (v < 3) {
    const thirds = roundTo(v, 1 / 3);
    if (thirds > 0 && Math.abs(thirds - v) < 0.02) return thirds; // ⅓ TL Salz stays ⅓
    if (v < 0.5) return Math.max(roundTo(v, 0.125), 0.125);
    return roundTo(v, 0.25);
  }
  if (v < 10) return roundTo(v, 0.5);
  return Math.round(v);
}

export function formatNumber(v, unit) {
  if (unit === 'kg' || unit === 'l') return decimal(v, 2);
  if (METRIC[unit]) return decimal(v, 1);
  const whole = Math.floor(v + 1e-9);
  const rest = v - whole;
  if (rest < 0.01) return String(whole);
  for (const [f, glyph] of FRACTIONS) {
    if (Math.abs(rest - f) < 0.01) return (whole ? whole : '') + glyph;
  }
  return decimal(v, 1);
}

// Formats {min,max} × factor with unit. Returns { amount, unit } strings.
export function formatQuantity(qty, unit, factor = 1) {
  if (!qty) return { amount: '', unit: unit ? unitLabel(unit, null) : '' };
  const one = (v) => {
    v *= factor;
    if (unit && METRIC[unit]) {
      const [rv, ru] = metric(v, unit);
      return [rv, ru];
    }
    return [roundSmall(v), unit];
  };
  const [a, ua] = one(qty.min);
  if (qty.max === qty.min) return { amount: formatNumber(a, ua), unit: unitLabel(ua, a) };
  const [b, ub] = one(qty.max);
  let lo = a;
  if (ua !== ub) {
    // range crosses 1000 g / 1000 ml: express the lower bound in kg / l too
    lo = roundTo(qty.min * factor * METRIC[unit][1], 50) / 1000;
  }
  const fa = formatNumber(lo, ub);
  const fb = formatNumber(b, ub);
  return { amount: fa === fb ? fb : `${fa}–${fb}`, unit: unitLabel(ub, b) };
}

// Scales metric amounts inside a note ("(40 g)", "etwa 35g"), except "à 480 g" / "je 200 g".
const NOTE_RE = /(^|[^\wà])((?:à|je)\s+)?(\d+(?:[.,]\d+)?)\s?(mg|g|kg|ml|cl|dl|l)\b/g;

export function scaleNote(note, factor) {
  if (!note || factor === 1) return note;
  return note.replace(NOTE_RE, (all, pre, per, num, unit) => {
    if (per) return all;
    const { amount, unit: u } = formatQuantity({ min: parseFloat(num.replace(',', '.')), max: parseFloat(num.replace(',', '.')) }, unit, factor);
    return `${pre}${amount} ${u}`;
  });
}
