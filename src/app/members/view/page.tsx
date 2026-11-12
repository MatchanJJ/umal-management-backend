'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { AppGate } from '@/components/layout/AppGate';
import { AssignmentStatus } from '@/components/member/AssignmentStatus';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMember, useUpdateMember } from '@/lib/api';
import { hoursLabel, shiftWhen } from '@/lib/format';
import type { MemberDetail, MemberPatch } from '../../../../shared/api';
import { manilaNow } from '../../../../shared/time';

type Action = { patch: MemberPatch; title: string; body: string; confirm: string; destructive?: boolean };

function actionsFor(d: MemberDetail, name: string): Action[] {
  const m = d.member;
  // Same rule as the server: not-yet-started shifts still marked assigned (history is capped at 100, newest first).
  const now = manilaNow();
  const upcoming = d.assignments.filter((a) => a.status === 'assigned' && a.startAt > now).length;
  return [
    m.role === 'member'
      ? { patch: { role: 'adviser' }, title: `Make ${name} an adviser?`, body: 'Advisers can manage members, events, assignments, settings and the audit log.', confirm: 'Make adviser' }
      : { patch: { role: 'member' }, title: `Make ${name} a member?`, body: 'They lose adviser access immediately.', confirm: 'Make member', destructive: true },
    m.status === 'active'
      ? {
          patch: { status: 'inactive' },
          title: `Deactivate ${name}?`,
          body:
            upcoming > 0
              ? `They can't sign in or be assigned, and they're removed from their ${upcoming} upcoming ${upcoming === 1 ? 'shift' : 'shifts'} (reason "Member deactivated"). Reactivating won't bring those shifts back.`
              : "They can't sign in or be assigned.",
          confirm: 'Deactivate',
          destructive: true,
        }
      : { patch: { status: 'active' }, title: `Reactivate ${name}?`, body: 'They can sign in and be assigned again.', confirm: 'Reactivate' },
  ];
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function Profile({ selfId }: { selfId: number }) {
  const id = Number(useSearchParams().get('id')) || null;
  const { data, isLoading, isError } = useMember(id);
  const update = useUpdateMember(id ?? 0);
  const [pending, setPending] = useState<Action | null>(null);
  if (isError) return <p className="text-sm text-destructive">Member not found.</p>;
  if (isLoading || !data) return <Skeleton className="h-96" />;

  const m = data.member;
  const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
  const fields: [string, string | number | null][] = [
    ['Student number', m.studentNumber],
    ['College', data.collegeCode],
    ['Course', data.courseName],
    ['Year level', m.yearLevel],
    ['Gender', m.gender === 'M' ? 'Male' : m.gender === 'F' ? 'Female' : null],
    ['Height', m.heightCm && `${m.heightCm} cm`],
    ['T-shirt', m.tshirtSize],
    ['Joined (school year)', m.batchYear],
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-xl font-semibold">
            {name}
            {m.role === 'adviser' && <Badge>Adviser</Badge>}
            {m.status === 'inactive' && <Badge variant="outline">Inactive</Badge>}
          </h2>
          <p className="text-sm text-muted-foreground">{m.email}</p>
        </div>
        {m.id !== selfId && (
          <div className="flex flex-wrap gap-2">
            {actionsFor(data, name).map((a) => (
              <Button key={a.confirm} variant={a.destructive ? 'outline' : 'default'} size="sm" onClick={() => setPending(a)}>
                {a.confirm}
              </Button>
            ))}
          </div>
        )}
      </header>

      <section aria-labelledby="stats-title" className="space-y-2">
        <h3 id="stats-title" className="font-semibold">
          {data.activeTerm ? `${data.activeTerm.name} so far` : 'No active term'}
          <span className="ml-2 text-sm font-normal text-muted-foreground">Schedule {data.scheduleSubmitted ? 'submitted' : 'missing'}</span>
        </h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Hours served" value={hoursLabel(data.stats.hours)} />
          <Stat label="Shifts" value={data.stats.shifts} />
          <Stat label="Attended" value={data.stats.attended} />
          <Stat label="No-shows" value={data.stats.noShow} />
          <Stat label="Excused" value={data.stats.excused} />
        </dl>
      </section>

      <section aria-labelledby="profile-title" className="space-y-2">
        <h3 id="profile-title" className="font-semibold">
          Profile
        </h3>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          {fields.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="history-title" className="space-y-2">
        <h3 id="history-title" className="font-semibold">
          Assignment history
        </h3>
        {data.assignments.length ? (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/events/view/?id=${a.eventId}`} className="font-medium underline-offset-4 hover:underline">
                        {a.eventTitle}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {a.shiftLabel}
                      <div className="text-xs text-muted-foreground tabular-nums">{shiftWhen(a.startAt, a.endAt)}</div>
                    </TableCell>
                    <TableCell>{a.source === 'ai' ? 'AssignAI' : 'Manual'}</TableCell>
                    <TableCell>{a.status === 'cancelled' ? <span className="text-muted-foreground">Cancelled</span> : <AssignmentStatus status={a.status} />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No assignments yet.</p>
        )}
      </section>

      <Dialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.title}</DialogTitle>
            <DialogDescription>{pending?.body} The change is recorded in the audit log.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant={pending?.destructive ? 'destructive' : 'default'}
              disabled={update.isPending}
              onClick={() =>
                pending &&
                update.mutate(pending.patch, {
                  onSuccess: () => {
                    toast.success('Saved');
                    setPending(null);
                  },
                  onError: (e) => toast.error(e.message),
                })
              }
            >
              {pending?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** App Flow §2: profile, term stats, history, role/status actions. */
export default function MemberViewPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Member">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <Profile selfId={me!.member!.id} />
          </Suspense>
        </AdviserShell>
      )}
    </AppGate>
  );
}
