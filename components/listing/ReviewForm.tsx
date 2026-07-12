'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * Review submission for a listing (multi-listing marketplace). Shown to signed-in
 * families on the listing detail page. One review per person per listing (the API
 * upserts, so submitting again edits the existing review).
 */
export function ReviewForm({ serviceId, existing }: { serviceId: string; existing?: { rating: number; title?: string | null; content: string } }) {
  const router = useRouter();
  const [rating, setRating] = useState(existing?.rating || 0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState(existing?.title || '');
  const [content, setContent] = useState(existing?.content || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (rating < 1) return setError('Please select a star rating.');
    if (content.trim().length < 5) return setError('Please write a short review.');
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, rating, title: title || undefined, content }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to submit review');
      }
      setDone(true);
      router.refresh();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return <p className="text-sm text-green-700 dark:text-green-400">Thanks — your review has been posted.</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="font-semibold">{existing ? 'Update your review' : 'Write a review'}</h3>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Star rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-1"
          >
            <Star className={`h-6 w-6 ${(hover || rating) >= n ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-title">Title (optional)</Label>
        <Input id="rv-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summarize your experience" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="rv-content">Your review</Label>
        <Textarea id="rv-content" rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="What was your experience like?" />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <Button onClick={submit} disabled={loading}>{loading ? 'Submitting…' : existing ? 'Update review' : 'Submit review'}</Button>
    </div>
  );
}
