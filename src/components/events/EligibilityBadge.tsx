import { CheckCircle2Icon, OctagonXIcon, TriangleAlertIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const LABEL: Record<string, string> = {
  CLASS_CONFLICT: 'Class conflict',
  UNAVAILABLE: 'Unavailable',
  DOUBLE_BOOKED: 'Double-booked',
  ALREADY_ON_SHIFT: 'Already added',
  SCHEDULE_MISSING: 'Schedule missing',
  PINNED_EXCLUDE: 'Excluded',
};

/** Design Brief §6: ✅ eligible (success), ⚠ class conflict (warning), ⛔ reason (destructive). Icon + text, never colour alone. */
export function EligibilityBadge({ eligibility, className }: { eligibility: { hard: string[]; soft: string[] }; className?: string }) {
  const { hard, soft } = eligibility;
  const conflict = soft.includes('CLASS_CONFLICT');
  const [Icon, label, tone] = hard.length
    ? [OctagonXIcon, LABEL[hard[0]] ?? hard[0], 'bg-[#FDECEC] text-destructive']
    : conflict
      ? [TriangleAlertIcon, LABEL.CLASS_CONFLICT, 'bg-warning text-warning-foreground']
      : [CheckCircle2Icon, 'Eligible', 'bg-success/10 text-success'];
  const more = hard.length + (conflict ? 1 : 0) - 1;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
      {more > 0 && ` +${more}`}
    </span>
  );
}
