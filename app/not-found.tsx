import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-8">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-6 sm:p-8">
        <div className="text-center">
          <h1 className="text-7xl sm:text-9xl font-bold text-primary">404</h1>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2 mt-4">
            Page Not Found
          </h2>
          <p className="text-muted-foreground text-sm sm:text-base mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="space-y-3">
            <Button asChild className="w-full min-h-[48px]">
              <Link href="/">
                Go to homepage
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full min-h-[48px]">
              <Link href="/search">
                Search services
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
