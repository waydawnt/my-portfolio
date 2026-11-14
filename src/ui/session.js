// Session-only storage. Falls back to memory when sessionStorage is unavailable
// (private mode, blocked site data), so features keep working for the current page.
const memory = new Map();

export const session = {
  get(key) {
    try {
      const v = sessionStorage.getItem(key);
      if (v !== null) return v;
    } catch { /* unavailable */ }
    return memory.has(key) ? memory.get(key) : null;
  },
  set(key, value) {
    memory.set(key, String(value));
    try { sessionStorage.setItem(key, String(value)); } catch { /* unavailable */ }
  },
};
