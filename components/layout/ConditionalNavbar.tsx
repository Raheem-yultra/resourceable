'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-2';

// Routes that render without the site header. The landing page has its own
// full-bleed hero; signup is a single-task screen where the nav is a distraction
// from the one thing the page is asking for.
const HEADERLESS_ROUTES = ['/', '/auth/signup'];

export function ConditionalNavbar() {
  const pathname = usePathname();

  if (HEADERLESS_ROUTES.includes(pathname)) {
    return null;
  }

  return <Header />;
}
