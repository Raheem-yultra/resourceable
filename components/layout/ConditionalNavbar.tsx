'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-2';

/**
 * The site header renders everywhere except the landing page and the auth flow.
 *
 * The landing page has its own full-bleed hero. Every /auth screen is a single
 * task — sign in, create an account, reset a password, verify an address — and the
 * nav sits above the one thing the page is asking for. Each of those screens
 * carries its own link back to the site instead, so none of them is a dead end.
 */
export function ConditionalNavbar() {
  const pathname = usePathname();

  if (pathname === '/' || pathname.startsWith('/auth')) {
    return null;
  }

  return <Header />;
}
