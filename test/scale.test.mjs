import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatQuantity, scaleNote } from '../site/scale.js';

const f = (min, unit, factor, max = min) => { const r = formatQuantity({ min, max }, unit, factor); return `${r.amount} ${r.unit}`.trim(); };

test('metric: whole grams below 100, steps of 5 above, ½ below 10', () => {
  assert.equal(f(200, 'g', 1), '200 g');
  assert.equal(f(200, 'g', 1.5), '300 g');
  assert.equal(f(125, 'g', 1 / 3), '42 g');
  assert.equal(f(140, 'ml', 0.75), '105 ml');
  assert.equal(f(333, 'g', 1), '335 g');
  assert.equal(f(2, 'g', 1.5), '3 g');
  assert.equal(f(4, 'g', 0.25), '1 g');
  assert.equal(f(3, 'g', 0.5), '1,5 g');
});

test('metric: switches to kg / l at 1000', () => {
  assert.equal(f(500, 'g', 3), '1,5 kg');
  assert.equal(f(1, 'kg', 0.5), '500 g');
  assert.equal(f(4, 'l', 1), '4 l');
  assert.equal(f(0.25, 'l', 1), '250 ml');
  assert.equal(f(600, 'g', 1.5, 900), '0,9–1,35 kg');
  assert.equal(f(4, 'l', 2 / 3), '2,65 l');
  assert.equal(f(2, 'cl', 2), '4 cl');
});

test('spoons and counts round to kitchen fractions', () => {
  assert.equal(f(1, 'EL', 1), '1 EL');
  assert.equal(f(1, 'TL', 0.5), '½ TL');
  assert.equal(f(1, 'TL', 0.75), '¾ TL');
  assert.equal(f(1 / 3, 'TL', 1), '⅓ TL');
  assert.equal(f(1 / 8, 'TL', 1), '⅛ TL');
  assert.equal(f(1.5, 'TL', 1), '1½ TL');
  assert.equal(f(5, null, 0.5), '2½');
  assert.equal(f(5, null, 1.3), '6½');
  assert.equal(f(4, null, 4), '16');
  assert.equal(f(1, 'Dose', 2), '2 Dosen');
  assert.equal(f(1, 'Dose', 1), '1 Dose');
  assert.equal(f(1, null, 2, 2), '2–4');
  assert.equal(f(1, null, 0.1, 2), '⅛–¼');
});

test('metric amounts inside notes scale, "à"/"je" amounts do not', () => {
  assert.equal(scaleNote('etwa 35 g', 2), 'etwa 70 g');
  assert.equal(scaleNote('40 g', 0.5), '20 g');
  assert.equal(scaleNote('0,33 l', 2), '660 ml');
  assert.equal(scaleNote('à 480 g abgetropft', 2), 'à 480 g abgetropft');
  assert.equal(scaleNote('in 1,5 cm Spalten', 2), 'in 1,5 cm Spalten');
  assert.equal(scaleNote('M', 2), 'M');
});
