'use client';

import { SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, useAddAssignments, useCandidates } from '@/lib/api';
import { hoursLabel } from '@/lib/format';
import type { EventDTO } from '../../../shared/events';
import { EligibilityBadge } from './EligibilityBadge';
import { ShiftChip } from './ShiftChip';

/** App Flow §6 manual add: candidates for one shift, ⛔ rows disabled, ⚠ rows need an explicit override. */
export function AddVolunteersDialog({ event, shiftId, onClose }: { event: EventDTO; shiftId: number | null; onClose: () => void }) {
  const [current, setCurrent] = useState(shiftId);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const shown = current ?? shiftId;
  const shift = event.shifts.find((s) => s.id === shown);
  const { data, isLoading } = useCandidates(event.id, shown, search.trim());
  const add = useAddAssignments(event.id);
  const remaining = shift ? shift.requiredVolunteers - shift.activeCount : 0;

  const toggle = (set: Set<number>, id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };
  const switchShift = (id: number) => {
    setCurrent(id);
    setPicked(new Set());
    setOverrides(new Set());
    setError(null);
  };

  async function submit() {
    if (!shift) return;
    setError(null);
    try {
      await add.mutateAsync({
        items: [{ shiftId: shift.id, memberIds: [...picked], overrideConflictIds: [...overrides].filter((id) => picked.has(id)) }],
        source: 'manual',
        expectedVersion: event.version,
      });
      toast.success(`Added ${picked.size} to ${shift.label}`);
      setPicked(new Set());
      setOverrides(new Set());
    } catch (e) {
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
        toast.error('Roster changed by someone else. Refreshed — please try again.');
      } else if (e instanceof ApiError && e.code === 'OVER_CAPACITY') {
        setError(`Only ${remaining} slot(s) left on ${shift.label}.`);
      } else {
        setError(e instanceof ApiError ? e.message : 'Could not add volunteers');
      }
    }
  }

  return (
    <Dialog open={shiftId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add volunteers</DialogTitle>
          <DialogDescription>
            {shift ? `${shift.label}: ${remaining} of ${shift.requiredVolunteers} slots open` : 'Pick a shift'}
          </DialogDescription>
        </DialogHeader>
        {event.shifts.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Shift">
            {event.shifts.map((s) => (
              <ShiftChip key={s.id} shift={s} selected={s.id === shown} onClick={() => switchShift(s.id)} />
            ))}
          </div>
        )}
        <div className="relative">
          <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input className="pl-8" placeholder="Search name, email or student no." value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search members" />
        </div>
        <div className="max-h-[50svh] overflow-y-auto rounded-lg border">
          {isLoading ? (
            <Skeleton className="m-3 h-40" />
          ) : !data?.items.length ? (
            <p className="p-6 text-center text-sm text-muted-foreground">No members found.</p>
          ) : (
            <ul className="divide-y">
              {data.items.map(({ member: m, eligibility }) => {
                const blocked = eligibility.hard.length > 0;
                const conflict = eligibility.soft.includes('CLASS_CONFLICT');
                const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
                const checked = picked.has(m.id);
                return (
                  <li key={m.id} className={blocked ? 'bg-muted/40' : undefined}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 has-disabled:cursor-not-allowed has-disabled:opacity-60">
                      <input type="checkbox" className="size-4 accent-[var(--primary)]" disabled={blocked} checked={checked} onChange={() => setPicked(toggle(picked, m.id))} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{name}</span>
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          {[m.collegeCode, m.yearLevel && `Year ${m.yearLevel}`, `${hoursLabel(m.termHours)} this term`].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <EligibilityBadge eligibility={eligibility} />
                    </label>
                    {conflict && checked && (
                      <label className="flex items-center gap-2 px-10 pb-2.5 text-xs text-warning-foreground">
                        <input type="checkbox" className="size-3.5" checked={overrides.has(m.id)} onChange={() => setOverrides(toggle(overrides, m.id))} />
                        Override class conflict
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          <Button disabled={!picked.size || add.isPending || picked.size > remaining} onClick={submit}>
            Add {picked.size || ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
