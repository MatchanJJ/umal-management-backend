'use client';

import { CheckCircle2Icon, TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAiHealth, useSaveSettings, useSettings } from '@/lib/api';
import { stampManila } from '@/lib/format';
import { SettingsPatch } from '../../../shared/settings';

function TurnsForm({ initial }: { initial: number }) {
  const save = useSaveSettings();
  const [value, setValue] = useState(String(initial));
  const [error, setError] = useState<string | null>(null);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = SettingsPatch.safeParse({ 'ai.turnsPerHour': Number(value) });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid value');
    setError(null);
    save.mutate(parsed.data, { onSuccess: () => toast.success('AI settings saved'), onError: (err) => toast.error(err.message) });
  }
  return (
    <form onSubmit={submit} noValidate className="max-w-sm space-y-3">
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor="turns">Chat turns per hour, per adviser</FieldLabel>
        <Input id="turns" type="number" min={1} max={500} className="w-28" value={value} onChange={(e) => setValue(e.target.value)} />
        <FieldDescription>Keeps the free AI tiers within their limits. Default 40.</FieldDescription>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </Field>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}

/** App Flow §10: rate limit plus provider status from ai_turns. */
export function AiSettings() {
  const { data: settings } = useSettings();
  const { data: ai } = useAiHealth();
  if (!settings || !ai) return <Skeleton className="h-48" />;
  const healthy = ai.failures7d === 0;
  return (
    <div className="max-w-xl space-y-8">
      <TurnsForm initial={settings['ai.turnsPerHour']} />
      <section aria-labelledby="ai-status" className="space-y-3">
        <h3 id="ai-status" className="flex items-center gap-2 font-semibold">
          {healthy ? <CheckCircle2Icon className="size-4 text-success" aria-hidden /> : <TriangleAlertIcon className="size-4 text-destructive" aria-hidden />}
          Provider status: {healthy ? 'working' : 'some turns failed'}
        </h3>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {(
            [
              ['Turns (7 days)', ai.turns7d],
              ['Median response', ai.p50LatencyMs === null ? '—' : `${(ai.p50LatencyMs / 1000).toFixed(1)} s`],
              ['Answered by Gemini', ai.providers.gemini ?? 0],
              ['Fell back to Groq', ai.fallbacks7d],
              ['No provider answered', ai.failures7d],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b py-1.5">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="text-sm">
          <p className="text-muted-foreground">Last provider error</p>
          {ai.lastError ? (
            <p>
              <span className="tabular-nums">{stampManila(ai.lastError.at)}</span> · <code className="break-all text-xs">{ai.lastError.message}</code>
            </p>
          ) : (
            <p>None recorded.</p>
          )}
        </div>
      </section>
    </div>
  );
}
