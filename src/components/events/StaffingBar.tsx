import { cn } from '@/lib/utils';

/** Design Brief §6: 6 px bar, muted track, maroon fill (green when full), tabular "4 / 6" label. */
export function StaffingBar({ filled, required, className }: { filled: number; required: number; className?: string }) {
  const pct = required ? Math.min(100, Math.round((filled / required) * 100)) : 0;
  const full = required > 0 && filled >= required;
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={filled}
        aria-label={`${filled} of ${required} volunteers`}
      >
        <div className={cn('h-full rounded-full', full ? 'bg-success' : 'bg-primary')} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">
        {filled} / {required}
      </span>
    </div>
  );
}
