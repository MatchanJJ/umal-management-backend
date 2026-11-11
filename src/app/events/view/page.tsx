'use client';

import { MapPinIcon, PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { toast } from 'sonner';
import { eventSpan } from '@/components/events/EventList';
import { AssignAITab } from '@/components/assignai/AssignAITab';
import { RosterTab } from '@/components/events/RosterTab';
import { StaffingBar } from '@/components/events/StaffingBar';
import { StatusBadge } from '@/components/events/StatusBadge';
import { AppGate } from '@/components/layout/AppGate';
import { AppShell } from '@/components/layout/MemberShell';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCancelEvent, useEvent, usePatchEvent, useRoster } from '@/lib/api';
import { shiftWhen } from '@/lib/format';
import type { EventDTO } from '../../../../shared/events';

function CancelDialog({ event, open, onClose }: { event: EventDTO; open: boolean; onClose: () => void }) {
  const cancel = useCancelEvent(event.id);
  const [reason, setReason] = useState('');
  const staffed = event.shifts.reduce((n, s) => n + s.activeCount, 0);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel {event.title}?</DialogTitle>
          <DialogDescription>{staffed ? `Its ${staffed} volunteer assignment(s) will be cancelled too.` : 'This can’t be undone.'}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea id="cancel-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep event
          </Button>
          <Button
            variant="destructive"
            disabled={!reason.trim() || cancel.isPending}
            onClick={() =>
              cancel.mutate(
                { reason: reason.trim(), expectedVersion: event.version },
                { onSuccess: () => (toast.success('Event cancelled'), onClose()), onError: (e) => toast.error(e.message) },
              )
            }
          >
            Cancel event
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MemberRoster({ event }: { event: EventDTO }) {
  const { data } = useRoster(event.status === 'published' ? event.id : null);
  return (
    <div className="space-y-3">
      {event.shifts.map((s) => {
        const names = data?.shifts.find((x) => x.shiftId === s.id)?.assignments.map((a) => a.name) ?? [];
        return (
          <div key={s.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">
                {s.label} <span className="font-normal text-muted-foreground tabular-nums">· {shiftWhen(s.startAt, s.endAt)}</span>
              </p>
              <StaffingBar filled={s.activeCount} required={s.requiredVolunteers} className="w-40" />
            </div>
            {names.length > 0 && <p className="mt-2 text-sm text-muted-foreground">{names.join(', ')}</p>}
          </div>
        );
      })}
    </div>
  );
}

function View({ adviser }: { adviser: boolean }) {
  const id = Number(useSearchParams().get('id')) || null;
  const { data: event, isLoading, isError } = useEvent(id);
  const patch = usePatchEvent(id ?? 0);
  const [cancelling, setCancelling] = useState(false);
  const [tab, setTab] = useState('roster');
  if (isError) return <p className="text-sm text-destructive">Event not found.</p>;
  if (isLoading || !event) return <Skeleton className="h-96" />;

  const editable = event.status === 'draft' || event.status === 'published';
  const filled = event.shifts.reduce((n, s) => n + s.activeCount, 0);
  const required = event.shifts.reduce((n, s) => n + s.requiredVolunteers, 0);
  const setStatus = (status: 'draft' | 'published') =>
    patch.mutate(
      { status, expectedVersion: event.version },
      { onSuccess: () => toast.success(status === 'published' ? 'Published' : 'Moved back to draft'), onError: (e) => toast.error(e.message) },
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold">{event.title}</h2>
            <StatusBadge status={event.status} />
          </div>
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground tabular-nums">
            <span>{eventSpan(event)}</span>
            {event.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="size-3.5" aria-hidden /> {event.venue}
              </span>
            )}
          </p>
          {event.cancelReason && <p className="text-sm text-destructive">Cancelled: {event.cancelReason}</p>}
          {event.description && <p className="max-w-2xl pt-2 text-sm whitespace-pre-line">{event.description}</p>}
        </div>
        {adviser && editable && (
          <div className="flex flex-wrap gap-2">
            {event.status === 'draft' ? (
              <Button disabled={patch.isPending} onClick={() => setStatus('published')}>
                Publish
              </Button>
            ) : (
              <Button variant="outline" disabled={patch.isPending || filled > 0} title={filled ? 'Cancel its volunteers first' : undefined} onClick={() => setStatus('draft')}>
                Unpublish
              </Button>
            )}
            <Button variant="outline" asChild>
              <Link href={`/events/edit/?id=${event.id}`}>
                <PencilIcon className="size-4" aria-hidden /> Edit
              </Link>
            </Button>
            <Button variant="ghost" className="text-destructive" onClick={() => setCancelling(true)}>
              Cancel event
            </Button>
          </div>
        )}
      </div>
      <StaffingBar filled={filled} required={required} className="max-w-md" />

      {adviser ? (
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList>
            <TabsTrigger value="roster">Roster</TabsTrigger>
            <TabsTrigger value="assignai">AssignAI</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="roster">
            <RosterTab event={event} />
          </TabsContent>
          <TabsContent value="assignai">
            {editable ? (
              <AssignAITab event={event} onApproved={() => setTab('roster')} />
            ) : (
              <p className="text-sm text-muted-foreground">AssignAI is only available for draft and published events.</p>
            )}
          </TabsContent>
          {/* Attendance (Task 6.1) and Activity (Task 6.3) arrive in later tasks. */}
          <TabsContent value="attendance">
            <p className="text-sm text-muted-foreground">Attendance marking is coming in a later update.</p>
          </TabsContent>
          <TabsContent value="activity">
            <p className="text-sm text-muted-foreground">The activity log is coming in a later update.</p>
          </TabsContent>
        </Tabs>
      ) : (
        <MemberRoster event={event} />
      )}
      {adviser && <CancelDialog event={event} open={cancelling} onClose={() => setCancelling(false)} />}
    </div>
  );
}

export default function EventViewPage() {
  return (
    <AppGate require="onboarded">
      {(me) => (
        <AppShell me={me!} title="Event">
          <Suspense fallback={<Skeleton className="h-96" />}>
            <View adviser={me!.member!.role === 'adviser'} />
          </Suspense>
        </AppShell>
      )}
    </AppGate>
  );
}
