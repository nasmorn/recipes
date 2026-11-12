// Keeps the installed app current without a manual refresh: when the app comes
// back to the foreground (and every 15 min while open), compare this page's
// build with version.json. Reload when nothing would be lost, otherwise offer it.
(() => {
  const BUILD = document.querySelector('meta[name="build"]')?.content;
  if (!BUILD) return;

  if ('serviceWorker' in navigator) {
    // a new build took over: reload once so CSS/JS match the fresh page
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded && !busy()) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' });
  }

  // scaled portions or ticked ingredients: don't throw that away unasked
  function busy() {
    return !!document.querySelector('main.scaled, .ingredients li.done');
  }

  function banner() {
    if (document.querySelector('.update-banner')) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'update-banner';
    b.textContent = 'Rezepte wurden aktualisiert – tippen zum Laden';
    b.addEventListener('click', () => location.reload());
    document.body.append(b);
  }

  let checking = false;
  async function check() {
    if (checking || document.visibilityState !== 'visible' || !navigator.onLine) return;
    checking = true;
    try {
      const res = await fetch('version.json', { cache: 'no-store' });
      const { build } = await res.json();
      if (!build || build === BUILD) return;
      (await navigator.serviceWorker?.getRegistration())?.update();
      // guard against a reload loop if the CDN serves the old page a bit longer
      let tried = null;
      try { tried = sessionStorage.getItem('reloadedFor'); } catch {}
      if (busy() || tried === build) { banner(); return; }
      try { sessionStorage.setItem('reloadedFor', build); } catch {}
      location.reload();
    } catch { /* offline or flaky: try again next time */ } finally {
      checking = false;
    }
  }

  document.addEventListener('visibilitychange', check);
  addEventListener('pageshow', (e) => { if (e.persisted) check(); });
  addEventListener('online', check);
  setInterval(check, 15 * 60 * 1000);
  setTimeout(check, 2000);
})();
