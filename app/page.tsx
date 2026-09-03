'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BROWSE_CATEGORIES } from '@/lib/listing-taxonomy';
import TextCursorProximity from '@/components/ui/text-cursor-proximity';
import { ThemeToggle } from '@/components/ui/theme-toggle';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Stethoscope, HeartHandshake, ShoppingBag, GraduationCap, CalendarDays, UserRound,
};

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-screen w-full overflow-x-hidden">
      <div className="fixed right-4 top-4 z-50">
        <ThemeToggle />
      </div>
      <div className="w-full">
        {/* Hero Section with Interactive Text */}
        <section 
          ref={heroRef}
          className="relative w-full min-h-[calc(100vh-4rem)] sm:min-h-[85vh] flex items-center justify-center px-4 sm:px-6 lg:px-12 py-12 sm:py-20 lg:py-32 overflow-hidden"
          aria-labelledby="hero-title"
        >
          <div className="relative z-10 w-full max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
            <div className="mb-6 sm:mb-8 lg:mb-12 flex flex-col items-center gap-1 sm:gap-2">
              <h1 id="hero-title" className="sr-only">ResourceAble - Connecting you with trusted disability services</h1>
              <TextCursorProximity
                label="ResourceAble"
                className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-bold will-change-transform tracking-tight text-center"
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
                label="Connecting You with Trusted Disability Services"
                className="text-base sm:text-xl md:text-2xl lg:text-4xl xl:text-5xl font-semibold will-change-transform text-muted-foreground text-center px-2"
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
            <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground mb-8 sm:mb-12 lg:mb-16 max-w-4xl mx-auto text-center leading-relaxed px-2">
              Your trusted platform to discover verified providers offering specialized services in your community.
            </p>
            <div className="flex flex-col gap-4 sm:gap-6 items-center px-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 lg:gap-6 justify-center w-full sm:w-auto">
                {/* Native link (not onClick+router.push) so it works even before
                    hydration completes — this page's animation JS loads last. */}
                <Button
                  asChild
                  size="lg"
                  className="text-base sm:text-lg lg:text-xl px-6 sm:px-8 lg:px-10 py-4 sm:py-5 lg:py-7 h-auto font-semibold min-h-[48px] sm:min-h-[56px] lg:min-h-[60px] w-full sm:w-auto sm:min-w-[180px] lg:min-w-[200px]"
                >
                  <Link href="/browse" aria-label="Find disability services">Find Services</Link>
                </Button>
                <Button 
                  asChild 
                  variant="outline" 
                  size="lg"
                  className="text-base sm:text-lg lg:text-xl px-6 sm:px-8 lg:px-10 py-4 sm:py-5 lg:py-7 h-auto font-semibold min-h-[48px] sm:min-h-[56px] lg:min-h-[60px] w-full sm:w-auto sm:min-w-[180px] lg:min-w-[200px]"
                >
                  <Link href="/auth/signup?role=BUSINESS">List Your Business</Link>
                </Button>
              </div>
              <Button
                asChild
                variant="ghost"
                size="lg"
                className="text-sm sm:text-base lg:text-lg px-4 sm:px-6 lg:px-8 py-3 sm:py-4 lg:py-6 h-auto min-h-[44px] sm:min-h-[48px] lg:min-h-[52px]"
              >
                <Link href="/auth/signin">Already have an account? Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* Where to actually start.
            The site header is hidden on this page — the hero is full-bleed and the
            nav sat on top of it — so until now the only ways off the landing page
            were "Find Services", "List Your Business", and "Sign In". Every browse
            category the nav offers on every other page was unreachable from the
            one page most visitors arrive on. */}
        <section className="w-full py-12 sm:py-16" aria-labelledby="browse-heading">
          <div className="w-full px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
            <h2 id="browse-heading" className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-3">
              Browse by category
            </h2>
            <p className="text-center text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto">
              No account needed — every listing below is open to browse.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {BROWSE_CATEGORIES.map((category) => {
                const Icon = CATEGORY_ICONS[category.icon] || Stethoscope;
                return (
                  <Link
                    key={category.slug}
                    href={`/browse/${category.slug}`}
                    className="group flex flex-col rounded-xl border bg-card p-4 sm:p-5 transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[110px]"
                  >
                    <Icon className="mb-2 h-6 w-6 text-primary sm:h-7 sm:w-7" aria-hidden="true" />
                    <span className="text-base font-semibold group-hover:text-primary sm:text-lg">
                      {category.label}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                      {category.subtitle}
                    </span>
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <Button asChild variant="outline" size="lg" className="min-h-[48px]">
                <Link href="/resources">Free guides &amp; crisis directories</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="about" className="w-full py-12 sm:py-16 lg:py-20" aria-labelledby="how-it-works">
          <div className="w-full px-4 sm:px-6 lg:px-12 max-w-7xl mx-auto">
            <h2 id="how-it-works" className="text-2xl sm:text-3xl lg:text-4xl font-bold text-center mb-8 sm:mb-12 lg:mb-16">How It Works</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 sm:gap-10 lg:gap-12">
              <div className="text-center theme-panel p-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 lg:mb-6 text-primary-foreground text-xl sm:text-2xl font-bold" aria-hidden="true">
                  1
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 lg:mb-4">Search</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Browse services by location, disability, and type. No account needed to search.
                </p>
              </div>
              <div className="text-center theme-panel p-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 lg:mb-6 text-primary-foreground text-xl sm:text-2xl font-bold" aria-hidden="true">
                  2
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 lg:mb-4">Connect</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Send inquiries or sign in to message providers directly and get personalized support.
                </p>
              </div>
              <div className="text-center theme-panel p-6">
                <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5 lg:mb-6 text-primary-foreground text-xl sm:text-2xl font-bold" aria-hidden="true">
                  3
                </div>
                <h3 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3 lg:mb-4">Get Support</h3>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xs mx-auto">
                  Access verified, quality services matched to the needs that matter most to you and your family.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <footer className="w-full border-t py-6 sm:py-8 lg:py-10" role="contentinfo">
        <div className="w-full px-4 sm:px-6 lg:px-12 text-center text-muted-foreground">
          <nav aria-label="Footer" className="mb-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            <Link href="/browse" className="hover:text-foreground">Browse all listings</Link>
            <Link href="/resources" className="hover:text-foreground">Resources</Link>
            <Link href="/saved" className="hover:text-foreground">Saved</Link>
            <Link href="/auth/signup?role=BUSINESS" className="hover:text-foreground">List your business</Link>
            <Link href="/auth/signin" className="hover:text-foreground">Sign in</Link>
          </nav>
          <p className="text-sm sm:text-base">&copy; {new Date().getFullYear()} ResourceAble. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
