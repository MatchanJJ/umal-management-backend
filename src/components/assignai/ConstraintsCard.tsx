'use client';

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { emptyGroup, type Constraints, type GroupSpec, type Priority } from '../../../shared/constraints';
import { PRIORITIES } from '../../../shared/enums';

export const PRIORITY_LABEL: Record<Priority, string> = {
  least_assigned_first: 'Fewest hours first',
  reliable_first: 'Most reliable first',
  new_first: 'New members first',
  returning_first: 'Returning members first',
  tallest_first: 'Tallest first',
  shortest_first: 'Shortest first',
  male_first: 'Males first',
  female_first: 'Females first',
};

/** Dotted paths that differ between two constraint states (used to flash changed fields after a turn). */
export function changedFields(prev: Constraints, next: Constraints): Set<string> {
  const out = new Set<string>();
  const n = Math.max(prev.groups.length, next.groups.length);
  for (let i = 0; i < n; i++) {
    const a = prev.groups[i];
    const b = next.groups[i];
    for (const k of Object.keys(emptyGroup()) as (keyof GroupSpec)[]) {
      if (JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k])) out.add(`groups.${i}.${k}`);
    }
  }
  for (const k of ['allowClassConflicts', 'priorities', 'teamMode'] as const) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) out.add(k);
  }
  return out;
}

const field = 'h-8 rounded-md border bg-background px-2 text-sm';

/** Wraps one field; gold outline for 2 s when the last turn changed it (Design Brief §7). */
function Cell({ changed, children, className }: { changed: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div data-changed={changed ? 'true' : 'false'} className={cn('rounded-md transition-shadow duration-150', changed && 'animate-[pulse_1s_ease-out_2] ring-2 ring-secondary', className)}>
      {children}
    </div>
  );
}

function GroupRow({
  g,
  i,
  colleges,
  changed,
  onChange,
  onRemove,
}: {
  g: GroupSpec;
  i: number;
  colleges: { code: string; name: string }[];
  changed: Set<string>;
  onChange: (g: GroupSpec) => void;
  onRemove?: () => void;
}) {
  const ch = (k: keyof GroupSpec) => changed.has(`groups.${i}.${k}`);
  const num = (v: string) => (v === '' ? null : Number(v));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  return (
    <fieldset className="space-y-2 rounded-lg border p-3">
      <legend className="px-1 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Group {i + 1}</legend>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Cell changed={ch('count')}>
          <input
            aria-label={`Group ${i + 1} count`}
            type="number"
            min={1}
            max={100}
            placeholder="Rest"
            className={cn(field, 'w-16 tabular-nums')}
            value={g.count ?? ''}
            onChange={(e) => onChange({ ...g, count: num(e.target.value) })}
          />
        </Cell>
        <span aria-hidden>×</span>
        <Cell changed={ch('gender')}>
          <select aria-label={`Group ${i + 1} gender`} className={field} value={g.gender ?? ''} onChange={(e) => onChange({ ...g, gender: (e.target.value || null) as GroupSpec['gender'] })}>
            <option value="">Any gender</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </select>
        </Cell>
        <Cell changed={ch('tenure')}>
          <select aria-label={`Group ${i + 1} tenure`} className={field} value={g.tenure ?? ''} onChange={(e) => onChange({ ...g, tenure: (e.target.value || null) as GroupSpec['tenure'] })}>
            <option value="">New or returning</option>
            <option value="new">New members</option>
            <option value="returning">Returning</option>
          </select>
        </Cell>
        <Cell changed={ch('heightMinCm') || ch('heightMaxCm')} className="flex items-center gap-1">
          <input aria-label={`Group ${i + 1} min height`} type="number" min={100} max={230} placeholder="min cm" className={cn(field, 'w-20')} value={g.heightMinCm ?? ''} onChange={(e) => onChange({ ...g, heightMinCm: num(e.target.value) })} />
          <span aria-hidden>–</span>
          <input aria-label={`Group ${i + 1} max height`} type="number" min={100} max={230} placeholder="max cm" className={cn(field, 'w-20')} value={g.heightMaxCm ?? ''} onChange={(e) => onChange({ ...g, heightMaxCm: num(e.target.value) })} />
        </Cell>
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="ml-auto" onClick={onRemove} aria-label={`Remove group ${i + 1}`}>
            <Trash2Icon className="size-4" />
          </Button>
        )}
      </div>
      <Cell changed={ch('colleges')}>
        <div className="flex flex-wrap gap-1" role="group" aria-label={`Group ${i + 1} colleges`}>
          {colleges.map((c) => {
            const on = g.colleges.includes(c.code);
            return (
              <button
                key={c.code}
                type="button"
                aria-pressed={on}
                title={c.name}
                onClick={() => onChange({ ...g, colleges: toggle(g.colleges, c.code) })}
                className={cn('rounded-full border px-2 py-0.5 text-xs', on ? 'border-primary bg-[#FBE9EA] text-primary' : 'text-muted-foreground hover:bg-sidebar-accent')}
              >
                {c.code}
              </button>
            );
          })}
          {!g.colleges.length && <span className="px-1 text-xs text-muted-foreground">Any college</span>}
        </div>
      </Cell>
      <Cell changed={ch('yearLevels')}>
        <div className="flex items-center gap-1" role="group" aria-label={`Group ${i + 1} year levels`}>
          {[1, 2, 3, 4, 5].map((y) => {
            const on = g.yearLevels.includes(y);
            return (
              <button
                key={y}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ ...g, yearLevels: toggle(g.yearLevels, y).sort() })}
                className={cn('size-7 rounded-md border text-xs tabular-nums', on ? 'border-primary bg-[#FBE9EA] text-primary' : 'text-muted-foreground')}
              >
                Y{y}
              </button>
            );
          })}
          {!g.yearLevels.length && <span className="px-1 text-xs text-muted-foreground">Any year</span>}
        </div>
      </Cell>
    </fieldset>
  );
}

function PriorityList({ value, onChange, changed }: { value: Priority[]; onChange: (p: Priority[]) => void; changed: boolean }) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...value];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const unused = PRIORITIES.filter((p) => !value.includes(p));
  return (
    <Cell changed={changed} className="space-y-1">
      <p className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Priorities (in order)</p>
      <ol className="space-y-1">
        {value.map((p, i) => (
          <li key={p} className="flex items-center gap-1 text-sm">
            <span className="w-4 text-muted-foreground tabular-nums">{i + 1}.</span>
            <span className="flex-1">{PRIORITY_LABEL[p]}</span>
            <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${PRIORITY_LABEL[p]} up`}>
              <ArrowUpIcon className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" disabled={i === value.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${PRIORITY_LABEL[p]} down`}>
              <ArrowDownIcon className="size-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onChange(value.filter((x) => x !== p))} aria-label={`Remove ${PRIORITY_LABEL[p]}`}>
              <Trash2Icon className="size-3.5" />
            </Button>
          </li>
        ))}
      </ol>
      {value.length < 4 && unused.length > 0 && (
        <select aria-label="Add priority" className={cn(field, 'w-full text-muted-foreground')} value="" onChange={(e) => e.target.value && onChange([...value, e.target.value as Priority])}>
          <option value="">+ Add priority…</option>
          {unused.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      )}
    </Cell>
  );
}

/** Design Brief §7: editable rows, never raw JSON. Every edit emits a full, valid Constraints object. */
export function ConstraintsCard({
  value,
  colleges,
  onChange,
  changed = new Set(),
}: {
  value: Constraints;
  colleges: { code: string; name: string }[];
  onChange: (c: Constraints) => void;
  changed?: Set<string>;
}) {
  const groups = value.groups.length ? value.groups : [emptyGroup()];
  const setGroups = (gs: GroupSpec[]) => onChange({ ...value, groups: gs });
  return (
    <section aria-label="Constraints" className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Constraints</h3>
      {groups.map((g, i) => (
        <GroupRow
          key={i}
          g={g}
          i={i}
          colleges={colleges}
          changed={changed}
          onChange={(ng) => setGroups(groups.map((x, j) => (j === i ? ng : x)))}
          onRemove={groups.length > 1 ? () => setGroups(groups.filter((_, j) => j !== i)) : undefined}
        />
      ))}
      {groups.length < 10 && (
        <Button type="button" variant="outline" size="sm" onClick={() => setGroups([...groups, { ...emptyGroup(), count: 1 }])}>
          <PlusIcon className="size-4" aria-hidden /> Add group
        </Button>
      )}
      <Cell changed={changed.has('allowClassConflicts')} className="flex items-center justify-between gap-2 py-1">
        <label htmlFor="allow-conflicts" className="text-sm">
          Class conflicts: <strong>{value.allowClassConflicts ? 'Allowed' : 'Not allowed'}</strong>
        </label>
        <Switch id="allow-conflicts" checked={value.allowClassConflicts} onCheckedChange={(v) => onChange({ ...value, allowClassConflicts: v })} />
      </Cell>
      <PriorityList value={value.priorities} changed={changed.has('priorities')} onChange={(p) => onChange({ ...value, priorities: p })} />
    </section>
  );
}
