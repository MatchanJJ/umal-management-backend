'use client';

import { useDeferredValue, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useCandidates, useEvents, useSaveSettings, useSettings } from '@/lib/api';
import { shiftWhen } from '@/lib/format';
import { SettingsPatch, type Settings } from '../../../shared/settings';
import { manilaNow } from '../../../shared/time';

type Weights = Settings['scoring.weights'];

const WEIGHTS: { key: keyof Weights; label: string; help: string }[] = [
  { key: 'load', label: 'Load', help: 'Favours members with fewer hours served this term.' },
  { key: 'recency', label: 'Recency', help: "Favours members who haven't served recently." },
  { key: 'reliability', label: 'Reliability', help: 'Favours members who show up (attended vs no-show).' },
];

/** Live top 10 for one upcoming shift, scored with the unsaved weights (TRD §8.3). */
function Preview({ weights }: { weights: Weights }) {
  const { data: events } = useEvents();
  const now = manilaNow();
  const shifts = (events?.items ?? [])
    .filter((e) => e.status === 'draft' || e.status === 'published')
    .flatMap((e) => e.shifts.filter((s) => s.startAt > now).map((s) => ({ eventId: e.id, title: e.title, ...s })))
    .sort((a, b) => a.startAt.localeCompare(b.startAt));
  const [picked, setPicked] = useState<number | null>(null);
  const shift = shifts.find((s) => s.id === picked) ?? shifts[0];
  const deferred = useDeferredValue(weights);
  const { data, isFetching } = useCandidates(shift?.eventId ?? 0, shift?.id ?? null, '', deferred);
  const top = (data?.items ?? []).filter((c) => !c.eligibility.hard.length && !c.eligibility.soft.includes('CLASS_CONFLICT')).slice(0, 10);

  if (!events) return <Skeleton className="h-40" />;
  if (!shift) return <p className="text-sm text-muted-foreground">Create an upcoming event to preview the ranking.</p>;
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="preview-shift">Preview shift</Label>
        <Select value={String(shift.id)} onValueChange={(v) => setPicked(Number(v))}>
          <SelectTrigger id="preview-shift" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {shifts.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.title} · {s.label} · {shiftWhen(s.startAt, s.endAt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <ol aria-label="Top 10 eligible members" aria-busy={isFetching} className={`divide-y rounded-lg border text-sm ${isFetching ? 'opacity-60' : ''}`}>
        {top.map((c, i) => (
          <li key={c.member.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-5 text-right text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="flex-1 font-medium">{[c.member.firstName, c.member.lastName].filter(Boolean).join(' ') || c.member.email}</span>
            <span className="text-muted-foreground tabular-nums">{c.member.termHours} h</span>
            <span className="w-14 text-right tabular-nums">{c.score.total.toFixed(2)}</span>
          </li>
        ))}
        {!top.length && <li className="px-3 py-4 text-muted-foreground">No eligible members for this shift.</li>}
      </ol>
    </div>
  );
}

function ScoringForm({ initial }: { initial: Settings }) {
  const save = useSaveSettings();
  const [weights, setWeights] = useState(initial['scoring.weights']);
  const [unit, setUnit] = useState(String(initial['scoring.loadUnitHours']));
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = SettingsPatch.safeParse({ 'scoring.weights': weights, 'scoring.loadUnitHours': Number(unit) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid value');
    setError(null);
    save.mutate(parsed.data, { onSuccess: () => toast.success('Scoring saved'), onError: (err) => toast.error(err.message) });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <form onSubmit={submit} noValidate className="space-y-6">
        <FieldGroup>
          {WEIGHTS.map((w) => (
            <Field key={w.key}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor={`w-${w.key}`}>{w.label}</FieldLabel>
                <span className="text-sm tabular-nums">{weights[w.key].toFixed(1)}</span>
              </div>
              <input
                id={`w-${w.key}`}
                type="range"
                min={0}
                max={10}
                step={0.5}
                value={weights[w.key]}
                onChange={(e) => setWeights((cur) => ({ ...cur, [w.key]: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
              <FieldDescription>{w.help}</FieldDescription>
            </Field>
          ))}
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="load-unit">Load unit (hours)</FieldLabel>
            <Input id="load-unit" type="number" min={1} max={12} className="w-28" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <FieldDescription>How many hours count as one &quot;duty&quot; when comparing workloads. Default 4.</FieldDescription>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </Field>
        </FieldGroup>
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? 'Saving…' : 'Save'}
        </Button>
      </form>
      <section aria-labelledby="preview-title" className="space-y-3">
        <h3 id="preview-title" className="font-semibold">
          Live preview
        </h3>
        <p className="text-sm text-muted-foreground">Uses the weights above before you save. The load unit applies after saving.</p>
        <Preview weights={weights} />
      </section>
    </div>
  );
}

export function ScoringSettings() {
  const { data } = useSettings();
  return data ? <ScoringForm initial={data} /> : <Skeleton className="h-64" />;
}
