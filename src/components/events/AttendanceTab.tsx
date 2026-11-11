'use client';

import { CheckCheckIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AssignmentStatus } from '@/components/member/AssignmentStatus';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, useMarkAttendance, useRoster } from '@/lib/api';
import { shiftWhen } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AttendanceStatus } from '../../../shared/assignments';
import type { EventDTO } from '../../../shared/events';
import { manilaNow } from '../../../shared/time';

const OPTIONS: { value: AttendanceStatus; label: string; on: string }[] = [
  { value: 'attended', label: 'Attended', on: 'has-checked:bg-success has-checked:text-white' },
  { value: 'no_show', label: 'No-show', on: 'has-checked:bg-destructive has-checked:text-white' },
  { value: 'excused', label: 'Excused', on: 'has-checked:bg-warning has-checked:text-warning-foreground' },
];

function Segmented({ id, name, value, onChange }: { id: number; name: string; value: string; onChange: (v: AttendanceStatus) => void }) {
  return (
    <fieldset className="inline-flex rounded-md border p-0.5">
      <legend className="sr-only">Attendance for {name}</legend>
      {OPTIONS.map((o) => (
        <label
          key={o.value}
          className={cn(
            'cursor-pointer rounded px-2.5 py-1 text-xs font-medium text-muted-foreground has-focus-visible:ring-2 has-focus-visible:ring-ring',
            o.on,
          )}
        >
          <input type="radio" className="sr-only" name={`att-${id}`} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

/** FR-27 / App Flow §8: per-shift attendance once the shift has ended; one Save for all changes. */
export function AttendanceTab({ event }: { event: EventDTO }) {
  const { data, isLoading } = useRoster(event.id);
  const save = useMarkAttendance(event.id);
  const [draft, setDraft] = useState<Partial<Record<number, AttendanceStatus>>>({});

  if (event.status === 'draft') return <p className="text-sm text-muted-foreground">Publish the event to take attendance.</p>;
  if (event.status === 'cancelled') return <p className="text-sm text-muted-foreground">This event was cancelled.</p>;
  if (isLoading || !data) return <Skeleton className="h-48" />;

  const now = manilaNow();
  const rows = data.shifts.flatMap((s) => s.assignments);
  const entries = rows.filter((a) => draft[a.id] && draft[a.id] !== a.status).map((a) => ({ assignmentId: a.id, status: draft[a.id]! }));

  const submit = () =>
    save.mutate(
      { entries },
      {
        onSuccess: (r) => {
          setDraft({});
          toast.success(r.eventStatus === 'completed' && event.status !== 'completed' ? 'Attendance saved. The event is now completed.' : 'Attendance saved');
        },
        onError: (e) => toast.error(e instanceof ApiError && e.code === 'VERSION_CONFLICT' ? 'The roster changed. Check the list and save again.' : e.message),
      },
    );

  return (
    <div className="space-y-4">
      {data.shifts.map((s) => {
        const ended = now >= s.endAt;
        const marked = s.assignments.filter((a) => (draft[a.id] ?? a.status) !== 'assigned').length;
        return (
          <section key={s.shiftId} aria-labelledby={`att-shift-${s.shiftId}`} className="rounded-lg border">
            <header className="flex flex-wrap items-center gap-3 border-b bg-sidebar px-4 py-3">
              <div className="min-w-0 flex-1">
                <h3 id={`att-shift-${s.shiftId}`} className="font-semibold">
                  {s.label}
                </h3>
                <p className="text-[13px] text-muted-foreground tabular-nums">{shiftWhen(s.startAt, s.endAt)}</p>
              </div>
              {ended ? (
                <>
                  <span className="text-[13px] text-muted-foreground tabular-nums">
                    {marked} / {s.assignments.length} marked
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!s.assignments.length}
                    onClick={() => setDraft((d) => ({ ...d, ...Object.fromEntries(s.assignments.map((a) => [a.id, 'attended' as const])) }))}
                  >
                    <CheckCheckIcon className="size-4" aria-hidden /> Mark all attended
                  </Button>
                </>
              ) : (
                <span className="text-[13px] text-muted-foreground">Opens when the shift ends</span>
              )}
            </header>
            {s.assignments.length ? (
              <ul className="divide-y">
                {s.assignments.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                    <span className="flex-1 font-medium">{a.name}</span>
                    {ended ? (
                      <Segmented id={a.id} name={a.name} value={draft[a.id] ?? a.status} onChange={(v) => setDraft((d) => ({ ...d, [a.id]: v }))} />
                    ) : (
                      <AssignmentStatus status={a.status} />
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-3 text-sm text-muted-foreground">No volunteers on this shift.</p>
            )}
          </section>
        );
      })}
      {entries.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-lg border bg-background px-4 py-3 shadow-sm">
          <span className="text-sm text-muted-foreground">
            {entries.length} unsaved {entries.length === 1 ? 'change' : 'changes'}
          </span>
          <Button variant="ghost" onClick={() => setDraft({})}>
            Discard
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Save attendance
          </Button>
        </div>
      )}
    </div>
  );
}
