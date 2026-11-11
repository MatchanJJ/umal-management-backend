'use client';

import { XIcon } from 'lucide-react';
import { DAY_NAMES } from '../../../shared/schedule';

export type GridEntry = { dayOfWeek: number; startTime: string; endTime: string; label?: string | null };

const START = 7 * 60; // 07:00
const END = 21 * 60; // 21:00
const SLOTS = (END - START) / 30; // 30-min rows
const DAYS = 6; // Mon–Sat (Sundays show in the list view)

const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Grid placement for an entry: rows are 1-based 30-min slots from 07:00 (row 1 is the header), clipped to 07:00–21:00. */
function placement(e: GridEntry) {
  const s = Math.max(mins(e.startTime), START);
  const end = Math.min(mins(e.endTime), END);
  if (e.dayOfWeek > DAYS || end <= s) return null;
  const row = Math.floor((s - START) / 30) + 2;
  const span = Math.max(1, Math.ceil((end - START) / 30) + 2 - row);
  return { gridRow: `${row} / span ${span}`, gridColumn: `${e.dayOfWeek + 1}` };
}

/** Design Brief §6 schedule grid (desktop). Mon–Sat × 07:00–21:00 in 30-min rows. */
export function WeekGrid({ entries, onRemove }: { entries: GridEntry[]; onRemove?: (index: number) => void }) {
  return (
    <div
      className="grid overflow-x-auto rounded-lg border text-xs"
      style={{ gridTemplateColumns: `3.5rem repeat(${DAYS}, minmax(6rem, 1fr))`, gridTemplateRows: `2rem repeat(${SLOTS}, 1.25rem)` }}
      role="grid"
      aria-label="Weekly class schedule"
    >
      <div className="sticky top-0 border-b bg-sidebar" style={{ gridRow: 1, gridColumn: 1 }} />
      {DAY_NAMES.slice(0, DAYS).map((d, i) => (
        <div
          key={d}
          role="columnheader"
          className="flex items-center justify-center border-b border-l bg-sidebar font-semibold tracking-[0.04em] text-muted-foreground uppercase"
          style={{ gridRow: 1, gridColumn: i + 2 }}
        >
          {d.slice(0, 3)}
        </div>
      ))}
      {Array.from({ length: SLOTS }, (_, i) => (
        <div
          key={i}
          aria-hidden
          className={i % 2 === 0 ? 'border-t pr-1 text-right text-muted-foreground tabular-nums' : 'border-t border-dashed border-border/60'}
          style={{ gridRow: i + 2, gridColumn: `1 / span ${DAYS + 1}` }}
        >
          {i % 2 === 0 && `${String(7 + i / 2).padStart(2, '0')}:00`}
        </div>
      ))}
      {entries.map((e, i) => {
        const at = placement(e);
        if (!at) return null;
        return (
          <div
            key={`${e.dayOfWeek}-${e.startTime}-${i}`}
            data-slot="class-block"
            className="group relative z-10 m-px overflow-hidden rounded-sm border-l-2 border-primary bg-[#FBE9EA] px-1.5 py-0.5 text-foreground"
            style={at}
          >
            <p className="truncate font-semibold">{e.label || 'Class'}</p>
            <p className="text-muted-foreground tabular-nums">
              {e.startTime}–{e.endTime}
            </p>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-primary/10 focus-visible:opacity-100"
                aria-label={`Remove ${e.label || 'class'} ${DAY_NAMES[e.dayOfWeek - 1]} ${e.startTime}`}
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
