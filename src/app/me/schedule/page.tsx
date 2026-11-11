'use client';

import { CopyIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppGate } from '@/components/layout/AppGate';
import { AppShell } from '@/components/layout/MemberShell';
import { ClassList } from '@/components/schedule/ClassList';
import { WeekGrid, type GridEntry } from '@/components/schedule/WeekGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { fetchSchedule, useSaveSchedule, useSchedule } from '@/lib/api';
import { ClassEntry, DAY_NAMES, findOverlap, type ScheduleResponse } from '../../../../shared/schedule';

function AddClass({ draft, onAdd }: { draft: GridEntry[]; onAdd: (e: GridEntry) => void }) {
  const [entry, setEntry] = useState({ dayOfWeek: 1, startTime: '08:00', endTime: '09:30', label: '' });
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      noValidate
      className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto_auto_1.5fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = ClassEntry.safeParse({ ...entry, label: entry.label.trim() || null });
        if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the times');
        const clash = findOverlap([...draft, parsed.data]);
        if (clash) return setError(`Overlaps your ${clash[0].label || 'class'} ${clash[0].startTime}–${clash[0].endTime}`);
        setError(null);
        onAdd(parsed.data);
        setEntry({ ...entry, label: '' });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="cls-day">Day</Label>
        <Select value={String(entry.dayOfWeek)} onValueChange={(v) => setEntry({ ...entry, dayOfWeek: Number(v) })}>
          <SelectTrigger id="cls-day" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DAY_NAMES.map((d, i) => (
              <SelectItem key={d} value={String(i + 1)}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cls-start">Start</Label>
        <Input id="cls-start" type="time" step={1800} value={entry.startTime} onChange={(e) => setEntry({ ...entry, startTime: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cls-end">End</Label>
        <Input id="cls-end" type="time" step={1800} value={entry.endTime} onChange={(e) => setEntry({ ...entry, endTime: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cls-label">Label (optional)</Label>
        <Input id="cls-label" placeholder="CS 311 Lec" maxLength={60} value={entry.label} onChange={(e) => setEntry({ ...entry, label: e.target.value })} />
      </div>
      <Button type="submit" variant="outline">
        <PlusIcon className="size-4" aria-hidden /> Add class
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive sm:col-span-5">
          {error}
        </p>
      )}
    </form>
  );
}

function ScheduleEditor() {
  const { data, isLoading } = useSchedule();
  if (isLoading || !data) return <Skeleton className="h-96" />;
  if (!data.termId) {
    return <p className="py-10 text-center text-sm text-muted-foreground">There&apos;s no active term yet. Check back once an adviser opens one.</p>;
  }
  // Keyed by term so switching terms starts a fresh draft.
  return <DraftEditor key={data.termId} data={data} />;
}

function DraftEditor({ data }: { data: ScheduleResponse }) {
  const save = useSaveSchedule();
  const [draft, setDraft] = useState<GridEntry[]>(data.entries);
  const [dirty, setDirty] = useState(false);
  const [listView, setListView] = useState(false);

  const update = (next: GridEntry[]) => {
    setDraft(next);
    setDirty(true);
  };
  const remove = (i: number) => update(draft.filter((_, j) => j !== i));

  return (
    <div className="space-y-5">
      {!data.submitted && (
        <p role="status" className="rounded-md border border-secondary/60 bg-warning px-3 py-2 text-sm text-warning-foreground">
          Add your classes for this term and press <strong>Submit schedule</strong>. Advisers can&apos;t assign you to events until you do.
        </p>
      )}
      <AddClass draft={draft} onAdd={(e) => update([...draft, e])} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {data.previousTermAvailable && data.previousTermId && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const prev = await fetchSchedule(data.previousTermId!);
                update(prev.entries);
                toast.info(`Copied ${prev.entries.length} classes from last term. Review them, then submit.`);
              }}
            >
              <CopyIcon className="size-4" aria-hidden /> Copy from previous term
            </Button>
          )}
        </div>
        <label className="hidden items-center gap-2 text-sm md:flex">
          <Switch checked={listView} onCheckedChange={setListView} /> List view
        </label>
      </div>

      <div className={listView ? 'hidden' : 'hidden md:block'}>
        <WeekGrid entries={draft} onRemove={remove} />
        {draft.some((e) => e.dayOfWeek === 7) && (
          <p className="mt-2 text-xs text-muted-foreground">Sunday classes are saved but only shown in the list view.</p>
        )}
      </div>
      <div className={listView ? '' : 'md:hidden'}>
        <ClassList entries={draft} onRemove={remove} />
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t bg-background px-4 py-3 sm:mx-0 sm:px-0">
        {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
        <Button
          disabled={save.isPending || (!dirty && data.submitted)}
          onClick={() =>
            save.mutate(
              { termId: data.termId!, entries: draft.map((e) => ({ ...e, label: e.label ?? null })) },
              {
                onSuccess: () => {
                  setDirty(false);
                  toast.success('Schedule submitted');
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          {save.isPending ? 'Saving…' : data.submitted ? 'Save changes' : 'Submit schedule'}
        </Button>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  return (
    <AppGate require="onboarded">
      {(me) => (
        <AppShell me={me!} title="My class schedule">
          <p className="-mt-4 mb-6 text-sm text-muted-foreground">{me?.activeTerm?.name ?? 'No active term'}</p>
          <ScheduleEditor />
        </AppShell>
      )}
    </AppGate>
  );
}
