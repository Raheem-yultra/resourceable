import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { BookOpen, ExternalLink, FileText, LifeBuoy, ScrollText } from 'lucide-react';
import { RESOURCE_TOPICS } from '@/lib/listing-taxonomy';
import { EmptyState } from '@/components/ui/empty-state';

export const dynamic = 'force-dynamic';

// Resources is a knowledge base, NOT part of the listing search index (plan §2.1).
// It's browsed by topic tag rather than by location/price/verification.
const TYPE_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  ARTICLE: { label: 'Article', icon: FileText },
  GUIDE: { label: 'Guide', icon: BookOpen },
  HOTLINE: { label: 'Hotline', icon: LifeBuoy },
  FORM: { label: 'Form', icon: ScrollText },
};

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: { topic?: string };
}) {
  const topic = searchParams.topic;
  const resources = await prisma.resource.findMany({
    where: {
      isPublished: true,
      ...(topic ? { topicTags: { has: topic } } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
  });

  return (
    <div className="min-h-screen">
      <div className="page-wrap">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-1 sm:mb-2">Resources</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Guides, benefits &amp; legal rights, financial assistance, and crisis directories — free, no account needed.
          </p>
        </div>

        {/* Topic-tag filter (plan §6) */}
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter resources by topic">
          <Link
            href="/resources"
            className={`inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-medium min-h-[40px] ${
              !topic ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
            }`}
          >
            All topics
          </Link>
          {RESOURCE_TOPICS.map((t) => (
            <Link
              key={t}
              href={`/resources?topic=${encodeURIComponent(t)}`}
              className={`inline-flex items-center rounded-full border px-3.5 py-2 text-sm font-medium min-h-[40px] ${
                topic === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground'
              }`}
            >
              {t}
            </Link>
          ))}
        </div>

        {resources.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-6 w-6" />}
            title="No resources yet"
            description={
              topic
                ? `No resources are tagged "${topic}" yet. Try another topic.`
                : 'Resources are being added. Check back soon.'
            }
          />
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2">
            {resources.map((r) => {
              const meta = TYPE_META[r.resourceType] || TYPE_META.ARTICLE;
              const Icon = meta.icon;
              const isExternal = !!r.externalUrl;
              const href = isExternal ? r.externalUrl! : `/resources/${r.slug}`;
              return (
                <Link
                  key={r.id}
                  href={href}
                  {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className="block rounded-lg border bg-card p-4 sm:p-5 hover:border-primary/50 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span>{meta.label}</span>
                    {isExternal && <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />}
                  </div>
                  <h2 className="text-base sm:text-lg font-semibold leading-tight mb-1.5">{r.title}</h2>
                  {r.summary && <p className="text-sm text-muted-foreground line-clamp-2">{r.summary}</p>}
                  {r.topicTags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {r.topicTags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground border border-border">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
