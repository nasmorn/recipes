import { prepare, search } from './fuzzy.js';

const data = JSON.parse(document.getElementById('index').textContent).map(prepare);
const input = document.getElementById('q');
const list = document.getElementById('list');
const count = document.getElementById('count');
let results = [];
let active = 0;

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function highlight(title, hl) {
  if (!hl.size) return esc(title);
  let out = '';
  for (let i = 0; i < title.length; i++) out += hl.has(i) ? `<mark>${esc(title[i])}</mark>` : esc(title[i]);
  return out.replace(/<\/mark><mark>/g, '');
}

function render() {
  const q = input.value;
  results = search(data, q);
  active = Math.min(active, Math.max(results.length - 1, 0));
  list.innerHTML = results.map((r, i) => `<li${i === active && q ? ' class="active"' : ''}><a href="${r.entry.s}.html"${i === active && q ? ' aria-current="true"' : ''}><span class="t">${highlight(r.entry.t, r.hl)}</span><span class="m">${esc(r.via ? `mit ${r.via}` : r.entry.g.join(' · '))}</span></a></li>`).join('');
  count.textContent = q ? (results.length ? `${results.length} von ${data.length}` : 'Nichts gefunden') : `${data.length} Rezepte`;
  try { sessionStorage.setItem('q', q); } catch {}
}

function move(d) {
  if (!results.length) return;
  active = (active + d + results.length) % results.length;
  render();
  list.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
}

input.addEventListener('input', () => { active = 0; render(); });
input.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) { e.preventDefault(); move(1); }
  else if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) { e.preventDefault(); move(-1); }
  else if (e.key === 'Enter') { const r = results[active]; if (r) location.href = `${r.entry.s}.html`; }
  else if (e.key === 'Escape') { input.value = ''; active = 0; render(); }
});
// typing anywhere focuses the search; "/" too
document.addEventListener('keydown', (e) => {
  if (document.activeElement === input || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') { e.preventDefault(); input.focus(); input.select(); }
  else if (e.key.length === 1 && /\S/.test(e.key)) input.focus();
});

try { const q = sessionStorage.getItem('q'); if (q) input.value = q; } catch {}
render();
if (matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus();
window.addEventListener('pageshow', (e) => { if (e.persisted) render(); });
