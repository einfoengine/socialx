/*
 * Browser-held portal preferences: the theme, and which sidebar groups are open.
 *
 * Both live outside React (one on <html>, one in localStorage), so they are read
 * through useSyncExternalStore rather than copied into state inside an effect.
 * That is not a lint workaround: an effect that calls setState on mount renders
 * twice and briefly shows the wrong answer, and with the theme that is a visible
 * flash of the other skin.
 *
 * getServerSnapshot returns the default, so the server and the first client
 * render agree and hydration stays quiet.
 */

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ---------------- theme ---------------- */

export const themeStore = {
  subscribe(listener: () => void) {
    const unsub = subscribe(listener);
    // Another tab can change this too.
    window.addEventListener("storage", listener);
    return () => {
      unsub();
      window.removeEventListener("storage", listener);
    };
  },
  getSnapshot(): boolean {
    return document.documentElement.classList.contains("dark");
  },
  getServerSnapshot(): boolean {
    // Light is the product default; the init script in the root layout has
    // already applied dark before paint when it was chosen.
    return false;
  },
  toggle(next: boolean) {
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* private mode: the choice simply will not persist */
    }
    emit();
  },
};

/* ---------------- sidebar groups ---------------- */

export type RailState = Record<string, boolean>;

const railCache = new Map<string, RailState>();

function readRail(key: string): RailState {
  const cached = railCache.get(key);
  if (cached) return cached;

  let parsed: RailState = {};
  try {
    const raw = localStorage.getItem(key);
    if (raw) parsed = JSON.parse(raw) as RailState;
  } catch {
    /* fresh start */
  }
  // Cached so getSnapshot returns a stable reference; returning a fresh object
  // every call makes useSyncExternalStore loop forever.
  railCache.set(key, parsed);
  return parsed;
}

export const railStore = {
  subscribe,
  getSnapshot(key: string): RailState {
    return readRail(key);
  },
  getServerSnapshot(): RailState {
    return EMPTY;
  },
  set(key: string, next: RailState) {
    railCache.set(key, next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* private mode */
    }
    emit();
  },
};

const EMPTY: RailState = {};
