'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export type Bin = { label: string; count: number };

const NICE = [1, 2, 4, 5, 10, 20, 25, 50, 100];

/** "0 h" (never served) first, then up to ~8 equal-width bins (lo, hi]. */
export function hourBins(hours: number[]): Bin[] {
  const bins: Bin[] = [{ label: '0 h', count: hours.filter((h) => h === 0).length }];
  const max = Math.max(0, ...hours);
  if (!max) return bins;
  const w = NICE.find((n) => max / n <= 8) ?? Math.ceil(max / 8);
  for (let lo = 0; lo < max; lo += w) {
    bins.push({ label: `${lo}–${lo + w} h`, count: hours.filter((h) => h > lo && h <= lo + w).length });
  }
  return bins;
}

const members = (n: number) => `${n} ${n === 1 ? 'member' : 'members'}`;

/** Single-series histogram (no legend: the title names it) with a per-bar tooltip and a table view. */
export function HoursHistogram({ hours }: { hours: number[] }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [active, setActive] = useState<number | null>(null);
  const bins = hourBins(hours);
  const top = Math.max(1, ...bins.map((b) => b.count));

  return (
    <section aria-labelledby="hist-title" className="rounded-lg border p-4">
      <header className="mb-4 flex items-center gap-3">
        <h2 id="hist-title" className="flex-1 font-semibold">
          Hours served per member
        </h2>
        <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="View">
          {(['chart', 'table'] as const).map((v) => (
            <Button key={v} size="sm" variant={view === v ? 'secondary' : 'ghost'} aria-pressed={view === v} onClick={() => setView(v)} className="h-7 capitalize">
              {v}
            </Button>
          ))}
        </div>
      </header>

      {view === 'chart' ? (
        <div className="flex gap-2">
          <div className="flex h-44 flex-col justify-between pt-8 pb-6 text-right text-[11px] text-muted-foreground tabular-nums" aria-hidden>
            <span>{top}</span>
            <span>0</span>
          </div>
          <ol className="grid h-44 flex-1 items-end gap-0.5" style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }} aria-label="Members by hours served">
            {bins.map((b, i) => (
              <li key={b.label} className="relative flex h-full flex-col justify-end">
                {active === i && (
                  // Inside the plot (top-0), anchored to the side away from the nearest edge.
                  <div
                    role="tooltip"
                    className={cn(
                      'absolute top-0 z-10 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-sm',
                      i < bins.length / 3 ? 'left-0' : i >= (2 * bins.length) / 3 ? 'right-0' : 'left-1/2 -translate-x-1/2',
                    )}
                  >
                    <span className="font-medium">{b.label}</span> · {members(b.count)}
                  </div>
                )}
                {/* Hit target is the whole column, not just the bar; pt-8 keeps headroom for the tooltip. */}
                <div
                  tabIndex={0}
                  aria-label={`${b.label}: ${members(b.count)}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="flex flex-1 flex-col justify-end border-b border-border pt-8 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="rounded-t-[4px] bg-primary transition-opacity hover:opacity-85" style={{ height: `${(100 * b.count) / top}%` }} />
                </div>
                {/* Every other label on phones so ranges don't run together; tooltip and table have them all. */}
                <span className={cn('mt-1 h-5 truncate text-center text-[11px] text-muted-foreground tabular-nums', i % 2 && 'max-sm:invisible')} aria-hidden>
                  {b.label.replace(' h', '')}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Hours served</TableHead>
              <TableHead className="text-right">Members</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bins.map((b) => (
              <TableRow key={b.label}>
                <TableCell>{b.label}</TableCell>
                <TableCell className="text-right tabular-nums">{b.count}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}
