import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { MessageInbox } from '@/components/chat/MessageInbox';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Messages - ResourceAble',
  description: 'View and manage your messages',
  // Private. robots.txt already disallows this path; the page-level directive
  // is what still holds if a URL reaches a crawler another way.
  robots: { index: false, follow: false },
};

export default async function MessagesInboxPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    // The site's own sign-in screen, carrying the destination — this pointed at
    // NextAuth's internal handler with nothing attached, so signing in from here
    // dropped you on a role landing page instead of the inbox you asked for.
    redirect('/auth/signin?callbackUrl=%2Fmessages');
  }

  return (
    <div className="page-wrap max-w-5xl">
      <MessageInbox currentUserId={session.user.id} />
    </div>
  );
}
