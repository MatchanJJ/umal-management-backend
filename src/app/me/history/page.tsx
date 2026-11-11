'use client';

import { AppGate } from '@/components/layout/AppGate';
import { MemberShell } from '@/components/layout/MemberShell';
import { AssignmentStatus } from '@/components/member/AssignmentStatus';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMyAssignments } from '@/lib/api';
import { hoursLabel, shiftWhen } from '@/lib/format';

function History() {
  const { data, isLoading } = useMyAssignments();
  if (isLoading) return <Skeleton className="h-48" />;
  if (!data?.past.length) return <p className="py-10 text-center text-sm text-muted-foreground">No past shifts yet.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader className="bg-sidebar">
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>When</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Attendance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.past.map((a) => (
            <TableRow key={a.assignmentId} className="h-11">
              <TableCell>
                <span className="font-medium">{a.eventTitle}</span>
                <span className="text-muted-foreground"> · {a.shiftLabel}</span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground tabular-nums">{shiftWhen(a.startAt, a.endAt)}</TableCell>
              <TableCell className="text-right tabular-nums">{a.status === 'excused' ? '—' : hoursLabel(a.hours)}</TableCell>
              <TableCell>
                <AssignmentStatus status={a.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <AppGate require="member">
      {(me) => (
        <MemberShell me={me!} title="History">
          <History />
        </MemberShell>
      )}
    </AppGate>
  );
}
