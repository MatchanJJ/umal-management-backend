import { CheckCircle2Icon, CircleIcon, CircleSlashIcon, XCircleIcon, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Design Brief §6 assignment pills; icon + text, never colour alone.
const STYLE: Record<string, { label: string; icon: LucideIcon; cls: string }> = {
  assigned: { label: 'Assigned', icon: CircleIcon, cls: 'bg-info/10 text-info' },
  attended: { label: 'Attended', icon: CheckCircle2Icon, cls: 'bg-success/10 text-success' },
  no_show: { label: 'No-show', icon: XCircleIcon, cls: 'bg-[#FDECEC] text-destructive' },
  excused: { label: 'Excused', icon: CircleSlashIcon, cls: 'bg-warning text-warning-foreground' },
};

export function AssignmentStatus({ status }: { status: string }) {
  const s = STYLE[status] ?? STYLE.assigned;
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>
      <s.icon className="size-3.5" aria-hidden /> {s.label}
    </span>
  );
}
