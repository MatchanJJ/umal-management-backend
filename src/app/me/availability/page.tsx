'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { AppGate } from '@/components/layout/AppGate';
import { MemberShell } from '@/components/layout/MemberShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAddUnavailability, useDeleteUnavailability, useUnavailability } from '@/lib/api';
import { DAY_NAMES, UnavailabilityInput, type UnavailabilityDTO } from '../../../../shared/schedule';

const dateFmt = new Intl.DateTimeFormat('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const whenLabel = (b: UnavailabilityDTO) =>
  b.kind === 'weekly' ? `Every ${DAY_NAMES[b.dayOfWeek! - 1]}` : dateFmt.format(new Date(`${b.date}T00:00:00Z`));
const timeLabel = (b: UnavailabilityDTO) => (b.startTime === '00:00' && b.endTime === '24:00' ? 'Whole day' : `${b.startTime}–${b.endTime}`);

function AddBlock() {
  const add = useAddUnavailability();
  const [kind, setKind] = useState<'weekly' | 'date'>('weekly');
  const [form, setForm] = useState({ dayOfWeek: 6, date: '', startTime: '08:00', endTime: '12:00', wholeDay: false, reason: '' });
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const raw = {
      kind,
      ...(kind === 'weekly' ? { dayOfWeek: form.dayOfWeek } : { date: form.date }),
      ...(form.wholeDay ? { wholeDay: true } : { startTime: form.startTime, endTime: form.endTime }),
      reason: form.reason.trim() || null,
    };
    const parsed = UnavailabilityInput.safeParse(raw);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the fields');
    setError(null);
    add.mutate(raw as Parameters<typeof add.mutate>[0], {
      onSuccess: () => {
        toast.success('Added');
        setForm({ ...form, reason: '' });
      },
      onError: (err) => setError(err.message),
    });
  }

  return (
    <form noValidate onSubmit={submit} className="space-y-4 rounded-lg border p-4">
      <Tabs value={kind} onValueChange={(v) => setKind(v as 'weekly' | 'date')}>
        <TabsList>
          <TabsTrigger value="weekly">Every week</TabsTrigger>
          <TabsTrigger value="date">Specific date</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end">
        {kind === 'weekly' ? (
          <div className="space-y-1.5">
            <Label htmlFor="ua-day">Day</Label>
            <Select value={String(form.dayOfWeek)} onValueChange={(v) => setForm({ ...form, dayOfWeek: Number(v) })}>
              <SelectTrigger id="ua-day" className="w-full">
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
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="ua-date">Date</Label>
            <Input id="ua-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="ua-start">From</Label>
          <Input id="ua-start" type="time" step={1800} disabled={form.wholeDay} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ua-end">To</Label>
          <Input id="ua-end" type="time" step={1800} disabled={form.wholeDay} value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Switch checked={form.wholeDay} onCheckedChange={(wholeDay) => setForm({ ...form, wholeDay })} /> Whole day
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1 space-y-1.5">
          <Label htmlFor="ua-reason">Reason (optional)</Label>
          <Input id="ua-reason" maxLength={120} placeholder="Family, part-time work…" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <PlusIcon className="size-4" aria-hidden /> Add block
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function Blocks() {
  const { data, isLoading } = useUnavailability();
  const del = useDeleteUnavailability();
  if (isLoading) return <Skeleton className="h-32" />;
  if (!data?.length) return <p className="py-8 text-center text-sm text-muted-foreground">You haven&apos;t blocked any time.</p>;
  return (
    <ul className="divide-y rounded-lg border">
      {data.map((b) => (
        <li key={b.id} className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1">
            <p className="font-medium">
              {whenLabel(b)} <span className="font-normal text-muted-foreground tabular-nums">· {timeLabel(b)}</span>
            </p>
            {b.reason && <p className="text-[13px] text-muted-foreground">{b.reason}</p>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${whenLabel(b)} ${timeLabel(b)}`}
            disabled={del.isPending}
            onClick={() => del.mutate(b.id, { onError: (e) => toast.error(e.message) })}
          >
            <Trash2Icon className="size-4" />
          </Button>
        </li>
      ))}
    </ul>
  );
}

export default function AvailabilityPage() {
  return (
    <AppGate require="member">
      {(me) => (
        <MemberShell me={me!} title="Availability">
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Block times you can&apos;t serve, besides your classes. Advisers won&apos;t be able to assign you then.
            </p>
            <AddBlock />
            <Blocks />
          </div>
        </MemberShell>
      )}
    </AppGate>
  );
}
