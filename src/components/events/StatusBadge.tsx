import { cn } from '@/lib/utils';

// Design Brief §6 event pills.
const STYLE: Record<string, [string, string]> = {
  draft: ['Draft', 'bg-muted text-sidebar-foreground'],
  published: ['Published', 'bg-[#FBE9EA] text-primary'],
  completed: ['Completed', 'bg-[#E8F5EC] text-success'],
  cancelled: ['Cancelled', 'bg-muted text-muted-foreground'],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, cls] = STYLE[status] ?? STYLE.draft;
  return <span className={cn('inline-flex rounded-full px-2 py-0.5 text-xs font-semibold', cls)}>{label}</span>;
}
