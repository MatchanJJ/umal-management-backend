'use client';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { shiftWhen } from '@/lib/format';
import type { ResultDTO } from '../../../shared/ai';

export type Ineligible = { shiftId: number; memberId: number; reasons: string[] }[];

/** App Flow §7.2 confirm step: per shift, the names, soft flags and capacity after approval. */
export function ApproveDialog({
  open,
  result,
  ineligible,
  busy,
  onConfirm,
  onDropIneligible,
  onClose,
}: {
  open: boolean;
  result: ResultDTO;
  ineligible: Ineligible | null;
  busy: boolean;
  onConfirm: () => void;
  onDropIneligible: () => void;
  onClose: () => void;
}) {
  const total = result.perShift.reduce((n, s) => n + s.result.picks.length, 0);
  const bad = new Set((ineligible ?? []).map((i) => `${i.shiftId}:${i.memberId}`));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Approve {total} assignment{total === 1 ? '' : 's'}?</DialogTitle>
          <DialogDescription>Volunteers are added to the roster. Nothing is assigned until you confirm.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {result.perShift.map((s) => (
            <div key={s.shiftId} className="rounded-lg border p-3 text-sm">
              <p className="font-semibold">
                {s.label} <span className="font-normal text-muted-foreground tabular-nums">· {shiftWhen(s.startAt, s.endAt)}</span>
              </p>
              <ul className="mt-1 space-y-0.5">
                {s.result.picks.map((p) => (
                  <li key={p.memberId} className={bad.has(`${s.shiftId}:${p.memberId}`) ? 'text-destructive line-through' : undefined}>
                    {p.member.name}
                    {p.softFlags.includes('CLASS_CONFLICT') && <span className="text-xs text-warning-foreground"> · class conflict</span>}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Open slots after: {Math.max(0, s.remainingSlots - s.result.picks.length)}
              </p>
            </div>
          ))}
          {ineligible && (
            <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              Some picks can’t be assigned any more:
              <ul className="mt-1 list-disc pl-5">
                {ineligible.map((i) => {
                  const s = result.perShift.find((x) => x.shiftId === i.shiftId);
                  const name = s?.result.picks.find((p) => p.memberId === i.memberId)?.member.name ?? `Member ${i.memberId}`;
                  return (
                    <li key={`${i.shiftId}:${i.memberId}`}>
                      {name} ({s?.label}): {i.reasons.join(', ').toLowerCase().replaceAll('_', ' ')}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Back
          </Button>
          {ineligible ? (
            <Button disabled={busy} onClick={onDropIneligible}>
              Remove them and approve the rest
            </Button>
          ) : (
            <Button disabled={busy || !total} onClick={onConfirm}>
              {busy ? 'Approving…' : `Approve ${total}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
