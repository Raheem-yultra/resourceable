import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { MessageInbox } from '@/components/chat/MessageInbox';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages - ResourceAble',
  description: 'View and manage your messages',
};

export default async function MessagesInboxPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect('/api/auth/signin');
  }

  return (
    <div className="page-wrap max-w-5xl">
      <MessageInbox currentUserId={session.user.id} />
    </div>
  );
}
