'use client';

import { CalendarClockIcon, TriangleAlertIcon } from 'lucide-react';
import Link from 'next/link';
import { AppGate } from '@/components/layout/AppGate';
import { MemberShell } from '@/components/layout/MemberShell';
import { AssignmentStatus } from '@/components/member/AssignmentStatus';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyAssignments } from '@/lib/api';
import { hoursLabel, shiftWhen } from '@/lib/format';
import type { MeResponse } from '../../../shared/api';

function Kpi({ label, value, meta }: { label: string; value: string; meta?: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-[32px] leading-9 font-extrabold text-primary tabular-nums">{value}</p>
      {meta && <p className="mt-1 text-[13px] text-muted-foreground">{meta}</p>}
    </div>
  );
}

function Home({ me }: { me: MeResponse }) {
  const { data, isLoading } = useMyAssignments();
  const stats = data?.termStats;
  const marked = (stats?.attended ?? 0) + (stats?.noShow ?? 0);
  return (
    <div className="space-y-6">
      {/* FR-10: persistent until the active term's schedule is submitted. */}
      {me.activeTerm && !me.scheduleSubmitted && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-secondary/60 bg-warning px-4 py-3 text-sm text-warning-foreground">
          <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
          <p className="flex-1">
            Submit your class schedule for <strong>{me.activeTerm.name}</strong> so advisers can assign you to events.
          </p>
          <Button size="sm" asChild>
            <Link href="/me/schedule/">Submit schedule</Link>
          </Button>
        </div>
      )}

      <section aria-label="This term" className="grid gap-3 sm:grid-cols-3">
        {isLoading || !stats ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <Kpi label="Hours served this term" value={hoursLabel(stats.hours)} meta={me.activeTerm?.name ?? 'No active term'} />
            <Kpi label="Shifts" value={String(stats.shifts)} />
            <Kpi
              label="Attendance"
              value={marked ? `${Math.round((stats.attended / marked) * 100)}%` : '—'}
              meta={marked ? `${stats.attended} attended · ${stats.noShow} no-show` : 'No attendance marked yet'}
            />
          </>
        )}
      </section>

      <section aria-labelledby="upcoming" className="space-y-3">
        <h2 id="upcoming" className="text-lg font-semibold">
          Upcoming shifts
        </h2>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : !data?.upcoming.length ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            <CalendarClockIcon className="size-5 text-primary" aria-hidden />
            No upcoming shifts. Advisers will assign you when events need volunteers.
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {data.upcoming.map((a) => (
              <li key={a.assignmentId} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {a.eventTitle} <span className="font-normal text-muted-foreground">· {a.shiftLabel}</span>
                  </p>
                  <p className="text-[13px] text-muted-foreground tabular-nums">
                    {shiftWhen(a.startAt, a.endAt)}
                    {a.venue && ` · ${a.venue}`}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">{hoursLabel(a.hours)}</span>
                <AssignmentStatus status={a.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function MemberHome() {
  return (
    <AppGate require="member">
      {(me) => (
        <MemberShell me={me!} title={`Hi, ${me!.member?.firstName ?? me!.user.name.split(' ')[0]}`}>
          <Home me={me!} />
        </MemberShell>
      )}
    </AppGate>
  );
}
