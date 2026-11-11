'use client';

import { ArrowDownIcon, ArrowUpIcon, DownloadIcon } from 'lucide-react';
import { useState } from 'react';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { AppGate } from '@/components/layout/AppGate';
import { HoursHistogram } from '@/components/reports/HoursHistogram';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFairness, useTerms } from '@/lib/api';
import type { FairnessReport } from '../../../../shared/reports';

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
const hrs = (x: number) => `${Number(x.toFixed(1))} h`;

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border p-4">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
      {sub && <dd className="text-[13px] text-muted-foreground tabular-nums">{sub}</dd>}
    </div>
  );
}

function Kpis({ k }: { k: FairnessReport['kpis'] }) {
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <Kpi label="Members eligible" value={String(k.members)} />
      <Kpi label="Hours served" value={hrs(k.totalHours)} sub={`${hrs(k.avgHours)} average · ${hrs(k.medianHours)} median`} />
      <Kpi label="Gini of hours" value={k.gini.toFixed(2)} sub="0 = perfectly even" />
      <Kpi label="Top-10% share" value={pct(k.top10Share)} sub="of all hours" />
      <Kpi label="Never assigned" value={String(k.neverAssigned)} />
      <Kpi label="No-show rate" value={pct(k.noShowRate)} />
      <Kpi label="AI share" value={pct(k.aiShare)} sub="of assignments" />
      <Kpi label="Override rate" value={pct(k.overrideRate)} sub="AI picks changed" />
    </dl>
  );
}

type SortKey = 'hours' | 'shifts';

function MembersTable({ members }: { members: FairnessReport['members'] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'hours', desc: true });
  const [neverOnly, setNeverOnly] = useState(false);
  const rows = members
    .filter((m) => !neverOnly || m.shifts === 0)
    .sort((a, b) => (sort.desc ? b[sort.key] - a[sort.key] : a[sort.key] - b[sort.key]) || a.name.localeCompare(b.name));

  const sortHead = (k: SortKey, children: string) => (
    <TableHead className="text-right" aria-sort={sort.key === k ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
      <button type="button" className="inline-flex items-center gap-1 font-medium" onClick={() => setSort((s) => ({ key: k, desc: s.key === k ? !s.desc : true }))}>
        {children}
        {sort.key === k && (sort.desc ? <ArrowDownIcon className="size-3.5" aria-hidden /> : <ArrowUpIcon className="size-3.5" aria-hidden />)}
      </button>
    </TableHead>
  );

  return (
    <section aria-labelledby="members-title" className="rounded-lg border">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
        <h2 id="members-title" className="flex-1 font-semibold">
          Members
        </h2>
        <div className="flex items-center gap-2">
          <Switch id="never-only" checked={neverOnly} onCheckedChange={setNeverOnly} />
          <Label htmlFor="never-only">Never assigned only</Label>
        </div>
      </header>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>College</TableHead>
            {sortHead('hours', 'Hours')}
            {sortHead('shifts', 'Shifts')}
            <TableHead className="text-right">Attended</TableHead>
            <TableHead className="text-right">No-show</TableHead>
            <TableHead className="text-right">From AI</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => (
            <TableRow key={m.memberId}>
              <TableCell className="font-medium">{m.name}</TableCell>
              <TableCell>{m.college ?? '—'}</TableCell>
              <TableCell className="text-right tabular-nums">{m.hours}</TableCell>
              <TableCell className="text-right tabular-nums">{m.shifts}</TableCell>
              <TableCell className="text-right tabular-nums">{m.attended}</TableCell>
              <TableCell className="text-right tabular-nums">{m.noShow}</TableCell>
              <TableCell className="text-right tabular-nums">{m.fromAi}</TableCell>
            </TableRow>
          ))}
          {!rows.length && (
            <TableRow>
              <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                {neverOnly ? 'Everyone has served at least one shift this term.' : 'No eligible members yet.'}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}

function Report() {
  const terms = useTerms();
  const [picked, setPicked] = useState<number | null>(null);
  const termId = picked ?? terms.data?.find((t) => t.isActive)?.id ?? terms.data?.[0]?.id ?? null;
  const report = useFairness(termId);

  if (terms.isLoading) return <Skeleton className="h-64" />;
  if (!terms.data?.length) return <p className="text-sm text-muted-foreground">Create a term in Settings to see its fairness report.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="term">Term</Label>
          <Select value={termId ? String(termId) : undefined} onValueChange={(v) => setPicked(Number(v))}>
            <SelectTrigger id="term" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {terms.data.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name}
                  {t.isActive ? ' (active)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1" />
        {termId && (
          <Button variant="outline" asChild>
            <a href={`/api/reports/fairness.csv?termId=${termId}`} download>
              <DownloadIcon className="size-4" aria-hidden /> Export CSV
            </a>
          </Button>
        )}
      </div>

      {report.isError ? (
        <p className="text-sm text-destructive">{report.error.message}</p>
      ) : !report.data ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Kpis k={report.data.kpis} />
          <HoursHistogram hours={report.data.members.map((m) => m.hours)} />
          <MembersTable members={report.data.members} />
        </>
      )}
    </div>
  );
}

/** FR-29 / App Flow §9: term fairness report. */
export default function FairnessPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Fairness report">
          <Report />
        </AdviserShell>
      )}
    </AppGate>
  );
}
