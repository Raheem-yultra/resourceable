'use client';

import { signOut } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignOutPage() {
	const router = useRouter();

	const handleSignOut = async () => {
		await signOut({ callbackUrl: '/' });
	};

	return (
		<div className="min-h-screen flex items-center justify-center px-4 py-8">
			<Card className="w-full max-w-md bg-card/90 backdrop-blur-sm shadow-lg">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">Sign Out</CardTitle>
					<CardDescription>Are you sure you want to sign out?</CardDescription>
				</CardHeader>
				<CardContent className="flex gap-3">
					<Button onClick={handleSignOut} className="flex-1 min-h-[48px]">
						Yes, Sign Out
					</Button>
					<Button onClick={() => router.back()} variant="outline" className="flex-1 min-h-[48px]">
						Cancel
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
