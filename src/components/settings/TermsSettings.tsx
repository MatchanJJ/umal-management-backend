'use client';

import { CheckCircle2Icon, PencilIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useActivateTerm, useCreateTerm, useTerms, useUpdateTerm } from '@/lib/api';
import type { TermDTO } from '../../../shared/api';
import { parseTermName, TERM_KINDS, TermInput, termName, type TermKind } from '../../../shared/settings';

const day = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' });
const fmt = (d: string) => day.format(new Date(`${d}T00:00:00Z`));

type TermLabel = { kind: TermKind; year: number };

/** School year starting now-ish: from August on it's this year's AY, before that last year's (summer is the calendar year). */
function defaultLabel(): TermLabel {
  const now = new Date();
  return { kind: '1st Semester', year: now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1 };
}

/** Term type + school year; the saved name is built from these (termName), so advisers never type it. */
function TermLabelFields({ id, value, onChange }: { id: string; value: TermLabel; onChange: (v: TermLabel) => void }) {
  const summer = value.kind === 'Summer';
  const base = new Date().getFullYear();
  const years = [...new Set([value.year, ...Array.from({ length: 6 }, (_, i) => base - 2 + i)])].sort();
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-kind`}>Term</Label>
        <Select
          value={value.kind}
          onValueChange={(v) => {
            const kind = v as TermKind;
            // Summer of AY 2026-2027 is Summer 2027, and back again.
            const shift = (kind === 'Summer' ? 1 : 0) - (summer ? 1 : 0);
            onChange({ kind, year: value.year + shift });
          }}
        >
          <SelectTrigger id={`${id}-kind`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TERM_KINDS.map((k) => (
              <SelectItem key={k} value={k}>
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-year`}>{summer ? 'Year' : 'School year'}</Label>
        <Select value={String(value.year)} onValueChange={(v) => onChange({ ...value, year: Number(v) })}>
          <SelectTrigger id={`${id}-year`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {summer ? y : `${y}-${y + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}

function AddTerm() {
  const create = useCreateTerm();
  const [label, setLabel] = useState(defaultLabel);
  const [form, setForm] = useState({ startDate: '', endDate: '' });
  const [error, setError] = useState<string | null>(null);
  const name = termName(label.kind, label.year);
  return (
    <form
      noValidate
      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = TermInput.safeParse({ name, ...form });
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the fields');
        setError(null);
        create.mutate(parsed.data, {
          onSuccess: (t) => {
            toast.success(`Added ${t.name}`);
            setForm({ startDate: '', endDate: '' });
          },
          onError: (err) => setError(err.message),
        });
      }}
    >
      <TermLabelFields id="term" value={label} onChange={setLabel} />
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
      <p className="text-xs text-muted-foreground sm:col-span-5">
        Saved as <span className="font-medium text-foreground">{name}</span>
      </p>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-5">
          {error}
        </p>
      )}
    </form>
  );
}

/** Rename a term or move its dates, e.g. when a semester is extended. The server rejects overlaps and duplicate names. */
function EditTerm({ term }: { term: TermDTO }) {
  const update = useUpdateTerm();
  // A name typed before the term picker existed doesn't parse; start from the term's start year and say it will be renamed.
  const parsedName = parseTermName(term.name);
  const initialLabel: TermLabel = parsedName ?? { kind: '1st Semester', year: Number(term.startDate.slice(0, 4)) };
  const initial = { startDate: term.startDate, endDate: term.endDate };
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(initialLabel);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const name = termName(label.kind, label.year);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setLabel(initialLabel);
          setForm(initial);
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" aria-label={`Edit ${term.name}`}>
          <PencilIcon className="size-4" aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit term</DialogTitle>
          <DialogDescription>Change the term or move the dates, for example when the semester is extended.</DialogDescription>
        </DialogHeader>
        <form
          id="edit-term"
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = TermInput.safeParse({ name, ...form });
            if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the fields');
            setError(null);
            update.mutate(
              { id: term.id, ...parsed.data },
              {
                onSuccess: (t) => {
                  toast.success(`Saved ${t.name}`);
                  setOpen(false);
                },
                onError: (err) => setError(err.message),
              },
            );
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <TermLabelFields id="edit-term" value={label} onChange={setLabel} />
          </div>
          <p className="text-xs text-muted-foreground">
            Saved as <span className="font-medium text-foreground">{name}</span>
            {!parsedName && <> (replaces &ldquo;{term.name}&rdquo;)</>}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-term-start">Start</Label>
              <Input id="edit-term-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-term-end">End</Label>
              <Input id="edit-term-end" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button type="submit" form="edit-term" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
                  <TableCell className="flex items-center justify-end gap-2">
                    <EditTerm term={t} />
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
