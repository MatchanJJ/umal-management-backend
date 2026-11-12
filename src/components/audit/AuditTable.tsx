'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAudit } from '@/lib/api';
import { stampManila } from '@/lib/format';
import type { AuditItem, AuditQuery } from '../../../shared/api';
import { AUDIT_ACTIONS } from '../../../shared/enums';

const ENTITY_TYPES = ['event', 'assignment', 'member', 'access_request', 'term', 'settings', 'catalog'] as const;
const ALL = 'all';
const PAGE_SIZE = 25;

/** 'member.role_change' → 'Member role change'. */
export const actionLabel = (a: string) => {
  const s = a.replace(/[._]/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const entityLabel = (i: AuditItem) => `${i.entityType.replace('_', ' ')}${i.entityId ? ` #${i.entityId}` : ''}`;

type Filters = Pick<AuditQuery, 'action' | 'entityType' | 'from' | 'to'>;

function FilterBar({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label htmlFor="audit-action">Action</Label>
        <Select value={value.action ?? ALL} onValueChange={(v) => onChange({ ...value, action: v === ALL ? undefined : (v as Filters['action']) })}>
          <SelectTrigger id="audit-action" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All actions</SelectItem>
            {AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-entity">Entity</Label>
        <Select value={value.entityType ?? ALL} onValueChange={(v) => onChange({ ...value, entityType: v === ALL ? undefined : (v as Filters['entityType']) })}>
          <SelectTrigger id="audit-entity" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All entities</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t} className="capitalize">
                {t.replace('_', ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-from">From</Label>
        <Input id="audit-from" type="date" className="w-40" value={value.from ?? ''} onChange={(e) => onChange({ ...value, from: e.target.value || undefined })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="audit-to">To</Label>
        <Input id="audit-to" type="date" className="w-40" value={value.to ?? ''} onChange={(e) => onChange({ ...value, to: e.target.value || undefined })} />
      </div>
    </div>
  );
}

/** FR-30 audit log: filters (unless scoped to one event), paged table, JSON details drawer. */
export function AuditTable({ eventId }: { eventId?: number }) {
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<AuditItem | null>(null);
  const { data, isLoading, isError, error } = useAudit({ ...filters, eventId, page });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {!eventId && (
        <FilterBar
          value={filters}
          onChange={(f) => {
            setFilters(f);
            setPage(1);
          }}
        />
      )}
      {isError ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead className="sr-only">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{stampManila(i.createdAt)}</TableCell>
                  <TableCell>{i.actor?.name ?? 'System'}</TableCell>
                  <TableCell>{actionLabel(i.action)}</TableCell>
                  <TableCell className="capitalize">{entityLabel(i)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(i)} aria-label={`Details of ${actionLabel(i.action)} at ${stampManila(i.createdAt)}`}>
                      Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!data.items.length && (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    No activity matches these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            {page} / {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>{open && actionLabel(open.action)}</SheetTitle>
            <SheetDescription>
              {open && `${stampManila(open.createdAt)} · ${open.actor?.name ?? 'System'} · ${entityLabel(open)}`}
            </SheetDescription>
          </SheetHeader>
          <pre className="mx-4 overflow-auto rounded-md bg-muted p-3 text-xs">{open && JSON.stringify(open.data, null, 2)}</pre>
        </SheetContent>
      </Sheet>
    </div>
  );
}
