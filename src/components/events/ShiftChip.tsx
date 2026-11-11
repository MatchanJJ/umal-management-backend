import { CheckIcon } from 'lucide-react';
import { shiftWhen } from '@/lib/format';
import { cn } from '@/lib/utils';

/** Design Brief §6: outline pill with label · time · staffing; selected = maroon tint; full = green check. */
export function ShiftChip({
  shift,
  selected,
  onClick,
}: {
  shift: { label: string; startAt: string; endAt: string; requiredVolunteers: number; activeCount: number };
  selected?: boolean;
  onClick?: () => void;
}) {
  const full = shift.activeCount >= shift.requiredVolunteers;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs whitespace-nowrap transition-colors',
        selected ? 'border-primary bg-[#FBE9EA] text-primary' : 'hover:bg-sidebar-accent',
      )}
    >
      <span className="font-semibold">{shift.label}</span>
      <span className="text-muted-foreground tabular-nums">{shiftWhen(shift.startAt, shift.endAt)}</span>
      <span className="tabular-nums">
        {shift.activeCount}/{shift.requiredVolunteers}
      </span>
      {full && <CheckIcon className="size-3.5 text-success" aria-label="Fully staffed" />}
    </button>
  );
}
