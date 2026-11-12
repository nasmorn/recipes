#!/usr/bin/env node
// Builds the static site into dist/. Fails if any recipe has errors.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseRecipe } from './lib/recipe.mjs';
import { renderMarkdown, escapeHtml as h } from './lib/markdown.mjs';
import { formatQuantity } from './site/scale.js';

const root = new URL('.', import.meta.url).pathname;
const src = join(root, 'rezepte');
const out = join(root, 'dist');
const SITE_TITLE = 'Rezepte';

// ---------- load ----------
const recipes = [];
let failed = false;
for (const f of readdirSync(src).filter((f) => f.endsWith('.md')).sort()) {
  const { recipe, errors } = parseRecipe(readFileSync(join(src, f), 'utf8'), { file: `rezepte/${f}` });
  for (const e of errors) { console.error(`rezepte/${f}:${e.line}: Fehler: ${e.message}`); failed = true; }
  recipe.slug = f.replace(/\.md$/, '');
  if (!recipe.private) recipes.push(recipe);
}
if (failed) { console.error('Build abgebrochen: erst `npm run validate` grün machen.'); process.exit(1); }
const collator = new Intl.Collator('de');
recipes.sort((a, b) => collator.compare(a.title, b.title));

// ---------- html helpers ----------
function page({ title, body, depthPrefix = '', description = '' }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${h(title)}</title>
${description ? `<meta name="description" content="${h(description)}">` : ''}
<meta name="theme-color" content="#b4532a">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="${SITE_TITLE}">
<link rel="stylesheet" href="style.css">
</head>
<body>
${body}
<script>
if ('serviceWorker' in navigator) {
  // a new build took over: reload once so CSS/JS match the fresh page
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded) { reloaded = true; location.reload(); }
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
}
</script>
</body>
</html>
`;
}

function ingredientHtml(it) {
  const { amount, unit } = formatQuantity(it.qty, it.unit, 1);
  const flags = [it.approx ? 'ca.' : '', it.optional ? 'evtl.' : ''].filter(Boolean).join(' ');
  const attrs = it.scalable
    ? ` data-min="${it.qty.min}" data-max="${it.qty.max}" data-unit="${h(it.unit ?? '')}" data-pre="${h(flags)}" data-mod="${h(it.modifier)}"`
    : '';
  const unitText = [it.modifier, unit].filter(Boolean).join(' ');
  const qtyText = [flags, amount, unitText].filter(Boolean).join(' ');
  const note = it.noteRaw ? (it.noteRaw.startsWith('(') ? ' ' : '') + it.noteRaw : '';
  return `<li${attrs}><span class="q">${h(qtyText)}</span> <span class="n">${h(it.name)}</span><span class="note"${it.scalable ? ` data-note="${h(note)}"` : ''}>${h(note)}</span></li>`;
}

function sourceHtml(r) {
  if (!r.source && !r.url) return '';
  const label = r.source || r.url;
  if (r.url) return `<p class="source">Quelle: <a href="${h(r.url)}" rel="noopener">${h(label)}</a></p>`;
  return `<p class="source">Quelle: ${h(label === 'eigenes' ? 'eigenes Rezept' : label)}</p>`;
}

function recipePage(r) {
  const unitName = r.portionUnit;
  const groups = r.groups.map((g) => `${g.title ? `<h3>${h(g.title)}</h3>` : ''}<ul class="ingredients">${g.items.map(ingredientHtml).join('')}</ul>`).join('\n');
  const sections = r.sections.filter((s) => s.body).map((s) => `<section><h2>${h(s.title)}</h2>${renderMarkdown(s.body)}</section>`).join('\n');
  const body = `
<header class="bar">
  <a class="back" href="./" aria-label="Alle Rezepte">←<span> Alle Rezepte</span></a>
  <button class="wake" type="button" hidden aria-pressed="false" title="Bildschirm nicht abdunkeln">☀︎<span> wach halten</span></button>
</header>
<main class="recipe" data-portions="${r.portions}">
  <h1>${h(r.title)}</h1>
  ${r.tags.length ? `<p class="tags">${r.tags.map((t) => `<span>${h(t)}</span>`).join('')}</p>` : ''}
  ${r.intro ? `<div class="intro">${renderMarkdown(r.intro)}</div>` : ''}
  <section class="zutaten">
    <h2>Zutaten</h2>
    <div class="portions" role="group" aria-label="Portionen">
      <button type="button" class="minus" aria-label="weniger">−</button>
      <label><input type="number" inputmode="decimal" min="0.5" step="any" value="${r.portions}" aria-label="${h(unitName)}"> <span>${h(unitName)}</span></label>
      <button type="button" class="plus" aria-label="mehr">+</button>
      <button type="button" class="reset" hidden>zurück auf ${r.portions}</button>
    </div>
    ${r.estimated ? `<p class="hint">Portionenzahl geschätzt.</p>` : ''}
    ${groups}
  </section>
  ${sections}
  ${sourceHtml(r)}
</main>
<script type="module" src="recipe.js"></script>`;
  return page({ title: `${r.title} · ${SITE_TITLE}`, body, description: `${r.title}: Zutaten für ${r.portions} ${unitName}` });
}

function indexPage() {
  const index = recipes.map((r) => ({
    t: r.title,
    s: r.slug,
    g: r.tags,
    i: [...new Set(r.groups.flatMap((g) => g.items.map((it) => it.name)))],
  }));
  const list = recipes.map((r) => `<li><a href="${r.slug}.html"><span class="t">${h(r.title)}</span><span class="m">${h(r.tags.join(' · '))}</span></a></li>`).join('\n');
  const body = `
<main class="home">
  <h1>${SITE_TITLE}</h1>
  <div class="search">
    <input id="q" type="search" placeholder="Suchen: Titel oder Zutat …" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Rezepte suchen" aria-controls="list" enterkeyhint="go">
    <kbd class="kbd-hint" aria-hidden="true">/</kbd>
  </div>
  <p class="count" id="count" aria-live="polite">${recipes.length} Rezepte</p>
  <ul id="list" class="list">
${list}
  </ul>
</main>
<script id="index" type="application/json">${JSON.stringify(index).replace(/</g, '\\u003c')}</script>
<script type="module" src="search.js"></script>`;
  return page({ title: SITE_TITLE, body, description: `${recipes.length} Rezepte` });
}

// ---------- write ----------
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of ['style.css', 'search.js', 'recipe.js', 'scale.js', 'fuzzy.js']) cpSync(join(root, 'site', f), join(out, f));
cpSync(join(root, 'site', 'icons'), join(out, 'icons'), { recursive: true });

const files = { 'index.html': indexPage() };
for (const r of recipes) files[`${r.slug}.html`] = recipePage(r);
files['manifest.webmanifest'] = JSON.stringify({
  name: SITE_TITLE,
  short_name: SITE_TITLE,
  lang: 'de',
  start_url: './',
  scope: './',
  display: 'standalone',
  background_color: '#fbf6ef',
  theme_color: '#b4532a',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2);
for (const [name, content] of Object.entries(files)) writeFileSync(join(out, name), content);

// service worker: precache everything; the version changes whenever any file does
const all = [];
const walk = (dir, prefix = '') => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(dir, e.name), `${prefix}${e.name}/`);
    else all.push(`${prefix}${e.name}`);
  }
};
walk(out);
all.sort();
const hash = createHash('sha256');
for (const f of all) hash.update(f).update(readFileSync(join(out, f)));
const version = hash.digest('hex').slice(0, 12);
const precache = ['./', ...all];
writeFileSync(join(out, 'sw.js'), readFileSync(join(root, 'site', 'sw.js'), 'utf8')
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache)));

console.log(`dist/: ${recipes.length} Rezepte, ${all.length + 1} Dateien, Cache-Version ${version}`);
