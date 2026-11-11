'use client';

import { XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DAY_NAMES } from '../../../shared/schedule';
import type { GridEntry } from './WeekGrid';

/** Classes grouped by day: the mobile view, and the list alternative to the grid on desktop (Design Brief §8). */
export function ClassList({ entries, onRemove }: { entries: GridEntry[]; onRemove?: (index: number) => void }) {
  const indexed = entries.map((e, i) => ({ e, i })).sort((a, b) => a.e.dayOfWeek - b.e.dayOfWeek || a.e.startTime.localeCompare(b.e.startTime));
  if (!indexed.length) return <p className="py-8 text-center text-sm text-muted-foreground">No classes added yet.</p>;
  return (
    <div className="space-y-4">
      {DAY_NAMES.map((day, d) => {
        const rows = indexed.filter(({ e }) => e.dayOfWeek === d + 1);
        if (!rows.length) return null;
        return (
          <section key={day} aria-labelledby={`day-${d + 1}`}>
            <h3 id={`day-${d + 1}`} className="mb-1 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
              {day}
            </h3>
            <ul className="divide-y rounded-lg border">
              {rows.map(({ e, i }) => (
                <li key={i} className="flex items-center gap-3 border-l-2 border-l-primary px-3 py-2">
                  <span className="w-28 shrink-0 text-sm tabular-nums">
                    {e.startTime}–{e.endTime}
                  </span>
                  <span className="flex-1 truncate text-sm font-medium">{e.label || 'Class'}</span>
                  {onRemove && (
                    <Button variant="ghost" size="icon" onClick={() => onRemove(i)} aria-label={`Remove ${e.label || 'class'} ${day} ${e.startTime}`}>
                      <XIcon className="size-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
