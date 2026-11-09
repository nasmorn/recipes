// Tiny fuzzy matcher for the quick-switcher. Pure functions, no DOM.

// Lowercases, strips accents (ä→a, é→e), ß→ss. Returns the normalized
// string plus, for each normalized char, the index of the original char.
export function normalize(s) {
  let out = '';
  const map = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i].toLowerCase();
    c = c === 'ß' ? 'ss' : c.normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const ch of c) { out += ch; map.push(i); }
  }
  return { text: out, map };
}

const isWordStart = (t, i) => i === 0 || /[\s\-–(,/]/.test(t[i - 1]);

// Scores one query token against a normalized text. Returns { score, idx } or null.
// Substring matches beat scattered (subsequence) matches; word starts beat the middle.
export function matchToken(token, text) {
  const at = text.indexOf(token);
  if (at >= 0) {
    // prefer a word-start occurrence if there is one
    let best = at;
    for (let i = at; i >= 0; i = text.indexOf(token, i + 1)) if (isWordStart(text, i)) { best = i; break; }
    const idx = Array.from(token, (_, k) => best + k);
    return { score: 100 + (isWordStart(text, best) ? 40 : 0) + (best === 0 ? 20 : 0) + token.length * 2 - best * 0.2, idx };
  }
  if (token.length < 2) return null;
  // subsequence, greedily jumping to word starts when possible; must begin at a word start
  const idx = [];
  let from = 0;
  while (from < text.length && !(text[from] === token[0] && isWordStart(text, from))) from++;
  if (from >= text.length) return null;
  for (const ch of token) {
    let pos = -1;
    for (let i = from; i < text.length; i++) {
      if (text[i] !== ch) continue;
      if (pos < 0) pos = i;
      if (isWordStart(text, i)) { pos = i; break; }
      if (idx.length && i === idx[idx.length - 1] + 1) { pos = i; break; }
    }
    if (pos < 0) return null;
    idx.push(pos);
    from = pos + 1;
  }
  let gaps = 0, starts = 0;
  for (let k = 0; k < idx.length; k++) {
    if (k && idx[k] !== idx[k - 1] + 1) gaps++;
    if (isWordStart(text, idx[k])) starts++;
  }
  const spread = idx[idx.length - 1] - idx[0] + 1 - idx.length;
  const score = 60 + starts * 8 - gaps * 6 - spread * 0.5;
  return score > 0 ? { score, idx } : null;
}

// entries: [{ title, tags[], ingredients[] }] (already normalized via prepare()).
export function prepare(entry) {
  const nt = normalize(entry.t);
  return {
    ...entry,
    nt,
    ng: entry.g.map((x) => normalize(x).text),
    ni: entry.i.map((x) => normalize(x).text),
  };
}

// Returns [{ entry, score, hl: Set<originalTitleIndex>, via: ingredient name | null }] best first.
export function search(prepared, query) {
  const tokens = normalize(query.trim()).text.split(/\s+/).filter(Boolean);
  if (!tokens.length) return prepared.map((entry) => ({ entry, score: 0, hl: new Set(), via: null }));
  const results = [];
  for (const entry of prepared) {
    let total = 0;
    const hl = new Set();
    let via = null;
    let ok = true;
    for (const tok of tokens) {
      let best = 0;
      const t = matchToken(tok, entry.nt.text);
      if (t) best = t.score;
      if (entry.ng.some((g) => g.startsWith(tok))) best = Math.max(best, 70);
      let ingHit = null;
      if (tok.length >= 2) {
        for (let k = 0; k < entry.ni.length; k++) {
          const at = entry.ni[k].indexOf(tok);
          if (at >= 0) { const s = 50 + (isWordStart(entry.ni[k], at) ? 15 : 0); if (s > best) { best = s; ingHit = entry.i[k]; } }
        }
      }
      if (!best) { ok = false; break; }
      if (t && t.score >= best) t.idx.forEach((i) => hl.add(entry.nt.map[i]));
      else if (ingHit) via = ingHit;
      total += best;
    }
    if (ok) results.push({ entry, score: total, hl, via });
  }
  return results.sort((a, b) => b.score - a.score || a.entry.t.localeCompare(b.entry.t, 'de'));
}
