'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, useCreateEvent, useDailyShifts, usePatchEvent } from '@/lib/api';
import { client } from '@/lib/api';
import type { EventDTO } from '../../../shared/events';
import { emptyShifts, ShiftsEditor, type CustomShift, type ShiftsValue } from './ShiftsEditor';

/** The fields the API accepts for a shift (drops read-only counts). */
const toInput = (s: CustomShift) => ({ id: s.id, label: s.label, startAt: s.startAt, endAt: s.endAt, requiredVolunteers: s.requiredVolunteers });

const message = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong');

/** Create (no `event`) or edit an event. Edit keeps shift ids so staffed shifts are recognised by the API. */
export function EventForm({ event }: { event?: EventDTO }) {
  const router = useRouter();
  const create = useCreateEvent();
  const patch = usePatchEvent(event?.id ?? 0);
  const daily = useDailyShifts(event?.id ?? 0);
  const [title, setTitle] = useState(event?.title ?? '');
  const [venue, setVenue] = useState(event?.venue ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [shifts, setShifts] = useState<ShiftsValue>(() =>
    event ? { ...emptyShifts(), mode: 'custom', custom: event.shifts.map((s) => ({ ...toInput(s), activeCount: s.activeCount })) } : emptyShifts(),
  );
  const [error, setError] = useState<string | null>(null);
  const busy = create.isPending || patch.isPending || daily.isPending;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const details = { title: title.trim(), venue: venue.trim() || null, description: description.trim() || null };
    try {
      if (!event) {
        // Daily: create with the first day as a single block, then expand with the daily helper.
        const first =
          shifts.mode === 'daily'
            ? { startAt: `${shifts.daily.fromDate}T${shifts.daily.startTime}`, endAt: `${shifts.daily.fromDate}T${shifts.daily.endTime}`, requiredVolunteers: shifts.daily.requiredVolunteers }
            : shifts.single;
        const created = await create.mutateAsync(
          shifts.mode === 'custom' ? { ...details, shifts: shifts.custom.map(({ label, startAt, endAt, requiredVolunteers }) => ({ label, startAt, endAt, requiredVolunteers })) } : { ...details, ...first },
        );
        if (shifts.mode === 'daily') {
          const res = await client.api.events[':id'].shifts.daily.$post({
            param: { id: String(created.id) },
            json: { ...shifts.daily, expectedVersion: created.version },
          });
          if (!res.ok) throw new ApiError(res.status, 'DAILY', ((await res.json()) as { error: { message: string } }).error.message);
        }
        toast.success('Event created');
        router.push(`/events/view/?id=${created.id}`);
      } else if (shifts.mode === 'daily') {
        await patch.mutateAsync({ ...details, expectedVersion: event.version });
        await daily.mutateAsync({ ...shifts.daily, expectedVersion: event.version + 1 });
        toast.success('Event saved');
        router.push(`/events/view/?id=${event.id}`);
      } else {
        await patch.mutateAsync({
          ...details,
          shifts: shifts.custom.map(toInput),
          expectedVersion: event.version,
        });
        toast.success('Event saved');
        router.push(`/events/view/?id=${event.id}`);
      }
    } catch (err) {
      setError(message(err));
    }
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ev-title">
            Title <span className="text-primary">*</span>
          </Label>
          <Input id="ev-title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ev-venue">Venue</Label>
          <Input id="ev-venue" maxLength={120} value={venue} onChange={(e) => setVenue(e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="ev-desc">Description</Label>
          <Textarea id="ev-desc" maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Schedule</h2>
        <ShiftsEditor value={shifts} onChange={setShifts} allowModes={event ? ['custom', 'daily'] : ['single', 'daily', 'custom']} />
      </section>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy || !title.trim()}>
          {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
