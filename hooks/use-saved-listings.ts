'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * Listings the visitor has saved for later.
 *
 * The heart on every card has existed for a long time as `useState(false)`: it
 * filled in, and the moment you scrolled to the next page or opened a listing it
 * was empty again. Nothing was ever written anywhere. A control that forgets
 * instantly is worse than no control — a parent comparing eight therapists ticks
 * four of them, comes back, and finds their shortlist gone.
 *
 * This stores the shortlist in localStorage rather than the database, on purpose.
 * The site's own pitch is "no account needed to search", and shortlisting is
 * exactly the moment a family is comparing providers — before they have any
 * reason to sign up. Requiring an account to save a listing would put the wall
 * precisely where the value is. (The `Favorite` table exists but is keyed on
 * businessId, not listing, so it cannot express this without a migration; when
 * accounts do become the right home for it, this hook is the single seam.)
 *
 * `useSyncExternalStore` rather than per-component state so that every heart for
 * the same listing — the card in the grid, the one on the detail page, the count
 * in the header — moves together, and so that a second tab stays in step.
 */

const STORAGE_KEY = 'resourceable:saved-listings';
const MAX_SAVED = 200;

type Listener = () => void;
const listeners = new Set<Listener>();

/**
 * Cached parse of what is in storage.
 *
 * useSyncExternalStore compares snapshots by identity and re-reads on every
 * render, so returning a freshly-parsed array each time would loop forever. The
 * cache is rebuilt only when something actually writes.
 */
let cache: string[] | null = null;

function read(): string[] {
  if (cache) return cache;
  if (typeof window === 'undefined') return (cache = []);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    // Corrupt or unavailable storage (private mode, quota, hand-edited value).
    // Saving is a convenience; losing it must never break browsing.
    cache = [];
  }
  return cache;
}

function write(next: string[]) {
  cache = next.slice(0, MAX_SAVED);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // Out of quota or blocked — keep the in-memory list so the session still works.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  // Another tab writing the same key: drop the cache so the next read re-parses.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      cache = null;
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * The snapshot the server (and the hydrating client) sees.
 *
 * Identity matters, not just emptiness: because this exact array is returned only
 * by `getServerSnapshot`, comparing against it tells us whether React is still
 * rendering the hydration pass. That is what `hydrated` means below — derived
 * from the store rather than from a `useState` + `useEffect(() => setState(true))`
 * pair, which would be a synchronous state write inside an effect and an extra
 * render for every consumer.
 */
const SERVER_SNAPSHOT: string[] = [];

export function useSavedListings() {
  // The server has no localStorage. useSyncExternalStore is built for exactly
  // this: it renders the server snapshot through hydration, then re-renders with
  // the real one — so markup matches and no manual gate is needed.
  const saved = useSyncExternalStore(subscribe, read, () => SERVER_SNAPSHOT);
  const hydrated = saved !== SERVER_SNAPSHOT;

  const toggle = useCallback((id: string) => {
    const current = read();
    write(current.includes(id) ? current.filter((v) => v !== id) : [id, ...current]);
  }, []);

  const remove = useCallback((id: string) => {
    write(read().filter((v) => v !== id));
  }, []);

  const clear = useCallback(() => write([]), []);

  return {
    /** Ids, newest first. Empty until hydrated, so SSR and the first paint agree. */
    saved,
    isSaved: (id: string) => saved.includes(id),
    hydrated,
    toggle,
    remove,
    clear,
  };
}
