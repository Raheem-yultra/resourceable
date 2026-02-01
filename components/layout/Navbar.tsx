'use client';

import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, LogOut, Building2, MessageSquare, Search, Shield, Menu, X } from 'lucide-react';

export function Navbar() {
  const { data: session, status } = useSession();
  const isLoading = status === 'loading';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2" onClick={closeMobileMenu}>
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-lg sm:text-xl truncate">ResourceAble</span>
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center space-x-6">
            <Link
              href="/search"
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Search Services
            </Link>
            {session?.user.role === 'BUSINESS' && (
              <Link
                href="/business/dashboard"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                My Business
              </Link>
            )}
            {session?.user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
            )}
            {session && (
              <Link
                href="/messages"
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                Messages
              </Link>
            )}
          </div>

          {/* Right side: User Menu + Mobile Toggle */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Mobile Menu Toggle - Show first on mobile */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden p-2 min-w-[44px] min-h-[44px]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>

            {/* Desktop User Menu */}
            {isLoading ? (
              <div className="hidden sm:block h-8 w-8 rounded-full bg-muted animate-pulse" />
            ) : session ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full p-0">
                    <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm sm:text-base">
                      {session.user.name?.[0]?.toUpperCase() || session.user.email?.[0]?.toUpperCase()}
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{session.user.name}</p>
                      <p className="text-xs leading-none text-muted-foreground truncate">
                        {session.user.email}
                      </p>
                      <p className="text-xs leading-none text-muted-foreground mt-1">
                        <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                          {session.user.role}
                        </span>
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  
                  {session.user.role === 'BUSINESS' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/business/dashboard" className="cursor-pointer">
                          <Building2 className="mr-2 h-4 w-4" />
                          My Business
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  
                  {session.user.role === 'ADMIN' && (
                    <>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer">
                          <Shield className="mr-2 h-4 w-4" />
                          Admin Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}

                  <DropdownMenuItem asChild>
                    <Link href="/search" className="cursor-pointer">
                      <Search className="mr-2 h-4 w-4" />
                      Search Services
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href="/messages" className="cursor-pointer">
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Messages
                    </Link>
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />
                  
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={() => signOut({ callbackUrl: '/' })}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              /* Desktop auth buttons - hidden on mobile */
              <div className="hidden md:flex items-center gap-2">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/auth/signin">Sign In</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/auth/signup">Get Started</Link>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t bg-background pb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex flex-col pt-3">
              {/* Navigation Links */}
              <Link
                href="/search"
                className="flex items-center px-4 py-3 text-sm font-medium text-foreground hover:bg-muted rounded-lg mx-2 transition-colors min-h-[48px]"
                onClick={closeMobileMenu}
              >
                <Search className="mr-3 h-4 w-4" />
                Search Services
              </Link>
              
              {session?.user.role === 'BUSINESS' && (
                <Link
                  href="/business/dashboard"
                  className="flex items-center px-4 py-3 text-sm font-medium text-foreground hover:bg-muted rounded-lg mx-2 transition-colors min-h-[48px]"
                  onClick={closeMobileMenu}
                >
                  <Building2 className="mr-3 h-4 w-4" />
                  My Business
                </Link>
              )}
              
              {session?.user.role === 'ADMIN' && (
                <Link
                  href="/admin"
                  className="flex items-center px-4 py-3 text-sm font-medium text-foreground hover:bg-muted rounded-lg mx-2 transition-colors min-h-[48px]"
                  onClick={closeMobileMenu}
                >
                  <Shield className="mr-3 h-4 w-4" />
                  Admin Dashboard
                </Link>
              )}
              
              {session && (
                <Link
                  href="/messages"
                  className="flex items-center px-4 py-3 text-sm font-medium text-foreground hover:bg-muted rounded-lg mx-2 transition-colors min-h-[48px]"
                  onClick={closeMobileMenu}
                >
                  <MessageSquare className="mr-3 h-4 w-4" />
                  Messages
                </Link>
              )}

              {/* Mobile Auth Buttons - Inline */}
              {!session && !isLoading && (
                <div className="flex items-center gap-2 px-4 pt-4 border-t mt-3">
                  <Button asChild variant="outline" className="flex-1 min-h-[44px]">
                    <Link href="/auth/signin" onClick={closeMobileMenu}>Sign In</Link>
                  </Button>
                  <Button asChild className="flex-1 min-h-[44px]">
                    <Link href="/auth/signup" onClick={closeMobileMenu}>Get Started</Link>
                  </Button>
                </div>
              )}

              {/* Mobile Sign Out */}
              {session && (
                <div className="px-4 pt-4 border-t mt-3">
                  <Button
                    variant="outline"
                    className="w-full min-h-[44px] justify-center text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => {
                      closeMobileMenu();
                      signOut({ callbackUrl: '/' });
                    }}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
