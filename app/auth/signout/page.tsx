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
		<div className="container flex min-h-screen items-center justify-center py-8">
			<Card className="w-full max-w-md">
				<CardHeader>
					<CardTitle>Sign Out</CardTitle>
					<CardDescription>Are you sure you want to sign out?</CardDescription>
				</CardHeader>
				<CardContent className="flex gap-3">
					<Button onClick={handleSignOut} className="flex-1">
						Yes, Sign Out
					</Button>
					<Button onClick={() => router.back()} variant="outline" className="flex-1">
						Cancel
					</Button>
				</CardContent>
			</Card>
		</div>
	);
}
