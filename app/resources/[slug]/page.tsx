import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, ExternalLink } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ResourceDetailPage({ params }: { params: { slug: string } }) {
  const resource = await prisma.resource.findUnique({ where: { slug: params.slug } });
  if (!resource || !resource.isPublished) notFound();

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-3xl">
        <Link href="/resources" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to resources
        </Link>

        <article>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{resource.title}</h1>
          {resource.topicTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {resource.topicTags.map((tag) => (
                <Link
                  key={tag}
                  href={`/resources?topic=${encodeURIComponent(tag)}`}
                  className="inline-flex items-center rounded-md bg-accent px-2 py-0.5 text-xs text-accent-foreground border border-border hover:border-primary/40"
                >
                  {tag}
                </Link>
              ))}
            </div>
          )}
          {resource.summary && <p className="text-base text-muted-foreground mb-6">{resource.summary}</p>}

          {/* Body is stored as plain text / markdown-ish; render with preserved line breaks. */}
          <div className="prose prose-sm sm:prose-base max-w-none whitespace-pre-wrap leading-relaxed">
            {resource.body}
          </div>

          {resource.externalUrl && (
            <a
              href={resource.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              Visit resource <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </article>
      </div>
    </div>
  );
}
