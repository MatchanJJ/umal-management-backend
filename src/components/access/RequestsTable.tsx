'use client';

import { CheckIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAccessRequests, useApproveAccess, useRejectAccess } from '@/lib/api';
import type { AccessRequestDTO } from '../../../shared/api';
import type { AccessStatus } from '../../../shared/enums';

const when = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila' });

const EMPTY: Record<AccessStatus, string> = {
  pending: 'No one is waiting for access.',
  approved: 'No approved requests yet.',
  rejected: 'No rejected requests.',
};

function RejectDialog({ request, onClose }: { request: AccessRequestDTO | null; onClose: () => void }) {
  const reject = useRejectAccess();
  const [note, setNote] = useState('');
  return (
    <Dialog open={!!request} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject access request</DialogTitle>
          <DialogDescription>
            {request?.email} won&apos;t be able to request access again for 7 days.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-note">Note (optional, advisers only)</Label>
          <Textarea id="reject-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={reject.isPending}
            onClick={() =>
              request &&
              reject.mutate(
                { id: request.id, note: note.trim() || undefined },
                {
                  onSuccess: () => {
                    toast.success(`Rejected ${request.email}`);
                    setNote('');
                    onClose();
                  },
                  onError: (e) => toast.error(e.message),
                },
              )
            }
          >
            Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RequestsTable({ status }: { status: AccessStatus }) {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAccessRequests(status, page);
  const approve = useApproveAccess();
  const [rejecting, setRejecting] = useState<AccessRequestDTO | null>(null);

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (isError || !data) return <p className="text-sm text-destructive">Couldn&apos;t load requests.</p>;
  if (!data.items.length) return <p className="py-10 text-center text-sm text-muted-foreground">{EMPTY[status]}</p>;

  const pages = Math.max(1, Math.ceil(data.total / 25));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader className="bg-sidebar">
            <TableRow>
              <TableHead className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Email</TableHead>
              <TableHead className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                {status === 'pending' ? 'Requested' : 'Decided'}
              </TableHead>
              <TableHead className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Source</TableHead>
              {status !== 'pending' && (
                <TableHead className="text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Role</TableHead>
              )}
              <TableHead className="text-right text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((r) => (
              <TableRow key={r.id} className="h-11">
                <TableCell className="font-medium">
                  {r.email}
                  {r.note && <p className="text-xs font-normal text-muted-foreground">{r.note}</p>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground tabular-nums">
                  {when.format(new Date(status === 'pending' ? r.createdAt : (r.decidedAt ?? r.createdAt)))}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{r.source === 'bulk' ? 'Pre-approved' : 'Sign-in'}</Badge>
                </TableCell>
                {status !== 'pending' && <TableCell className="capitalize">{r.role}</TableCell>}
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {status !== 'approved' && (
                      <>
                        <Button
                          size="sm"
                          disabled={approve.isPending}
                          onClick={() =>
                            approve.mutate(
                              { id: r.id, role: 'member' },
                              { onSuccess: () => toast.success(`Approved ${r.email} as member`), onError: (e) => toast.error(e.message) },
                            )
                          }
                        >
                          <CheckIcon className="size-4" aria-hidden /> Approve as member
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={approve.isPending}
                          onClick={() =>
                            approve.mutate(
                              { id: r.id, role: 'adviser' },
                              { onSuccess: () => toast.success(`Approved ${r.email} as adviser`), onError: (e) => toast.error(e.message) },
                            )
                          }
                        >
                          As adviser
                        </Button>
                      </>
                    )}
                    {status !== 'rejected' && (
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRejecting(r)}>
                        <XIcon className="size-4" aria-hidden /> Reject
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="tabular-nums text-muted-foreground">
            {page} / {pages}
          </span>
          <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      <RejectDialog request={rejecting} onClose={() => setRejecting(null)} />
    </div>
  );
}
