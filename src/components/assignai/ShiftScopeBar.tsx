'use client';

import { ShiftChip } from '@/components/events/ShiftChip';
import { cn } from '@/lib/utils';

type ScopeShift = { id: number; label: string; startAt: string; endAt: string; requiredVolunteers: number; activeCount: number };

/** App Flow §7.1: shift chips + "All shifts"; the team-mode toggle appears when more than one shift is in scope. */
export function ShiftScopeBar({
  shifts,
  scope,
  onScope,
  teamMode,
  onTeamMode,
}: {
  shifts: ScopeShift[];
  scope: number[];
  onScope: (ids: number[]) => void;
  teamMode: 'per_shift' | 'same_team';
  onTeamMode: (m: 'per_shift' | 'same_team') => void;
}) {
  if (shifts.length <= 1) return null; // single-shift events don't need a scope bar
  const all = shifts.every((s) => scope.includes(s.id));
  const toggle = (id: number) => {
    const next = scope.includes(id) ? scope.filter((x) => x !== id) : [...scope, id];
    if (next.length) onScope(next);
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Shifts in scope">
        <button
          type="button"
          aria-pressed={all}
          onClick={() => onScope(shifts.map((s) => s.id))}
          className={cn('rounded-full border px-3 py-1 text-xs font-semibold whitespace-nowrap', all ? 'border-primary bg-[#FBE9EA] text-primary' : 'hover:bg-sidebar-accent')}
        >
          All shifts
        </button>
        {shifts.map((s) => (
          <ShiftChip key={s.id} shift={s} selected={scope.includes(s.id)} onClick={() => toggle(s.id)} />
        ))}
      </div>
      {scope.length > 1 && (
        <div role="radiogroup" aria-label="Team mode" className="inline-flex rounded-md border p-0.5 text-xs">
          {(
            [
              ['same_team', 'Same team for all'],
              ['per_shift', 'Different per shift'],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={teamMode === m}
              onClick={() => onTeamMode(m)}
              className={cn('rounded px-3 py-1', teamMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-sidebar-accent')}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
