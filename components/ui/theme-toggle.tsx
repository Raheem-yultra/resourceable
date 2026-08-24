'use client';

import * as React from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * The dark class on <html> is the single source of truth for the theme — it is set
 * before React loads by the inline script in app/layout.tsx, so nothing in React
 * owns it. This subscribes to that element rather than keeping a private copy.
 *
 * Two things fall out of doing it this way. The toggle no longer renders once with
 * a guessed value and then corrects itself on mount. And the header renders TWO of
 * these (desktop nav + mobile menu): with local state each held its own `isDark`,
 * so toggling one left the other showing the wrong icon and the wrong aria-label
 * until something else re-rendered it. Both now read the same store.
 */
function subscribeToTheme(onStoreChange: () => void) {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });
  return () => observer.disconnect();
}

const getThemeSnapshot = () => document.documentElement.classList.contains('dark');

// No document on the server. React renders this value, then re-reads the real one
// after hydration — the same visible outcome as the old mount effect, minus the
// hand-rolled setState.
const getThemeServerSnapshot = () => false;

export function useIsDarkTheme() {
  return React.useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getThemeServerSnapshot);
}

export function ThemeToggle() {
  const isDark = useIsDarkTheme();

  const toggleTheme = () => {
    // Write to the DOM only. The MutationObserver above turns that into a render,
    // for this toggle and every other subscriber.
    const nextIsDark = !isDark;
    document.documentElement.classList.toggle('dark', nextIsDark);
    localStorage.setItem('theme', nextIsDark ? 'dark' : 'light');
  };

  return (
    <Button
      type="button"
      // `ghost`, not `outline`: every other control in the nav is ghost, so an
      // outlined box around this one read as a separate widget bolted on rather
      // than one more nav item.
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun /> : <Moon />}
    </Button>
  );
}
