'use client';

import { MoreHorizontalIcon, UserPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AssignmentStatus } from '@/components/member/AssignmentStatus';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useCancelAssignment, useRoster, type RosterAssignment } from '@/lib/api';
import { manilaNow } from '../../../shared/time';
import { shiftWhen } from '@/lib/format';
import type { EventDTO } from '../../../shared/events';
import { AddVolunteersDialog } from './AddVolunteersDialog';
import { StaffingBar } from './StaffingBar';

function RemoveDialog({ eventId, assignment, onClose }: { eventId: number; assignment: RosterAssignment | null; onClose: () => void }) {
  const cancel = useCancelAssignment(eventId);
  const [reason, setReason] = useState('');
  return (
    <Dialog open={!!assignment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {assignment?.name}?</DialogTitle>
          <DialogDescription>They&apos;ll be taken off this shift. The reason is kept in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="remove-reason">Reason</Label>
          <Textarea id="remove-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Keep
          </Button>
          <Button
            variant="destructive"
            disabled={reason.trim().length < 3 || cancel.isPending}
            onClick={() =>
              assignment &&
              cancel.mutate(
                { id: assignment.id, reason: reason.trim() },
                {
                  onSuccess: () => {
                    toast.success(`Removed ${assignment.name}`);
                    setReason('');
                    onClose();
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Remove
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** FR-15 / App Flow §6: roster grouped by shift with per-shift staffing. */
export function RosterTab({ event }: { event: EventDTO }) {
  const { data, isLoading } = useRoster(event.id);
  const [adding, setAdding] = useState<number | null>(null);
  const [removing, setRemoving] = useState<RosterAssignment | null>(null);
  const editable = event.status === 'draft' || event.status === 'published';
  const now = manilaNow();

  if (isLoading || !data) return <Skeleton className="h-48" />;
  return (
    <div className="space-y-4">
      {data.shifts.map((s) => {
        const open = editable && s.endAt > now && s.assignments.length < s.requiredVolunteers;
        return (
          <section key={s.shiftId} aria-labelledby={`shift-${s.shiftId}`} className="rounded-lg border">
            <header className="flex flex-wrap items-center gap-3 border-b bg-sidebar px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 id={`shift-${s.shiftId}`} className="font-semibold">
                  {s.label}
                </h3>
                <p className="text-[13px] text-muted-foreground tabular-nums">{shiftWhen(s.startAt, s.endAt)}</p>
              </div>
              <StaffingBar filled={s.assignments.length} required={s.requiredVolunteers} className="w-40" />
              <Button size="sm" variant="outline" disabled={!open} onClick={() => setAdding(s.shiftId)}>
                <UserPlusIcon className="size-4" aria-hidden /> Add volunteers
              </Button>
            </header>
            {s.assignments.length ? (
              <ul className="divide-y">
                {s.assignments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 font-medium">{a.name}</span>
                    {a.conflictOverride && <span className="text-xs text-warning-foreground">Class conflict overridden</span>}
                    <span className="text-xs text-muted-foreground uppercase">{a.source === 'ai' ? 'AssignAI' : 'Manual'}</span>
                    <AssignmentStatus status={a.status} />
                    {editable && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${a.name}`}>
                            <MoreHorizontalIcon className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="text-destructive" onSelect={() => setRemoving(a)}>
                            Remove from shift
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">No volunteers yet.</p>
            )}
          </section>
        );
      })}
      {/* Keyed by shift so reopening for another shift starts fresh. */}
      <AddVolunteersDialog key={adding ?? 'closed'} event={event} shiftId={adding} onClose={() => setAdding(null)} />
      <RemoveDialog eventId={event.id} assignment={removing} onClose={() => setRemoving(null)} />
    </div>
  );
}
