// Player preferences: mouse sensitivity, bot difficulty and volume, kept in localStorage.
const KEY = 'ashgate.settings';
const DEFAULTS = { sensitivity: 1, difficulty: 'veteran', volume: 0.7 };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode: keep in memory */ }
}
