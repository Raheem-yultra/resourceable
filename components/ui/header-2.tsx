'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/hooks/use-scroll';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Marketplace nav (plan §5). "Browse" groups the three provider/product-finding
// flows (Services, Therapies, Shop) that users naturally bounce between; School,
// Events, and Resources stay top-level as conceptually distinct destinations.
const BROWSE_LINKS = [
  { label: 'All listings', href: '/browse' },
  { label: 'Services', href: '/browse/services' },
  { label: 'Therapies', href: '/browse/therapies' },
  { label: 'Shop', href: '/browse/shop' },
];
const TOP_LEVEL_MARKETPLACE = [
  { label: 'School', href: '/browse/school' },
  { label: 'Events', href: '/browse/events' },
  { label: 'Resources', href: '/resources' },
];

export function Header() {
	const [open, setOpen] = React.useState(false);
	const scrolled = useScroll(10);
	const { data: session } = useSession();
	const pathname = usePathname();

	// Define navigation links based on user role. Guests and families (USER) also
	// get the marketplace nav (Browse ▾ / School / Events / Resources) rendered
	// separately; ADMIN/BUSINESS keep their dashboards.
	const getLinks = () => {
		if (!session) {
			// Not logged in - show public links
			return [
				{ label: 'About', href: pathname === '/' ? '#about' : '/#about' },
			];
		}

		if (session.user.role === 'ADMIN') {
			// Admin user
			return [
				{ label: 'Admin Panel', href: '/admin' },
				{ label: 'Search Services', href: '/search' },
				{ label: 'Messages', href: '/messages' },
			];
		}

		if (session.user.role === 'BUSINESS') {
			// Business user
			return [
				{ label: 'Dashboard', href: '/business/dashboard' },
				{ label: 'Listings', href: '/business/listings' },
				{ label: 'Profile', href: '/business/profile' },
				{ label: 'Messages', href: '/messages' },
			];
		}

		// Regular user
		return [
			{ label: 'Messages', href: '/messages' },
		];
	};

	const links = getLinks();
	// Show the marketplace browse nav for guests and families (not providers/admins).
	const showMarketplace = !session || session.user.role === 'USER';
	const isActiveLink = (href: string) => {
		if (href.startsWith('#')) {
			return pathname === '/';
		}
		if (href.startsWith('/#')) {
			return pathname === '/';
		}
		return pathname === href;
	};

	React.useEffect(() => {
		if (open) {
			// Disable scroll
			document.body.style.overflow = 'hidden';
		} else {
			// Re-enable scroll
			document.body.style.overflow = '';
		}

		// Cleanup when component unmounts (important for Next.js)
		return () => {
			document.body.style.overflow = '';
		};
	}, [open]);

	React.useEffect(() => {
		if (!open) {
			return;
		}

		const handleEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				setOpen(false);
			}
		};

		window.addEventListener('keydown', handleEscape);
		return () => window.removeEventListener('keydown', handleEscape);
	}, [open]);

	return (
		<>
		<header
			className={cn(
				'sticky top-0 z-50 mx-auto w-full max-w-5xl border-b border-border/70 bg-background/85 backdrop-blur-xl md:rounded-2xl md:border md:transition-all md:ease-out',
				{
					'bg-background/90 border-border shadow-sm md:top-4 md:max-w-4xl md:shadow':
						scrolled && !open,
					'bg-background/95': open,
				},
			)}
		>
			<nav
				aria-label="Primary"
				className={cn(
					'flex h-14 w-full items-center justify-end px-4 md:h-12 md:transition-all md:ease-out',
					{
						'md:px-2': scrolled,
					},
				)}
			>
				<div className="hidden items-center gap-2 md:flex">
					<ThemeToggle />
					{showMarketplace && (
						<>
							<DropdownMenu>
								<DropdownMenuTrigger className={cn(buttonVariants({ variant: 'ghost' }), 'gap-1')}>
									Browse
									<ChevronDown className="h-4 w-4" aria-hidden="true" />
								</DropdownMenuTrigger>
								<DropdownMenuContent align="start" className="w-44">
									{BROWSE_LINKS.map((link, i) => (
										<div key={link.href}>
											<DropdownMenuItem asChild>
												<Link href={link.href}>{link.label}</Link>
											</DropdownMenuItem>
											{i === 0 && <DropdownMenuSeparator />}
										</div>
									))}
								</DropdownMenuContent>
							</DropdownMenu>
							{TOP_LEVEL_MARKETPLACE.map((link) => (
								<Link
									key={link.href}
									className={buttonVariants({ variant: 'ghost' })}
									href={link.href}
									aria-current={isActiveLink(link.href) ? 'page' : undefined}
								>
									{link.label}
								</Link>
							))}
						</>
					)}
					{links.map((link, i) => (
						<Link
							key={i}
							className={buttonVariants({ variant: 'ghost' })}
							href={link.href}
							aria-current={isActiveLink(link.href) ? 'page' : undefined}
						>
							{link.label}
						</Link>
					))}
					{session ? (
						<>
							<Button variant="outline" asChild>
								<Link href="/auth/signout">Sign Out</Link>
							</Button>
						</>
					) : (
						<>
							<Button variant="outline" asChild>
								<Link href="/auth/signin">Sign In</Link>
							</Button>
							<Button asChild>
								<Link href="/auth/signup">Get Started</Link>
							</Button>
						</>
					)}
				</div>
				<Button
					size="icon"
					variant="outline"
					onClick={() => setOpen(!open)}
					className="md:hidden"
					aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
					aria-expanded={open}
					aria-controls="mobile-navigation-menu"
				>
					<MenuToggleIcon open={open} className="size-5" duration={300} />
				</Button>
			</nav>
		</header>

			{/* Rendered OUTSIDE <header> on purpose: the header has backdrop-filter,
			    which makes it the containing block for position:fixed descendants —
			    nesting this panel inside it collapsed the fixed inset to ~0 height,
			    so the mobile menu opened invisibly. As a sibling it sizes to the
			    viewport. */}
			<div
				id="mobile-navigation-menu"
				className={cn(
					'bg-background/95 fixed top-14 right-0 bottom-0 left-0 z-50 flex flex-col overflow-hidden border-y border-border/70 backdrop-blur-xl md:hidden',
					open ? 'block' : 'hidden',
				)}
			>
				<div
					data-slot={open ? 'open' : 'closed'}
					className={cn(
						'data-[slot=open]:animate-in data-[slot=open]:zoom-in-95 data-[slot=closed]:animate-out data-[slot=closed]:zoom-out-95 ease-out',
						'flex h-full w-full flex-col justify-between gap-y-2 p-4',
					)}
				>
					<div className="grid gap-y-2">
						{showMarketplace &&
							[...BROWSE_LINKS, ...TOP_LEVEL_MARKETPLACE].map((link) => (
								<Link
									key={link.href}
									className={buttonVariants({
										variant: 'ghost',
										className: 'justify-start',
									})}
									href={link.href}
									onClick={() => setOpen(false)}
									aria-current={isActiveLink(link.href) ? 'page' : undefined}
								>
									{link.label}
								</Link>
							))}
						{links.map((link) => (
							<Link
								key={link.label}
								className={buttonVariants({
									variant: 'ghost',
									className: 'justify-start',
								})}
								href={link.href}
								onClick={() => setOpen(false)}
								aria-current={isActiveLink(link.href) ? 'page' : undefined}
							>
								{link.label}
							</Link>
						))}
					</div>
					<div className="flex flex-row gap-2">
						<ThemeToggle />
						{session ? (
							<Button variant="outline" className="flex-1 min-h-[44px]" asChild>
								<Link href="/auth/signout" onClick={() => setOpen(false)}>Sign Out</Link>
							</Button>
						) : (
							<>
								<Button variant="outline" className="flex-1 min-h-[44px]" asChild>
									<Link href="/auth/signin" onClick={() => setOpen(false)}>Sign In</Link>
								</Button>
								<Button className="flex-1 min-h-[44px]" asChild>
									<Link href="/auth/signup" onClick={() => setOpen(false)}>Get Started</Link>
								</Button>
							</>
						)}
					</div>
				</div>
			</div>
		</>
	);
}
