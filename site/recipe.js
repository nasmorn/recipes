import { formatQuantity, scaleNote } from './scale.js';

const main = document.querySelector('main.recipe');
const base = parseFloat(main.dataset.portions);
const input = main.querySelector('.portions input');
const reset = main.querySelector('.portions .reset');
const items = [...main.querySelectorAll('.ingredients li[data-min]')];

function apply(n) {
  if (!(n > 0)) return;
  const factor = n / base;
  for (const li of items) {
    const unit = li.dataset.unit || null;
    const { amount, unit: u } = formatQuantity({ min: +li.dataset.min, max: +li.dataset.max }, unit, factor);
    li.querySelector('.q').textContent = [li.dataset.pre, amount, li.dataset.mod, u].filter(Boolean).join(' ');
    const note = li.querySelector('.note');
    note.textContent = scaleNote(note.dataset.note, factor);
  }
  reset.hidden = Math.abs(n - base) < 1e-9;
  main.classList.toggle('scaled', !reset.hidden);
}

function step(d) {
  const n = parseFloat(input.value) || base;
  // halves below 2, wholes above
  const next = d > 0 ? (n < 2 ? Math.floor(n * 2 + 1e-9) / 2 + 0.5 : Math.floor(n + 1e-9) + 1)
                     : (n <= 2 ? Math.ceil(n * 2 - 1e-9) / 2 - 0.5 : Math.ceil(n - 1e-9) - 1);
  if (next <= 0) return;
  input.value = next;
  apply(next);
}

main.querySelector('.plus').addEventListener('click', () => step(1));
main.querySelector('.minus').addEventListener('click', () => step(-1));
input.addEventListener('input', () => apply(parseFloat(input.value.replace(',', '.'))));
reset.addEventListener('click', () => { input.value = base; apply(base); });

// tap an ingredient to tick it off while cooking
main.addEventListener('click', (e) => {
  const li = e.target.closest('.ingredients li');
  if (li) li.classList.toggle('done');
});

document.addEventListener('keydown', (e) => {
  if (e.target === input || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '+' || e.key === '=') step(1);
  else if (e.key === '-') step(-1);
  else if (e.key === 'Escape' || e.key === '/') location.href = './';
});

// keep the screen on while cooking (where supported)
const wake = document.querySelector('.wake');
if ('wakeLock' in navigator) {
  let lock = null;
  wake.hidden = false;
  const set = async (on) => {
    try {
      if (on) { lock = await navigator.wakeLock.request('screen'); lock.addEventListener('release', () => { if (!document.hidden) set(false); }); }
      else { await lock?.release(); lock = null; }
    } catch { lock = null; }
    wake.setAttribute('aria-pressed', String(!!lock));
  };
  wake.addEventListener('click', () => set(!lock));
  document.addEventListener('visibilitychange', () => { if (!document.hidden && wake.getAttribute('aria-pressed') === 'true' && !lock) set(true); });
}
