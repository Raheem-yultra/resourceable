'use client';

import { usePathname } from 'next/navigation';
import { Header } from '@/components/ui/header-2';

export function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide header on landing page
  if (pathname === '/') {
    return null;
  }
  
  // Show header on all other pages
  return <Header />;
}
