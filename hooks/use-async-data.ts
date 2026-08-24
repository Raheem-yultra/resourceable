'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface AsyncResource<T> {
  /** Last successfully loaded payload; kept during a refetch and after an error. */
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Refetch on demand — call from an event handler (after saving, deleting, ...). */
  reload: () => void;
}

/**
 * Load data for the current `deps`, and again whenever they change.
 *
 * Two things here are deliberate.
 *
 * `loading` is DERIVED, not stored. Every component that grew this pattern by hand
 * opened its loader with `setLoading(true)` and called it straight from an effect,
 * which is a state write during the effect body — React's set-state-in-effect rule
 * flags it, and on mount it is pure waste because `loading` already starts true.
 * Comparing the settled request against the current one gives the same spinner for
 * free: a change in `deps` moves the key, so `loading` is true again with no write
 * at all, and the only setState left happens after the fetch resolves.
 *
 * Every request is also ABORTED when deps change or the component unmounts. None of
 * the hand-rolled versions did this, so a fast sequence of filter changes raced:
 * whichever response happened to land last won, even if it answered an older query.
 * That is a wrong answer on screen, not just wasted work.
 */
export function useAsyncData<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  fallbackError = 'Something went wrong'
): AsyncResource<T> {
  // Held in a ref so callers can pass an inline closure without it retriggering the
  // fetch — `deps` alone decides when to reload. Updated in an effect declared
  // before the fetching one, so it is current by the time that effect runs.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  const [nonce, setNonce] = useState(0);
  const requestKey = `${JSON.stringify(deps)}#${nonce}`;

  const [settled, setSettled] = useState<{
    key: string | null;
    data: T | null;
    error: string | null;
  }>({ key: null, data: null, error: null });

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const data = await fetcherRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setSettled({ key: requestKey, data, error: null });
      } catch (err) {
        // An abort is this hook cancelling its own request, never a real failure.
        if (controller.signal.aborted) return;
        setSettled((prev) => ({
          key: requestKey,
          // Keep whatever was on screen rather than blanking it out on a failure.
          data: prev.data,
          error: err instanceof Error ? err.message : fallbackError,
        }));
      }
    })();

    return () => controller.abort();
  }, [requestKey, fallbackError]);

  return {
    data: settled.data,
    // Only report an error belonging to the request currently being displayed.
    error: settled.key === requestKey ? settled.error : null,
    loading: settled.key !== requestKey,
    reload: useCallback(() => setNonce((n) => n + 1), []),
  };
}
