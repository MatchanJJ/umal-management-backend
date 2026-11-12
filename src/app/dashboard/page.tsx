'use client';

import { AlertTriangleIcon, PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { EventList } from '@/components/events/EventList';
import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiHealth, useDashboard, useEvents, usePendingAccessCount } from '@/lib/api';
import { shiftWhen } from '@/lib/format';
import { manilaNow } from '../../../shared/time';

function NeedsStaff() {
  const { data, isLoading } = useEvents();
  const now = manilaNow();
  const upcoming = data?.items.filter(
    (e) => (e.status === 'draft' || e.status === 'published') && e.endAt > now && e.shifts.some((s) => s.activeCount < s.requiredVolunteers),
  );
  return <EventList events={upcoming} loading={isLoading} />;
}

function Tile({ label, value, sub, href }: { label: string; value: React.ReactNode; sub?: string; href?: string }) {
  const body = (
    <>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-[13px] text-muted-foreground">{sub}</dd>}
    </>
  );
  return href ? (
    <Link href={href} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border p-4">{body}</div>
  );
}

function Tiles() {
  const { data: pending } = usePendingAccessCount(true);
  const { data: d } = useDashboard();
  const { data: ai } = useAiHealth();
  const aiSub = ai && `${ai.turns7d} turns · ${ai.fallbacks7d} fallbacks · ${ai.failures7d} failed (7 days)`;
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Tile label="Pending access" value={pending ?? '—'} href="/access/" />
      <Tile label="Missing schedules" value={d?.missingSchedules ?? '—'} sub="active term" href="/members/?schedule=missing" />
      <Tile label="Needs attendance" value={d?.needsAttendance.length ?? '—'} sub="events" />
      <Tile label="AI response (p50)" value={ai ? (ai.p50LatencyMs === null ? '—' : `${(ai.p50LatencyMs / 1000).toFixed(1)} s`) : '—'} sub={aiSub} href="/settings/" />
    </dl>
  );
}

/** App Flow §4: future assignments a schedule edit turned into class conflicts. */
function NewConflicts() {
  const { data } = useDashboard();
  if (!data?.newConflicts.length) return null;
  return (
    <section aria-labelledby="conflicts-title" className="space-y-3 rounded-lg border border-warning-foreground/30 bg-warning/40 p-4">
      <h2 id="conflicts-title" className="flex items-center gap-2 font-semibold">
        <AlertTriangleIcon className="size-4" aria-hidden /> New conflicts ({data.newConflicts.length})
      </h2>
      <p className="text-sm">These members changed their class schedule after being assigned. Review each shift and remove or keep them.</p>
      <ul className="divide-y rounded-md border bg-background">
        {data.newConflicts.map((c) => (
          <li key={c.assignmentId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
            <span className="font-medium">{c.memberName}</span>
            <Link href={`/events/view/?id=${c.eventId}`} className="text-primary underline-offset-4 hover:underline">
              {c.eventTitle} · {c.shiftLabel}
            </Link>
            <span className="text-muted-foreground tabular-nums">{shiftWhen(c.startAt, c.endAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function NeedsAttendance() {
  const { data, isLoading } = useDashboard();
  if (isLoading) return <Skeleton className="h-16" />;
  if (!data?.needsAttendance.length) return <p className="text-sm text-muted-foreground">All ended shifts are marked.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {data.needsAttendance.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
          <Link href={`/events/view/?id=${e.id}`} className="flex-1 font-medium underline-offset-4 hover:underline">
            {e.title}
          </Link>
          <span className="text-muted-foreground tabular-nums">{e.unmarked} unmarked</span>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
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
            <Tiles />
            <NewConflicts />
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Events needing attendance</h2>
              <NeedsAttendance />
            </section>
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
