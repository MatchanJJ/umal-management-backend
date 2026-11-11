'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type CustomShift = { id?: number; label: string; startAt: string; endAt: string; requiredVolunteers: number; activeCount?: number };
export type ShiftsValue = {
  mode: 'single' | 'daily' | 'custom';
  single: { startAt: string; endAt: string; requiredVolunteers: number };
  daily: { fromDate: string; toDate: string; startTime: string; endTime: string; requiredVolunteers: number };
  custom: CustomShift[];
};

export const emptyShifts = (): ShiftsValue => ({
  mode: 'single',
  single: { startAt: '', endAt: '', requiredVolunteers: 4 },
  daily: { fromDate: '', toDate: '', startTime: '08:00', endTime: '17:00', requiredVolunteers: 4 },
  custom: [{ label: 'Day 1', startAt: '', endAt: '', requiredVolunteers: 4 }],
});

function Num({ id, value, onChange }: { id: string; value: number; onChange: (n: number) => void }) {
  return <Input id={id} type="number" min={1} max={200} className="w-24" value={value} onChange={(e) => onChange(Number(e.target.value))} />;
}

/** App Flow §5 schedule section: Single block · Daily block · Custom shifts. */
export function ShiftsEditor({ value, onChange, allowModes = ['single', 'daily', 'custom'] }: { value: ShiftsValue; onChange: (v: ShiftsValue) => void; allowModes?: ShiftsValue['mode'][] }) {
  const set = <K extends keyof ShiftsValue>(k: K, v: ShiftsValue[K]) => onChange({ ...value, [k]: v });
  const { single, daily, custom } = value;
  const crossesMidnight = single.startAt && single.endAt && single.endAt.slice(0, 10) > single.startAt.slice(0, 10);

  return (
    <div className="space-y-4">
      {allowModes.length > 1 && (
        <Tabs value={value.mode} onValueChange={(m) => set('mode', m as ShiftsValue['mode'])}>
          <TabsList>
            {allowModes.includes('single') && <TabsTrigger value="single">Single block</TabsTrigger>}
            {allowModes.includes('daily') && <TabsTrigger value="daily">Daily block</TabsTrigger>}
            {allowModes.includes('custom') && <TabsTrigger value="custom">Custom shifts</TabsTrigger>}
          </TabsList>
        </Tabs>
      )}

      {value.mode === 'single' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="single-start">Starts</Label>
            <Input id="single-start" type="datetime-local" value={single.startAt} onChange={(e) => set('single', { ...single, startAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="single-end">Ends</Label>
            <Input id="single-end" type="datetime-local" value={single.endAt} onChange={(e) => set('single', { ...single, endAt: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="single-req">Volunteers needed</Label>
            <Num id="single-req" value={single.requiredVolunteers} onChange={(n) => set('single', { ...single, requiredVolunteers: n })} />
          </div>
          {crossesMidnight && <p className="pb-2 text-xs text-muted-foreground">Crosses midnight</p>}
        </div>
      )}

      {value.mode === 'daily' && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="daily-from">From</Label>
              <Input id="daily-from" type="date" value={daily.fromDate} onChange={(e) => set('daily', { ...daily, fromDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily-to">To</Label>
              <Input id="daily-to" type="date" value={daily.toDate} onChange={(e) => set('daily', { ...daily, toDate: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily-start">Daily start</Label>
              <Input id="daily-start" type="time" value={daily.startTime} onChange={(e) => set('daily', { ...daily, startTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily-end">Daily end</Label>
              <Input id="daily-end" type="time" value={daily.endTime} onChange={(e) => set('daily', { ...daily, endTime: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="daily-req">Volunteers per day</Label>
              <Num id="daily-req" value={daily.requiredVolunteers} onChange={(n) => set('daily', { ...daily, requiredVolunteers: n })} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Creates one shift per day, labelled Day 1, Day 2, …</p>
        </div>
      )}

      {value.mode === 'custom' && (
        <div className="space-y-2">
          {custom.map((s, i) => {
            const staffed = (s.activeCount ?? 0) > 0;
            const update = (patch: Partial<CustomShift>) => set('custom', custom.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={s.id ?? `new-${i}`} className="flex flex-wrap items-end gap-2 rounded-lg border p-3">
                <div className="w-32 space-y-1">
                  <Label htmlFor={`sh-label-${i}`} className="text-xs">
                    Label
                  </Label>
                  <Input id={`sh-label-${i}`} value={s.label} onChange={(e) => update({ label: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`sh-start-${i}`} className="text-xs">
                    Starts
                  </Label>
                  <Input id={`sh-start-${i}`} type="datetime-local" disabled={staffed} value={s.startAt} onChange={(e) => update({ startAt: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`sh-end-${i}`} className="text-xs">
                    Ends
                  </Label>
                  <Input id={`sh-end-${i}`} type="datetime-local" disabled={staffed} value={s.endAt} onChange={(e) => update({ endAt: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`sh-req-${i}`} className="text-xs">
                    Needed
                  </Label>
                  <Num id={`sh-req-${i}`} value={s.requiredVolunteers} onChange={(n) => update({ requiredVolunteers: n })} />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={staffed || custom.length === 1}
                  onClick={() => set('custom', custom.filter((_, j) => j !== i))}
                  aria-label={`Remove ${s.label}`}
                  title={staffed ? `Cancel its ${s.activeCount} volunteers first` : undefined}
                >
                  <Trash2Icon className="size-4" />
                </Button>
                {staffed && <p className="w-full text-xs text-muted-foreground">Has {s.activeCount} volunteer(s): times are locked until they&apos;re cancelled.</p>}
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => set('custom', [...custom, { label: `Shift ${custom.length + 1}`, startAt: '', endAt: '', requiredVolunteers: 4 }])}
          >
            <PlusIcon className="size-4" aria-hidden /> Add shift
          </Button>
        </div>
      )}
    </div>
  );
}
