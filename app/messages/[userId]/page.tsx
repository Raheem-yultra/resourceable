import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ChatPage({ 
  params,
  searchParams 
}: { 
  params: { userId: string };
  searchParams: { message?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-6">
          <Link 
            href="/messages" 
            className="text-sm text-primary hover:underline inline-block"
          >
            ← Back to Inbox
          </Link>
        </div>
        
        <ChatInterface
          currentUserId={session.user.id}
          partnerId={params.userId}
          initialMessage={searchParams.message}
        />
      </div>
    </div>
  );
}

