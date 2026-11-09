// Parses a recipe file:
//
//   ---
//   portionen: 4
//   quelle: eigenes
//   tags: [pasta, vegan]
//   ---
//   # Titel
//
//   Optionaler Einleitungstext.
//
//   ## Zutaten
//   ### Für den Teig        (optionale Gruppen)
//   * 250 g Mehl
//
//   ## Zubereitung
//   Fließtext …
//
//   ## Varianten           (beliebige weitere Abschnitte)
//
// Returns { recipe, errors, warnings }; errors/warnings are { line, message }.

import { parseIngredient, IngredientError } from './ingredient.mjs';

const KNOWN_KEYS = new Set(['portionen', 'einheit', 'geschätzt', 'quelle', 'url', 'tags', 'privat']);

export function parseFrontMatter(lines, errors) {
  const data = {};
  if (lines[0]?.trim() !== '---') {
    errors.push({ line: 1, message: 'Front Matter fehlt (Datei muss mit "---" beginnen)' });
    return { data, bodyStart: 0 };
  }
  let i = 1;
  for (; i < lines.length && lines[i].trim() !== '---'; i++) {
    const raw = lines[i];
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const m = raw.match(/^([\wäöüÄÖÜß]+):\s*(.*)$/);
    if (!m) { errors.push({ line: i + 1, message: `Front Matter: kann "${raw}" nicht lesen (erwartet "schlüssel: wert")` }); continue; }
    const [, key, value] = m;
    if (!KNOWN_KEYS.has(key)) errors.push({ line: i + 1, message: `Front Matter: unbekannter Schlüssel "${key}" (erlaubt: ${[...KNOWN_KEYS].join(', ')})` });
    data[key] = parseValue(value);
  }
  if (i >= lines.length) {
    errors.push({ line: 1, message: 'Front Matter wird nicht mit "---" geschlossen' });
    return { data, bodyStart: lines.length };
  }
  return { data, bodyStart: i + 1 };
}

function parseValue(v) {
  v = v.replace(/\s+#.*$/, '').trim();
  if (v.startsWith('[') && v.endsWith(']')) {
    return v.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
  }
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+(?:[.,]\d+)?$/.test(v)) return parseFloat(v.replace(',', '.'));
  return unquote(v);
}

function unquote(s) {
  return s.replace(/^(["'])(.*)\1$/, '$2');
}

export function parseRecipe(text, { file = '' } = {}) {
  const errors = [];
  const warnings = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const { data, bodyStart } = parseFrontMatter(lines, errors);

  const recipe = {
    file,
    title: '',
    portions: null,
    portionUnit: typeof data.einheit === 'string' ? data.einheit : 'Portionen',
    estimated: data['geschätzt'] === true,
    source: typeof data.quelle === 'string' ? data.quelle : '',
    url: typeof data.url === 'string' ? data.url : '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    private: data.privat === true,
    intro: '',
    groups: [], // { title, items: [{ ...ingredient, raw, line }] }
    sections: [], // { title, body } (markdown), Zubereitung first
  };

  if (typeof data.portionen === 'number' && data.portionen > 0) recipe.portions = data.portionen;
  else errors.push({ line: 1, message: data.portionen === undefined ? 'Portionen fehlen (Front Matter "portionen: 4")' : `Portionen "${data.portionen}" ist keine positive Zahl` });
  if (!recipe.source) warnings.push({ line: 1, message: 'Quelle fehlt (Front Matter "quelle: eigenes" o.ä.)' });

  let section = null; // current ## section title
  let buf = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    if (section === null) recipe.intro = body;
    else if (section !== 'Zutaten') recipe.sections.push({ title: section, body });
    buf = [];
  };

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i];
    const n = i + 1;
    let m;
    if ((m = line.match(/^#\s+(.+)$/))) {
      if (recipe.title) errors.push({ line: n, message: 'zweiter Titel ("# …")' });
      recipe.title = m[1].trim();
      continue;
    }
    if ((m = line.match(/^##\s+(.+)$/))) {
      flush();
      section = m[1].trim();
      if (section === 'Zutaten') recipe.groups.push({ title: '', items: [] });
      continue;
    }
    if (section === 'Zutaten') {
      if (!line.trim()) continue;
      if ((m = line.match(/^###\s+(.+)$/))) {
        const last = recipe.groups[recipe.groups.length - 1];
        if (last.items.length === 0 && !last.title) last.title = m[1].trim();
        else recipe.groups.push({ title: m[1].trim(), items: [] });
        continue;
      }
      if ((m = line.match(/^\s*[*-]\s+(.*)$/))) {
        try {
          const ing = parseIngredient(m[1]);
          recipe.groups[recipe.groups.length - 1].items.push({ ...ing, raw: m[1].trim(), line: n });
        } catch (e) {
          if (!(e instanceof IngredientError)) throw e;
          errors.push({ line: n, message: `Zutat "${m[1].trim()}": ${e.message}` });
        }
        continue;
      }
      errors.push({ line: n, message: `Zeile im Abschnitt Zutaten ist keine Aufzählung ("* …"): "${line.trim()}"` });
      continue;
    }
    buf.push(line);
  }
  flush();

  recipe.groups = recipe.groups.filter((g) => g.items.length || g.title);
  if (!recipe.title) errors.push({ line: bodyStart + 1, message: 'Titel fehlt ("# Titel")' });
  const count = recipe.groups.reduce((a, g) => a + g.items.length, 0);
  if (!recipe.groups.length) errors.push({ line: bodyStart + 1, message: 'Abschnitt "## Zutaten" fehlt' });
  else if (count === 0 && !errors.some((e) => e.message.startsWith('Zutat'))) errors.push({ line: bodyStart + 1, message: 'keine Zutaten' });
  const prep = recipe.sections.find((s) => s.title === 'Zubereitung');
  if (!prep || !prep.body) warnings.push({ line: bodyStart + 1, message: 'Zubereitung fehlt' });
  if (recipe.url && !/^https?:\/\//.test(recipe.url)) errors.push({ line: 1, message: `url "${recipe.url}" ist keine http(s)-Adresse` });

  return { recipe, errors, warnings };
}
