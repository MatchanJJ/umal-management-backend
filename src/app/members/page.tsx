'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { AppGate } from '@/components/layout/AppGate';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCatalog, useMembers } from '@/lib/api';
import type { MemberListQuery } from '../../../shared/api';

const ALL = 'all';
const PAGE_SIZE = 25;
type Filters = Omit<MemberListQuery, 'page' | 'pageSize' | 'search'>;

function FilterSelect({ id, label, value, options, onChange }: { id: string; label: string; value?: string | number; options: [string, string][]; onChange: (v?: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value === undefined ? ALL : String(value)} onValueChange={(v) => onChange(v === ALL ? undefined : v)}>
        <SelectTrigger id={id} className="w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All</SelectItem>
          {options.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Directory() {
  const params = useSearchParams();
  const [search, setSearch] = useState('');
  // The dashboard links here with ?schedule=missing.
  const [filters, setFilters] = useState<Filters>({ status: 'active', schedule: params.get('schedule') === 'missing' ? 'missing' : undefined });
  const [page, setPage] = useState(1);
  const catalog = useCatalog();
  const { data, isLoading, isError, error } = useMembers({ ...filters, search: search.trim() || undefined, page });
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="member-search">Search</Label>
          <Input
            id="member-search"
            type="search"
            className="w-64"
            placeholder="Name, email or student number"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <FilterSelect id="f-college" label="College" value={filters.college} options={(catalog.data?.colleges ?? []).map((c) => [c.code, c.code])} onChange={(v) => set({ college: v })} />
        <FilterSelect id="f-year" label="Year" value={filters.yearLevel} options={[1, 2, 3, 4, 5].map((y) => [String(y), `Year ${y}`])} onChange={(v) => set({ yearLevel: v ? Number(v) : undefined })} />
        <FilterSelect id="f-role" label="Role" value={filters.role} options={[['member', 'Member'], ['adviser', 'Adviser']]} onChange={(v) => set({ role: v as Filters['role'] })} />
        <FilterSelect id="f-status" label="Status" value={filters.status} options={[['active', 'Active'], ['inactive', 'Inactive']]} onChange={(v) => set({ status: v as Filters['status'] })} />
        <FilterSelect
          id="f-schedule"
          label="Schedule"
          value={filters.schedule}
          options={[['submitted', 'Submitted'], ['missing', 'Missing']]}
          onChange={(v) => set({ schedule: v as Filters['schedule'] })}
        />
      </div>

      {isError ? (
        <p className="text-sm text-destructive">{error.message}</p>
      ) : isLoading || !data ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Student no.</TableHead>
                <TableHead>College</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((m) => (
                <TableRow key={m.id} className={m.status === 'inactive' ? 'text-muted-foreground' : undefined}>
                  <TableCell>
                    <Link href={`/members/view/?id=${m.id}`} className="font-medium underline-offset-4 hover:underline">
                      {m.name}
                    </Link>
                    {m.status === 'inactive' && <span className="ml-2 text-xs">(inactive)</span>}
                    <div className="text-xs text-muted-foreground">{m.email}</div>
                  </TableCell>
                  <TableCell className="tabular-nums">{m.studentNumber ?? '—'}</TableCell>
                  <TableCell>{m.collegeCode ?? '—'}</TableCell>
                  <TableCell>{m.yearLevel ?? '—'}</TableCell>
                  <TableCell>{m.role === 'adviser' ? <Badge>Adviser</Badge> : 'Member'}</TableCell>
                  <TableCell>{!m.onboarded ? 'Not onboarded' : m.scheduleSubmitted ? 'Submitted' : <span className="text-destructive">Missing</span>}</TableCell>
                </TableRow>
              ))}
              {!data.items.length && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No members match these filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground tabular-nums">{data ? `${data.total} ${data.total === 1 ? 'member' : 'members'}` : ''}</span>
        {pages > 1 && (
          <div className="flex items-center gap-2">
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
      </div>
    </div>
  );
}

/** App Flow §2: member directory with filters. */
export default function MembersPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Members">
          <Suspense fallback={<Skeleton className="h-64" />}>
            <Directory />
          </Suspense>
        </AdviserShell>
      )}
    </AppGate>
  );
}
