import type { Metadata } from 'next';
import { SavedListings } from '@/components/search/SavedListings';

export const metadata: Metadata = {
  title: 'Saved listings - ResourceAble',
  description: 'The providers, products, and programs you have saved to compare later.',
  // A shortlist is personal and lives on the visitor's own device — there is
  // nothing here for a crawler to index, and following it would just be a 0-result page.
  robots: { index: false, follow: false },
};

export default function SavedPage() {
  return <SavedListings />;
}
