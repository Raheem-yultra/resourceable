import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-9xl font-bold text-primary">404</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 mt-4">
            Page Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href="/">
                Go to homepage
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
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
