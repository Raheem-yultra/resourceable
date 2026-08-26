import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function ChatPage(
  props: { 
    params: Promise<{ userId: string }>;
    searchParams: Promise<{ message?: string }>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(`/messages/${params.userId}`)}`);
  }

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-5xl">
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
