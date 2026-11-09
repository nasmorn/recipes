#!/usr/bin/env node
// Validates every recipe in rezepte/. Exit code 1 on any error.
//   node validate.mjs            all recipes
//   node validate.mjs -v         also list warnings
//   node validate.mjs file.md …  only these files
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseRecipe } from './lib/recipe.mjs';

const args = process.argv.slice(2);
const verbose = args.includes('-v');
const files = args.filter((a) => !a.startsWith('-'));
const dir = new URL('./rezepte/', import.meta.url).pathname;
const targets = files.length ? files : readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => join(dir, f));

let errorCount = 0, warnCount = 0, clean = 0, ingredients = 0;
const titles = new Map();
for (const path of targets) {
  const rel = relative(process.cwd(), path);
  const { recipe, errors, warnings } = parseRecipe(readFileSync(path, 'utf8'), { file: rel });
  ingredients += recipe.groups.reduce((a, g) => a + g.items.length, 0);
  if (recipe.title) {
    if (titles.has(recipe.title)) errors.push({ line: 1, message: `Titel "${recipe.title}" gibt es schon in ${titles.get(recipe.title)}` });
    titles.set(recipe.title, rel);
  }
  for (const e of errors) console.log(`${rel}:${e.line}: Fehler: ${e.message}`);
  if (verbose) for (const w of warnings) console.log(`${rel}:${w.line}: Hinweis: ${w.message}`);
  errorCount += errors.length;
  warnCount += warnings.length;
  if (!errors.length) clean++;
}
console.log(`\n${targets.length} Rezepte, ${clean} fehlerfrei, ${ingredients} Zutatenzeilen gelesen, ${errorCount} Fehler, ${warnCount} Hinweise${verbose ? '' : ' (-v zeigt sie)'}`);
process.exit(errorCount ? 1 : 0);
