'use client';

import { ChevronDownIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { hoursLabel, shiftWhen } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { PickDTO, ResultDTO, ShiftResultDTO } from '../../../shared/ai';
import type { Constraints, GroupSpec } from '../../../shared/constraints';

const REASON_LABEL: Record<string, string> = {
  CLASS_CONFLICT: 'Class conflict',
  UNAVAILABLE: 'Unavailable',
  DOUBLE_BOOKED: 'Double-booked',
  ALREADY_ON_SHIFT: 'Already added',
  SCHEDULE_MISSING: 'Schedule missing',
  PINNED_EXCLUDE: 'Removed by you',
};
const RELAX_LABEL: Record<string, string> = {
  colleges: 'Allow any college',
  gender: 'Allow any gender',
  tenure: 'Allow new and returning',
  yearLevels: 'Allow any year level',
  height: 'Drop the height limit',
  allowClassConflicts: 'Allow class conflicts',
};

/** "2 × Female · CCE · New · Y1–2 · 170–180 cm" */
export function groupSummary(g: GroupSpec | undefined): string {
  if (!g) return 'Anyone';
  const parts = [
    g.count === null ? 'Rest' : `${g.count} ×`,
    g.gender === 'F' ? 'Female' : g.gender === 'M' ? 'Male' : 'Any gender',
    g.colleges.length ? g.colleges.join('/') : null,
    g.tenure === 'new' ? 'New' : g.tenure === 'returning' ? 'Returning' : null,
    g.yearLevels.length ? `Y${g.yearLevels.join(',')}` : null,
    g.heightMinCm || g.heightMaxCm ? `${g.heightMinCm ?? ''}–${g.heightMaxCm ?? ''} cm` : null,
  ].filter(Boolean);
  return parts.join(' · ').replace('× ·', '×');
}

/** Constraints with one filter dropped from a group (the shortfall "Allow …" button). */
export function applyRelaxation(c: Constraints, groupIndex: number, relax: string): Constraints {
  if (relax === 'allowClassConflicts') return { ...c, allowClassConflicts: true };
  const patch: Partial<GroupSpec> =
    relax === 'colleges' ? { colleges: [] } : relax === 'gender' ? { gender: null } : relax === 'tenure' ? { tenure: null } : relax === 'yearLevels' ? { yearLevels: [] } : { heightMinCm: null, heightMaxCm: null };
  return { ...c, groups: c.groups.map((g, i) => (i === groupIndex ? { ...g, ...patch } : g)) };
}

function PickCard({ p, avgHours, onRemove }: { p: PickDTO; avgHours: number; onRemove: () => void }) {
  const m = p.member;
  const pct = Math.max(4, Math.min(100, ((p.score.total + 5) / 20) * 100));
  return (
    <li className="rounded-lg border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.name}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {[m.collegeCode, m.yearLevel && `Year ${m.yearLevel}`, `${hoursLabel(m.termHours)} this term`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="size-7" onClick={onRemove} aria-label={`Remove ${m.name} from the picks`}>
          <XIcon className="size-4" />
        </Button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      {p.softFlags.includes('CLASS_CONFLICT') && <p className="mt-1 text-xs text-warning-foreground">⚠ Class conflict (allowed)</p>}
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-muted-foreground">Why</summary>
        <ul className="mt-1 flex flex-wrap gap-1">
          <li className="rounded-full border px-2 py-0.5">
            {hoursLabel(m.termHours)} vs avg {hoursLabel(Math.round(avgHours * 10) / 10)}
          </li>
          <li className="rounded-full border px-2 py-0.5">{m.daysSinceLast === null ? 'Not assigned yet' : `${m.daysSinceLast} days since last`}</li>
          <li className="rounded-full border px-2 py-0.5">
            Attendance {m.attended}/{m.attended + m.noShow}
          </li>
        </ul>
      </details>
    </li>
  );
}

function ShiftPicksSection({
  s,
  constraints,
  avgHours,
  note,
  onRemove,
  onRelax,
}: {
  s: ShiftResultDTO;
  constraints: Constraints;
  avgHours: number;
  note?: string;
  onRemove: (memberId: number) => void;
  onRelax: (groupIndex: number, relax: string) => void;
}) {
  const r = s.result;
  const excluded = Object.entries(r.excluded).filter(([, n]) => n > 0);
  return (
    <details open className="group rounded-lg border">
      <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm">
        <ChevronDownIcon className="size-4 transition-transform group-open:rotate-0 -rotate-90" aria-hidden />
        <span className="font-semibold">{s.label}</span>
        <span className="text-muted-foreground tabular-nums">· {shiftWhen(s.startAt, s.endAt)}</span>
        <span className="ml-auto tabular-nums">
          {r.picks.length}/{s.remainingSlots}
        </span>
      </summary>
      <div className="space-y-3 border-t p-3">
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {r.groups.map((g) => {
          const picks = r.picks.filter((p) => p.groupIndex === g.index);
          return (
            <div key={g.index} className="space-y-2">
              <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Group {g.index + 1} · {groupSummary(constraints.groups[g.index])}
              </p>
              {picks.length > 0 && (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {picks.map((p) => (
                    <PickCard key={p.memberId} p={p} avgHours={avgHours} onRemove={() => onRemove(p.memberId)} />
                  ))}
                </ul>
              )}
              {g.shortfall > 0 && (
                <div role="status" className="flex flex-wrap items-center gap-2 rounded-md bg-warning px-3 py-2 text-xs text-warning-foreground">
                  <TriangleAlertIcon className="size-3.5" aria-hidden />
                  <span className="flex-1">
                    Need {g.requested}, found {g.filled}.
                  </span>
                  {g.suggestion && (
                    <Button size="sm" variant="outline" className="h-7 bg-background" onClick={() => onRelax(g.index, g.suggestion!.relax)}>
                      {RELAX_LABEL[g.suggestion.relax] ?? g.suggestion.relax} (+{g.suggestion.wouldAdd})
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {excluded.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Excluded ({excluded.reduce((n, [, c]) => n + c, 0)})</summary>
            <p className="mt-1">{excluded.map(([k, n]) => `${REASON_LABEL[k] ?? k} ${n}`).join(' · ')}</p>
          </details>
        )}
      </div>
    </details>
  );
}

/** App Flow §7.4 recommendations: header with totals + Approve, per-shift sections (one list in same-team mode). */
export function PicksPanel({
  result,
  constraints,
  busy,
  onRemove,
  onRelax,
  onApprove,
}: {
  result: ResultDTO;
  constraints: Constraints;
  busy: boolean;
  onRemove: (memberId: number) => void;
  onRelax: (groupIndex: number, relax: string) => void;
  onApprove: () => void;
}) {
  const sameTeam = result.teamMode === 'same_team' && result.perShift.length > 1;
  const sections = sameTeam ? result.perShift.slice(0, 1) : result.perShift;
  const picked = result.perShift.reduce((n, s) => n + s.result.picks.length, 0);
  const open = result.perShift.reduce((n, s) => n + s.remainingSlots, 0);
  return (
    <section aria-label="Recommendations" className={cn('space-y-3', busy && 'opacity-60')}>
      {sections.map((s) => (
        <ShiftPicksSection
          key={s.shiftId}
          s={s}
          constraints={constraints}
          avgHours={result.avgTermHours}
          note={sameTeam ? `Assigned to all ${result.perShift.length} shifts` : undefined}
          onRemove={onRemove}
          onRelax={onRelax}
        />
      ))}
      {!result.perShift.length && <p className="text-sm text-muted-foreground">Pick at least one shift that hasn’t ended.</p>}
      {/* Approve bar (Design Brief §7): sticky, with the remaining-after pill. */}
      <div className="sticky bottom-0 flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3 shadow-[0_8px_24px_rgb(0_0_0/0.08)]">
        <span className="text-sm tabular-nums">
          <strong>{picked}</strong> of {open} open {open === 1 ? 'slot' : 'slots'}
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground tabular-nums">Remaining after: {Math.max(0, open - picked)}</span>
        <Button className="ml-auto" disabled={!picked || busy} onClick={onApprove}>
          Approve {picked}
        </Button>
      </div>
    </section>
  );
}
