import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

// Named proxy.ts, not middleware.ts: Next 16 deprecated the middleware file
// convention in favour of proxy. Same contract — a default-exported handler plus
// a `config.matcher` — so next-auth's withAuth wrapper is used exactly as before.
// This file is the route gate for /admin and the provider pages; the server-side
// checks in lib/admin.ts and each API route remain the real authority.

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    // Don't redirect authenticated users from landing page
    // Let them view it if they want to
    // (Removed automatic redirect to search/dashboard)

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ req, token }) => {
        const path = req.nextUrl.pathname;

        // Admin routes - strict check
        if (path.startsWith('/admin')) {
          return token?.role === 'ADMIN';
        }

        // Business routes - allow ADMIN or BUSINESS
        if (
          path.startsWith('/business/dashboard') ||
          path.startsWith('/business/profile') ||
          path.startsWith('/business/listings')
        ) {
          return token?.role === 'BUSINESS' || token?.role === 'ADMIN';
        }

        // Messages - any authenticated user
        if (path.startsWith('/messages')) {
          return !!token;
        }

        return true;
      },
    },
  }
);

export const config = {
  matcher: [
    '/admin/:path*',
    '/business/dashboard/:path*',
    '/business/profile/:path*',
    '/business/listings/:path*',
    '/messages/:path*'
  ],
};
