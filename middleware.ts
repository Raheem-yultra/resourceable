import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

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
        if (path.startsWith('/business/dashboard') || path.startsWith('/business/profile')) {
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
    '/',
    '/admin/:path*', 
    '/business/dashboard/:path*',
    '/business/profile/:path*', 
    '/messages/:path*'
  ],
};
