/* ============================================================
   progress.js — completion tracking via localStorage.
   ============================================================ */

const Progress = (() => {
  const KEY = 'wfr_completed_v1';

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) {
      return {};
    }
  }

  function save(state) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (_) { /* ignore quota / private-mode errors */ }
  }

  let state = load();

  return {
    isComplete(levelId) {
      return !!state[levelId];
    },
    markComplete(levelId) {
      state[levelId] = true;
      save(state);
    },
    /** Level N is unlocked iff all preceding levels are complete. */
    isUnlocked(levelId) {
      if (levelId <= 1) return true;
      for (let i = 1; i < levelId; i++) {
        if (!state[i]) return false;
      }
      return true;
    },
    reset() {
      state = {};
      save(state);
    },
  };
})();
