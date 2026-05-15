/* ============================================================
   main.js — entry point, level router, nav, tutorial collapse.
   ============================================================ */

(() => {

  const LEVELS = [Level1, Level2, Level3, Level4];
  let active = null;

  // ---------- DOM refs ----------
  const heroEl       = document.getElementById('hero');
  const levelView    = document.getElementById('level-view');
  const levelNav     = document.getElementById('level-nav');
  const backBtn      = document.getElementById('back-btn');
  const startBtn     = document.getElementById('start-btn');
  const levelGrid    = document.getElementById('level-grid');
  const tutorialPane = document.getElementById('tutorial-pane');
  const closeBtn     = document.getElementById('tutorial-close');
  const reopenBtn    = document.getElementById('tutorial-reopen');

  // ---------- level nav ----------

  function buildNav() {
    levelNav.innerHTML = '';
    const label = document.createElement('span');
    label.className = 'nav-label';
    label.textContent = 'Level:';
    levelNav.appendChild(label);

    LEVELS.forEach((lvl) => {
      const btn = document.createElement('button');
      btn.dataset.slug = lvl.slug;
      btn.dataset.id   = String(lvl.id);
      btn.title = lvl.title;
      btn.textContent = `[${lvl.id}]`;
      btn.addEventListener('click', () => attemptGoToLevel(lvl));
      levelNav.appendChild(btn);
    });
    refreshNavState();
  }

  function refreshNavState() {
    [...levelNav.querySelectorAll('button')].forEach(btn => {
      const id = Number(btn.dataset.id);
      const unlocked = Progress.isUnlocked(id);
      btn.classList.toggle('locked', !unlocked);
      btn.classList.toggle('active', active && active.id === id);
    });
  }

  function attemptGoToLevel(lvl) {
    if (!Progress.isUnlocked(lvl.id)) {
      // The user is somewhere where the console exists (we only show nav
      // inside a level view, so console is mounted).
      Console.error('You have not completed the previous level. Please complete the previous level before moving on.');
      return;
    }
    goToLevel(lvl);
  }

  // ---------- navigation ----------

  function goToLevel(lvl) {
    if (active && active.unmount) active.unmount();
    active = lvl;

    heroEl.classList.add('hidden');
    levelView.classList.remove('hidden');

    // Always start with tutorial open on a fresh level mount
    showTutorial();

    // Wipe the canvas host and console so a stub or stale render
    // from the previous level can't bleed into this one.
    const host = document.getElementById('p5-host');
    if (host) host.innerHTML = '';

    lvl.mount();
    refreshNavState();
    history.replaceState(null, '', `#${lvl.slug}`);
  }

  function goHome() {
    if (active && active.unmount) active.unmount();
    active = null;
    levelView.classList.add('hidden');
    heroEl.classList.remove('hidden');
    refreshNavState();
    history.replaceState(null, '', '#');
  }

  // ---------- tutorial collapse ----------

  function hideTutorial() {
    tutorialPane.classList.add('hidden');
    reopenBtn.classList.remove('hidden');
    levelGrid.classList.add('tutorial-collapsed');
  }
  function showTutorial() {
    tutorialPane.classList.remove('hidden');
    reopenBtn.classList.add('hidden');
    levelGrid.classList.remove('tutorial-collapsed');
  }

  closeBtn.addEventListener('click', hideTutorial);
  reopenBtn.addEventListener('click', showTutorial);

  // ---------- progress events ----------

  document.addEventListener('wfr:progress-changed', refreshNavState);

  // ---------- hash deep-link ----------

  function resolveHash() {
    const slug = location.hash.replace('#', '');
    const found = LEVELS.find(l => l.slug === slug);
    if (!found) return;
    if (Progress.isUnlocked(found.id)) {
      goToLevel(found);
    }
    // If locked and arrived via direct hash, silently ignore — we have
    // no console mounted on the hero, so showing the error there is
    // wrong. They'll see it once they enter a level and try the nav.
  }

  // ---------- wiring ----------

  buildNav();
  startBtn.addEventListener('click', () => goToLevel(LEVELS[0]));
  backBtn.addEventListener('click', goHome);
  window.addEventListener('hashchange', resolveHash);
  if (location.hash) resolveHash();
})();