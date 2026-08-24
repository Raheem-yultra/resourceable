'use client';

import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { WEEK_DAYS, type WeekDay } from '@/lib/business-setup';

/**
 * Structured opening-hours editor.
 *
 * Hours used to be a free-text box whose value was silently dropped on save, while
 * the public provider page rendered `hoursOfOperation` as day/value pairs. This
 * collects exactly that shape — `{ monday: "9:00 AM – 5:00 PM" }` — so what the
 * provider types is what families see, and a day left untouched simply doesn't
 * appear rather than showing up blank.
 */

export type HoursValue = Record<string, string>;

const DAY_LABELS: Record<WeekDay, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const CLOSED = 'Closed';

/** "13:30" -> "1:30 PM". Input type=time always gives 24h HH:MM regardless of locale. */
function to12Hour(value: string): string {
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return '';
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

/** Inverse of to12Hour, for re-hydrating saved values back into the time inputs. */
function to24Hour(value: string): string {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return '';
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${match[2]}`;
}

/** Split a stored "9:00 AM – 5:00 PM" back into the two time inputs. */
function splitRange(stored: string | undefined): { open: string; close: string; closed: boolean } {
  if (!stored) return { open: '', close: '', closed: false };
  if (stored.trim().toLowerCase() === CLOSED.toLowerCase()) return { open: '', close: '', closed: true };
  const [from, to] = stored.split('–').map((s) => s.trim());
  return { open: to24Hour(from || ''), close: to24Hour(to || ''), closed: false };
}

function joinRange(open: string, close: string): string {
  if (!open && !close) return '';
  const from = to12Hour(open);
  const to = to12Hour(close);
  if (from && to) return `${from} – ${to}`;
  return from || to;
}

export interface HoursOfOperationEditorProps {
  value: HoursValue;
  onChange: (next: HoursValue) => void;
}

export function HoursOfOperationEditor({ value, onChange }: HoursOfOperationEditorProps) {
  const setDay = (day: WeekDay, next: string) => {
    const draft = { ...value };
    if (next) draft[day] = next;
    else delete draft[day];
    onChange(draft);
  };

  const monday = splitRange(value.monday);
  const canCopyMonday = !monday.closed && (!!monday.open || !!monday.close);

  const copyMondayToWeekdays = () => {
    const source = value.monday;
    if (!source) return;
    const draft = { ...value };
    (['tuesday', 'wednesday', 'thursday', 'friday'] as WeekDay[]).forEach((d) => {
      draft[d] = source;
    });
    onChange(draft);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Leave a day blank if it varies — families see only the days you fill in.
        </p>
        {canCopyMonday && (
          <Button type="button" variant="outline" size="sm" onClick={copyMondayToWeekdays}>
            Copy Monday to Tue–Fri
          </Button>
        )}
      </div>

      <div className="divide-y rounded-lg border">
        {WEEK_DAYS.map((day) => {
          const { open, close, closed } = splitRange(value[day]);
          return (
            <div key={day} className="flex flex-wrap items-center gap-3 p-3">
              <span className="w-24 shrink-0 text-sm font-medium">{DAY_LABELS[day]}</span>

              {closed ? (
                <span className="flex-1 text-sm text-muted-foreground">Closed</span>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <Label htmlFor={`hours-${day}-open`} className="sr-only">
                    {DAY_LABELS[day]} opening time
                  </Label>
                  <input
                    id={`hours-${day}-open`}
                    type="time"
                    value={open}
                    onChange={(e) => setDay(day, joinRange(e.target.value, close))}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Label htmlFor={`hours-${day}-close`} className="sr-only">
                    {DAY_LABELS[day]} closing time
                  </Label>
                  <input
                    id={`hours-${day}-close`}
                    type="time"
                    value={close}
                    onChange={(e) => setDay(day, joinRange(open, e.target.value))}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  />
                </div>
              )}

              <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={closed}
                  onChange={(e) => setDay(day, e.target.checked ? CLOSED : '')}
                />
                Closed
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
