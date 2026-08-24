/**
 * Full-page loading state, used by the route-level `loading.tsx` files.
 *
 * NOTE: there is deliberately no root `app/loading.tsx`. A loading boundary makes
 * Next stream the response — it flushes the fallback with a 200 immediately, so a
 * later `notFound()` can no longer set the status. That turned every missing
 * listing, provider, resource and browse category into a soft 404: correct page,
 * wrong status, and search engines indexing pages that do not exist.
 *
 * So boundaries live only on segments that can never call notFound(): the provider
 * dashboard pages, which are behind auth, do real database work, and are not
 * crawled. Public detail pages render without one so their 404s are real.
 */
export function PageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-4 border-primary/20 border-t-primary" />
        <p className="mt-4 text-muted-foreground text-sm sm:text-base">Loading...</p>
      </div>
    </div>
  );
}
