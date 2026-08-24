import type { Metadata } from 'next';
import { getPublicBaseUrl } from '@/lib/env';
import './globals.css';
import { ConditionalNavbar } from '@/components/layout/ConditionalNavbar';
import { Providers } from '@/components/layout/Providers';

const SITE_NAME = 'ResourceAble';
const SITE_TITLE = 'ResourceAble - Disability Services Directory';
const SITE_DESCRIPTION =
  'Find trusted disability services and support from verified providers in your community — autism, Down syndrome, ADHD, and more.';

export const metadata: Metadata = {
  // Absolute URLs for Open Graph and the sitemap are resolved against this. It
  // comes from getPublicBaseUrl (never throws) rather than getAppBaseUrl, because
  // this is evaluated during `next build` and a missing NEXTAUTH_URL must not take
  // the whole build down.
  metadataBase: new URL(getPublicBaseUrl()),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  // Families overwhelmingly share providers through messaging apps, where a link
  // with no card is a bare URL nobody clicks. opengraph-image.tsx supplies the
  // picture; these supply everything around it.
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeInitScript = `
    (function() {
      try {
        var storedTheme = localStorage.getItem('theme');
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        var isDark = storedTheme ? storedTheme === 'dark' : prefersDark;
        document.documentElement.classList.toggle('dark', isDark);
      } catch (e) {}
    })();
  `;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-title" content="ResourceAble" />
        <link rel="manifest" href="/site.webmanifest" />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="site-shell">
        <Providers>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded-md focus:shadow"
          >
            Skip to main content
          </a>
          <ConditionalNavbar />
          <main id="main-content" className="relative z-0">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
