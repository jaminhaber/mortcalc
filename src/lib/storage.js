import { defaults, fieldIds } from "./mortgage.js";

export const storageKey = "mortgage-calculator-values-v1";

export function isStorageAvailable() {
  try {
    const testKey = `${storageKey}-test`;
    localStorage.setItem(testKey, "1");
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

export function saveValues(values) {
  if (!isStorageAvailable()) return;
  localStorage.setItem(storageKey, JSON.stringify(values));
}

export function loadStoredValues() {
  if (!isStorageAvailable()) return null;
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey));
    if (!stored || typeof stored !== "object") return null;
    return {
      ...defaults,
      ...Object.fromEntries(
        Object.entries(stored).filter(([key]) => fieldIds.includes(key))
      )
    };
  } catch {
    return null;
  }
}

export function clearStoredValues() {
  if (isStorageAvailable()) localStorage.removeItem(storageKey);
}
