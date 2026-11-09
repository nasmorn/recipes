import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseRecipe } from '../lib/recipe.mjs';

const good = `---
portionen: 4
quelle: eigenes
tags: [vegan, Suppe]
---
# Suppe

Einleitung.

## Zutaten
### Basis
* 1 l Wasser
* Salz
### Einlage
- 200 g Nudeln

## Zubereitung

Kochen.

## Varianten

Mehr Salz.
`;

test('parses a well-formed recipe', () => {
  const { recipe, errors, warnings } = parseRecipe(good);
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(recipe.title, 'Suppe');
  assert.equal(recipe.portions, 4);
  assert.deepEqual(recipe.tags, ['vegan', 'Suppe']);
  assert.equal(recipe.intro, 'Einleitung.');
  assert.deepEqual(recipe.groups.map((g) => [g.title, g.items.length]), [['Basis', 2], ['Einlage', 1]]);
  assert.deepEqual(recipe.sections.map((s) => s.title), ['Zubereitung', 'Varianten']);
  assert.equal(recipe.groups[1].items[0].line, 15);
});

test('reports missing portions, unparseable lines and non-bullets with line numbers', () => {
  const bad = good.replace('portionen: 4\n', '').replace('* Salz', '* 2 Tbsp Salz').replace('- 200 g Nudeln', '200 g Nudeln');
  const { errors } = parseRecipe(bad);
  const msgs = errors.map((e) => `${e.line}: ${e.message}`);
  assert.equal(errors.length, 3, msgs.join('\n'));
  assert.match(msgs[0], /^1: Portionen fehlen/);
  assert.match(msgs[1], /^12: Zutat "2 Tbsp Salz": amerikanische Einheit/);
  assert.match(msgs[2], /^14: .*keine Aufzählung/);
});

test('requires front matter, title and ingredients', () => {
  assert.match(parseRecipe('# Nur Titel\n').errors.map((e) => e.message).join('|'), /Front Matter fehlt.*Abschnitt "## Zutaten" fehlt/);
  assert.match(parseRecipe('---\nportionen: 2\n---\n## Zutaten\n* Salz\n').errors[0].message, /Titel fehlt/);
  assert.match(parseRecipe('---\nportionen: zwei\n---\n# X\n## Zutaten\n* Salz\n').errors[0].message, /keine positive Zahl/);
  assert.match(parseRecipe('---\nportionen: 2\nfoo: 1\n---\n# X\n## Zutaten\n* Salz\n').errors[0].message, /unbekannter Schlüssel "foo"/);
});

test('every recipe in rezepte/ is valid', () => {
  const dir = new URL('../rezepte/', import.meta.url);
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const { errors } = parseRecipe(readFileSync(new URL(f, dir), 'utf8'));
    assert.deepEqual(errors, [], f);
  }
});
