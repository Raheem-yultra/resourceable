'use client';
import React from 'react';

/**
 * True once the page is scrolled past `threshold`.
 *
 * Uses useSyncExternalStore rather than an effect that seeds state on mount. The
 * effect version had to render once with `false` and then immediately setState to
 * the real value, which is both a wasted render and a visible flash for anyone
 * landing on an already-scrolled page (a reload partway down, or a #fragment
 * link). useSyncExternalStore reads the true value during the first client render
 * instead, and React handles the hydration handoff via getServerSnapshot.
 */
export function useScroll(threshold: number) {
	const subscribe = React.useCallback((onStoreChange: () => void) => {
		window.addEventListener('scroll', onStoreChange, { passive: true });
		return () => window.removeEventListener('scroll', onStoreChange);
	}, []);

	// Returns a boolean, so React's identity check compares by value — no caching
	// needed to avoid an infinite resubscribe loop.
	const getSnapshot = React.useCallback(() => window.scrollY > threshold, [threshold]);

	// There is no scroll position on the server; the client corrects this on hydration.
	const getServerSnapshot = React.useCallback(() => false, []);

	return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
