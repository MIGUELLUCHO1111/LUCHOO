/**
 * Local-storage helpers for the "backend not ready yet" mode.
 * Transactions that are pending in the backend phase keep data in the
 * browser so the flow can be tested today. Once the backend is online the
 * frontend switches to real transactions only.
 */

export const readJSON = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

export const writeJSON = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn("Could not persist to localStorage:", err);
  }
};

/** Does the error mean the backend transaction does not exist yet? */
export const isPendingTransaction = (err) =>
  !err?.response || err.response?.status === 404;