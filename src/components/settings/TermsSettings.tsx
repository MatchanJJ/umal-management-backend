'use client';

import { CheckCircle2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useActivateTerm, useCreateTerm, useTerms } from '@/lib/api';
import { TermInput } from '../../../shared/settings';

const day = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' });
const fmt = (d: string) => day.format(new Date(`${d}T00:00:00Z`));

function AddTerm() {
  const create = useCreateTerm();
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = TermInput.safeParse(form);
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the fields');
        setError(null);
        create.mutate(parsed.data, {
          onSuccess: (t) => {
            toast.success(`Added ${t.name}`);
            setForm({ name: '', startDate: '', endDate: '' });
          },
          onError: (err) => setError(err.message),
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="term-name">Name</Label>
        <Input id="term-name" placeholder="1st Semester AY 2026–2027" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="term-start">Start</Label>
        <Input id="term-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="term-end">End</Label>
        <Input id="term-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
      </div>
      <Button type="submit" disabled={create.isPending}>
        Add term
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-4">
          {error}
        </p>
      )}
    </form>
  );
}

export function TermsSettings() {
  const { data, isLoading } = useTerms();
  const activate = useActivateTerm();
  return (
    <div className="space-y-4">
      <AddTerm />
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !data?.length ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No terms yet. Add the current semester above, then activate it.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader className="bg-sidebar">
              <TableRow>
                <TableHead>Term</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id} className="h-11">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground tabular-nums">
                    {fmt(t.startDate)} – {fmt(t.endDate)}
                  </TableCell>
                  <TableCell className="text-right">
                    {t.isActive ? (
                      <Badge className="bg-success/10 text-success">
                        <CheckCircle2Icon className="size-3.5" aria-hidden /> Active
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={activate.isPending}
                        onClick={() =>
                          activate.mutate(t.id, { onSuccess: () => toast.success(`${t.name} is now active`), onError: (e) => toast.error(e.message) })
                        }
                      >
                        Make active
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
