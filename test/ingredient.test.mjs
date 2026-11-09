import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseIngredient, parseNumber, IngredientError } from '../lib/ingredient.mjs';

const p = parseIngredient;
const q = (line) => { const r = p(line); return [r.qty && [r.qty.min, r.qty.max], r.unit, r.name, r.note]; };

test('numbers: integers, decimals, fractions, unicode, mixed', () => {
  assert.equal(parseNumber('2'), 2);
  assert.equal(parseNumber('1,5'), 1.5);
  assert.equal(parseNumber('1.5'), 1.5);
  assert.equal(parseNumber('1/2'), 0.5);
  assert.equal(parseNumber('½'), 0.5);
  assert.equal(parseNumber('1 1/2'), 1.5);
  assert.equal(parseNumber('1½'), 1.5);
  assert.equal(parseNumber('1 ½'), 1.5);
  assert.throws(() => parseNumber('1/0'), IngredientError);
});

test('quantity + unit + name + note', () => {
  assert.deepEqual(q('200 g Pancetta'), [[200, 200], 'g', 'Pancetta', '']);
  assert.deepEqual(q('200g Pancetta'), [[200, 200], 'g', 'Pancetta', '']);
  assert.deepEqual(q('4tl oregano'), [[4, 4], 'TL', 'oregano', '']);
  assert.deepEqual(q('1EL Mugi Miso'), [[1, 1], 'EL', 'Mugi Miso', '']);
  assert.deepEqual(q('4L Wasser'), [[4, 4], 'l', 'Wasser', '']);
  assert.deepEqual(q('1 Esslöffel Olivenöl'), [[1, 1], 'EL', 'Olivenöl', '']);
  assert.deepEqual(q('1/2 Bund Petersilie glatt'), [[0.5, 0.5], 'Bund', 'Petersilie glatt', '']);
  assert.deepEqual(q('½ TL Salz'), [[0.5, 0.5], 'TL', 'Salz', '']);
  assert.deepEqual(q('1 Dose Tomaten (San Marzano)'), [[1, 1], 'Dose', 'Tomaten', 'San Marzano']);
  assert.deepEqual(q('2 Dosen Kichererbsen'), [[2, 2], 'Dose', 'Kichererbsen', '']);
  assert.deepEqual(q('4 Zehen Knoblauch, gepresst'), [[4, 4], 'Zehe', 'Knoblauch', 'gepresst']);
  assert.deepEqual(q('3 Stück Karotten'), [[3, 3], 'Stück', 'Karotten', '']);
  assert.deepEqual(q('1 Pkg. Backpulver'), [[1, 1], 'Pkg', 'Backpulver', '']);
  assert.deepEqual(q('1 TL Backpulver (4 g)'), [[1, 1], 'TL', 'Backpulver', '4 g']);
  assert.deepEqual(q('2 Eier'), [[2, 2], null, 'Eier', '']);
  assert.deepEqual(q('1 Zwiebel, fein gewürfelt'), [[1, 1], null, 'Zwiebel', 'fein gewürfelt']);
});

test('ranges and approximations', () => {
  assert.deepEqual(q('1 - 2 Dotter (etwa 35 g)'), [[1, 2], null, 'Dotter', 'etwa 35 g']);
  assert.deepEqual(q('3–4 Lorbeerblätter'), [[3, 4], null, 'Lorbeerblätter', '']);
  const r = p('etwa 4 l Wasser');
  assert.equal(r.approx, true);
  assert.deepEqual(r.qty, { min: 4, max: 4 });
  assert.equal(p('ca. 4 l Wasser').approx, true);
  const o = p('evtl. 3 reife Paradeiser');
  assert.equal(o.optional, true);
  assert.equal(o.name, 'reife Paradeiser');
});

test('no quantity: stays unscaled', () => {
  for (const line of ['Salz', 'Pfeffer, frisch gemahlen', 'Butter für die Pfanne']) {
    const r = p(line);
    assert.equal(r.qty, null);
    assert.equal(r.scalable, false);
  }
  const prise = p('Prise Salz');
  assert.equal(prise.unit, 'Prise');
  assert.equal(prise.name, 'Salz');
  assert.equal(prise.scalable, false);
  assert.equal(p('1 Prise Salz').scalable, false, 'a pinch stays a pinch');
  assert.equal(p('2 EL Öl').scalable, true);
});

test('modifiers before the unit', () => {
  const r = p('2 gehäufte EL Mehl');
  assert.equal(r.unit, 'EL');
  assert.equal(r.modifier, 'gehäufte');
  assert.equal(r.name, 'Mehl');
});

test('errors name the problem', () => {
  const bad = {
    '1 1/2 lbs potatoes': /amerikanische Einheit/,
    '3 Tbsp flour': /amerikanische Einheit/,
    '5Gg Paprika': /unbekannte Einheit/,
    '2x480g Bohnen': /unbekannte Einheit|Nx/,
    '2 x Bohnen': /Nx/,
    '2 - Dosen': /unvollständiger Bereich/,
    '4 - 2 Eier': /absteigend/,
    '0 g Salz': /größer 0/,
    '200 g': /ohne Namen/,
    '': /leer/,
  };
  for (const [line, re] of Object.entries(bad)) {
    assert.throws(() => p(line), (e) => e instanceof IngredientError && re.test(e.message), line);
  }
});
