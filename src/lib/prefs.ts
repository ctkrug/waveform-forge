const STORAGE_PREFIX = "waveform-forge:";

/**
 * Thin, failure-safe wrapper around `localStorage` for small UI preferences
 * (last-used FFT size, export format, ...). `localStorage` can throw in
 * private-browsing modes or be entirely absent (this module is imported by
 * code under test in a non-browser environment), so every access is
 * try/caught and degrades to "preference doesn't persist" rather than
 * breaking the app.
 */
export function readPref(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(STORAGE_PREFIX + key) ?? null;
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // Preference just won't persist across sessions.
  }
}
