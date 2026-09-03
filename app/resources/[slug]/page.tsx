import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { Breadcrumbs, type Crumb } from '@/components/ui/breadcrumbs';
import { JsonLd } from '@/components/seo/JsonLd';
import { breadcrumbSchema, resourceSchema } from '@/lib/structured-data';
import { pageMetadata, truncateDescription } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// Guides are the part of the site most likely to be found through a search engine
// rather than through the directory, so each one carries its own title and summary.
export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const resource = await prisma.resource.findUnique({
    where: { slug },
    select: { title: true, summary: true, body: true, isPublished: true },
  });

  if (!resource || !resource.isPublished) return { title: 'Resource not found - ResourceAble' };

  return pageMetadata({
    title: `${resource.title} - ResourceAble`,
    description: truncateDescription(resource.summary || resource.body || resource.title),
    path: `/resources/${slug}`,
    type: 'article',
  });
}

export default async function ResourceDetailPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params;
  const resource = await prisma.resource.findUnique({ where: { slug: params.slug } });
  if (!resource || !resource.isPublished) notFound();

  const trail: Crumb[] = [
    { name: 'Home', path: '/' },
    { name: 'Resources', path: '/resources' },
    { name: resource.title, path: `/resources/${resource.slug}` },
  ];

  return (
    <div className="min-h-screen">
      <div className="page-wrap max-w-3xl">
        <JsonLd data={[resourceSchema(resource), breadcrumbSchema(trail)]} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <Breadcrumbs trail={trail} />
          <Link href="/resources" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> All resources
          </Link>
        </div>

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
