'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * The admin console's tab bar, with the open tab kept in the URL.
 *
 * Everything an admin does here reloads the page — approving a provider, acting
 * on a report, coming back from a provider's public page in another tab — and the
 * console always reopened on Overview. Working the verification queue meant
 * clicking back into it a few dozen times a session.
 *
 * `replace` rather than `push`: switching tabs is changing the view, not
 * navigating, so Back should leave the console rather than walk through every tab
 * that was looked at on the way.
 */

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'verifications', label: 'Verification Queue' },
  { value: 'businesses', label: 'Businesses' },
  { value: 'categories', label: 'Categories' },
  { value: 'reports', label: 'Reports' },
  { value: 'resources', label: 'Resources' },
  { value: 'audit', label: 'Audit Log' },
];

const VALID = new Set(TABS.map((t) => t.value));

export function AdminTabs({
  initialTab,
  children,
}: {
  initialTab?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read from the live params where possible so a Back/Forward press moves the
  // tab with it; fall back to what the server rendered. An unrecognised value in
  // a hand-edited URL falls back to Overview rather than rendering nothing.
  const fromUrl = searchParams.get('tab') ?? initialTab;
  const current = fromUrl && VALID.has(fromUrl) ? fromUrl : 'overview';

  return (
    <Tabs
      value={current}
      onValueChange={(value) => {
        const params = new URLSearchParams(searchParams.toString());
        // Overview is the default, so it stays out of the URL — /admin should not
        // become /admin?tab=overview just because someone clicked back to it.
        if (value === 'overview') params.delete('tab');
        else params.set('tab', value);
        const qs = params.toString();
        router.replace(qs ? `/admin?${qs}` : '/admin', { scroll: false });
      }}
      className="space-y-6"
    >
      <TabsList className="flex w-full flex-wrap justify-start gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </Tabs>
  );
}
