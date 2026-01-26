'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import TextCursorProximity from '@/components/ui/text-cursor-proximity';

export default function HomePage() {
  const router = useRouter();
  const heroRef = useRef<HTMLDivElement>(null);

  const handleSearchClick = () => {
    router.push('/search');
  };

  return (
    <div className="min-h-screen w-full">
      {/* Skip to main content for accessibility */}
      <a href="#main-content" className="skip-to-main">
        Skip to main content
      </a>
      
      <main id="main-content" className="w-full">
        {/* Hero Section with Interactive Text */}
        <section 
          ref={heroRef}
          className="relative w-full min-h-[85vh] flex items-center justify-center px-6 lg:px-12 py-32 overflow-hidden"
          aria-labelledby="hero-title"
        >
          <div className="relative z-10 w-full max-w-7xl">
            <div className="mb-12 flex flex-col items-center gap-2">
              <h1 id="hero-title" className="sr-only">ResourceAble - Connecting Special Needs with Quality Care</h1>
              <TextCursorProximity
                label="ResourceAble"
                className="text-6xl md:text-8xl lg:text-9xl font-bold will-change-transform tracking-tight"
                styles={{
                  transform: {
                    from: "scale(1)",
                    to: "scale(1.15)",
                  },
                  color: {
                    from: "hsl(var(--foreground))",
                    to: "hsl(var(--primary))",
                  },
                }}
                falloff="gaussian"
                radius={150}
                containerRef={heroRef}
              />
              <TextCursorProximity
                label="Connecting Special Needs with Quality Care"
                className="text-2xl md:text-4xl lg:text-5xl font-semibold will-change-transform text-muted-foreground"
                styles={{
                  transform: {
                    from: "scale(1)",
                    to: "scale(1.1)",
                  },
                  color: {
                    from: "hsl(var(--muted-foreground))",
                    to: "hsl(var(--primary))",
                  },
                }}
                falloff="gaussian"
                radius={120}
                containerRef={heroRef}
              />
            </div>
            <p className="text-xl md:text-2xl text-muted-foreground mb-16 max-w-4xl mx-auto text-center leading-relaxed">
              Your trusted platform to discover verified providers offering specialized services for autism, down syndrome,
              ADHD, and other special needs in your community.
            </p>
            <div className="flex flex-col gap-6 items-center">
              <div className="flex gap-6 justify-center flex-wrap">
                <Button 
                  onClick={handleSearchClick}
                  size="lg" 
                  className="text-xl px-10 py-7 h-auto font-semibold min-h-[60px] min-w-[200px]"
                  aria-label="Search for special needs services"
                >
                  Find Services
                </Button>
                <Button 
                  asChild 
                  variant="outline" 
                  size="lg"
                  className="text-xl px-10 py-7 h-auto font-semibold min-h-[60px] min-w-[200px]"
                >
                  <Link href="/auth/signup?role=BUSINESS">List Your Business</Link>
                </Button>
              </div>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="text-lg px-8 py-6 h-auto min-h-[52px]"
              >
                <Link href="/auth/signin">Already have an account? Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="w-full bg-muted py-20" aria-labelledby="how-it-works">
          <div className="w-full px-6 lg:px-12 max-w-7xl mx-auto">
            <h2 id="how-it-works" className="text-4xl font-bold text-center mb-16">How It Works</h2>
            <div className="grid md:grid-cols-3 gap-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 text-primary-foreground text-2xl font-bold" aria-hidden="true">
                  1
                </div>
                <h3 className="text-2xl font-semibold mb-4">Search</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Browse services by location, condition, and type. No account needed to search.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 text-primary-foreground text-2xl font-bold" aria-hidden="true">
                  2
                </div>
                <h3 className="text-2xl font-semibold mb-4">Connect</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Send inquiries or sign in to message providers directly and get personalized support.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-6 text-primary-foreground text-2xl font-bold" aria-hidden="true">
                  3
                </div>
                <h3 className="text-2xl font-semibold mb-4">Get Care</h3>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  Access verified, quality services tailored to your loved one's unique needs.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t py-10" role="contentinfo">
        <div className="w-full px-6 lg:px-12 text-center text-muted-foreground">
          <p className="text-base">&copy; {new Date().getFullYear()} ResourceAble. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
