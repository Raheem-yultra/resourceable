import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ConditionalNavbar } from '@/components/layout/ConditionalNavbar';
import { Providers } from '@/components/layout/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ResourceAble - Special Needs Services Directory',
  description: 'Find quality services for autism, down syndrome, ADHD, and more',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <ConditionalNavbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
