import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { LISTING_CARD_INCLUDE, toListingCard, PUBLICLY_VISIBLE_LISTING } from '@/lib/listing-card';
import { rateLimit, clientIp, tooManyRequests } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Hydrate a set of listing ids into full cards.
 *
 * Saved listings are held on the visitor's own device (see hooks/use-saved-listings)
 * — the device knows *which* listings, not what they are — so this turns that list
 * of ids back into something renderable. Public and unauthenticated, because
 * saving deliberately does not require an account.
 *
 * The same visibility rule as search applies. A listing that has since been
 * suspended, deleted, or had its provider un-approved simply does not come back,
 * and the client drops it from the shortlist: a saved card must never be a way to
 * see something the directory has taken down.
 */

const MAX_IDS = 100;

const querySchema = z.object({
  ids: z.array(z.string().cuid()).min(1).max(MAX_IDS),
});

export async function GET(req: NextRequest) {
  try {
    const rl = rateLimit(`listings-batch:${clientIp(req)}`, 60, 60_000);
    if (!rl.allowed) return tooManyRequests(rl.retryAfterSeconds);

    const { searchParams } = new URL(req.url);
    // Non-cuid values are dropped rather than 400-ing the whole request: a
    // shortlist can outlive an id format change, and one bad entry should not
    // blank out the rest of somebody's saved providers.
    const raw = searchParams.getAll('id').filter((id) => /^c[a-z0-9]{20,}$/i.test(id));

    if (raw.length === 0) {
      return NextResponse.json({ listings: [] });
    }

    const parsed = querySchema.safeParse({ ids: raw.slice(0, MAX_IDS) });
    if (!parsed.success) {
      return NextResponse.json({ listings: [] });
    }

    const services = await prisma.service.findMany({
      relationLoadStrategy: 'join',
      where: { id: { in: parsed.data.ids }, ...PUBLICLY_VISIBLE_LISTING },
      include: LISTING_CARD_INCLUDE,
    });

    // Preserve the order the client asked in — that is the order the visitor
    // saved them, newest first, and re-sorting would shuffle their shortlist.
    const byId = new Map(services.map((s) => [s.id, s]));
    const listings = parsed.data.ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map(toListingCard);

    return NextResponse.json({ listings });
  } catch (error) {
    console.error('Listing batch lookup failed:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
