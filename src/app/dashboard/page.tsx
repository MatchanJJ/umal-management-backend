'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { EventList } from '@/components/events/EventList';
import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { Button } from '@/components/ui/button';
import { useEvents, usePendingAccessCount } from '@/lib/api';
import { manilaNow } from '../../../shared/time';

// Task 4.4 slice of the dashboard: upcoming events that still need volunteers. Task 6.3 adds the KPI cards.
function NeedsStaff() {
  const { data, isLoading } = useEvents();
  const now = manilaNow();
  const upcoming = data?.items.filter(
    (e) => (e.status === 'draft' || e.status === 'published') && e.endAt > now && e.shifts.some((s) => s.activeCount < s.requiredVolunteers),
  );
  return <EventList events={upcoming} loading={isLoading} />;
}

export default function Dashboard() {
  const { data: pending } = usePendingAccessCount(true);
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell
          me={me!}
          title="Dashboard"
          actions={
            <Button size="sm" asChild>
              <Link href="/events/new/">
                <PlusIcon className="size-4" aria-hidden /> New event
              </Link>
            </Button>
          }
        >
          <div className="space-y-6">
            {!!pending && (
              <p className="rounded-lg border px-4 py-3 text-sm">
                <strong className="tabular-nums">{pending}</strong> access {pending === 1 ? 'request is' : 'requests are'} waiting.{' '}
                <Link href="/access/" className="font-medium text-primary underline-offset-4 hover:underline">
                  Review
                </Link>
              </p>
            )}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Upcoming events needing volunteers</h2>
              <NeedsStaff />
            </section>
          </div>
        </AdviserShell>
      )}
    </AppGate>
  );
}
