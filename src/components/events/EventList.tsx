'use client';

import { CalendarDaysIcon, MapPinIcon } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { shiftWhen } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { EventDTO } from '../../../shared/events';
import { StaffingBar } from './StaffingBar';
import { StatusBadge } from './StatusBadge';

const day = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const d = (s: string) => day.format(new Date(`${s.slice(0, 10)}T00:00:00Z`));

/** '13–15 Nov · 3 shifts' style span (App Flow §5). */
export function eventSpan(e: Pick<EventDTO, 'startAt' | 'endAt' | 'shifts'>): string {
  const n = e.shifts.length;
  const when = n === 1 ? shiftWhen(e.startAt, e.endAt) : e.startAt.slice(0, 10) === e.endAt.slice(0, 10) ? d(e.startAt) : `${d(e.startAt)} – ${d(e.endAt)}`;
  return n === 1 ? when : `${when} · ${n} shifts`;
}

export function EventList({ events, loading }: { events: EventDTO[] | undefined; loading: boolean }) {
  if (loading) return <Skeleton className="h-48" />;
  if (!events?.length) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        <CalendarDaysIcon className="size-5 text-primary" aria-hidden /> No events yet.
      </div>
    );
  }
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {events.map((e) => {
        const filled = e.shifts.reduce((s, x) => s + x.activeCount, 0);
        const required = e.shifts.reduce((s, x) => s + x.requiredVolunteers, 0);
        return (
          <li key={e.id}>
            <Link
              href={`/events/view/?id=${e.id}`}
              className="block space-y-3 rounded-lg border bg-card p-4 transition-colors hover:bg-sidebar focus-visible:outline-2"
            >
              <div className="flex items-start justify-between gap-3">
                <p className={cn('font-semibold', e.status === 'cancelled' && 'text-muted-foreground line-through')}>{e.title}</p>
                <StatusBadge status={e.status} />
              </div>
              <p className="flex flex-wrap gap-x-3 text-[13px] text-muted-foreground tabular-nums">
                <span>{eventSpan(e)}</span>
                {e.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPinIcon className="size-3.5" aria-hidden /> {e.venue}
                  </span>
                )}
              </p>
              <StaffingBar filled={filled} required={required} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
