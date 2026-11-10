'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useSaveSettings, useSettings } from '@/lib/api';
import { SettingsPatch, type Settings } from '../../../shared/settings';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function GeneralForm({ initial }: { initial: Settings }) {
  const save = useSaveSettings();
  const [domain, setDomain] = useState(initial['auth.allowedEmailDomain'] ?? '');
  const [requireSchedule, setRequireSchedule] = useState(initial['assignment.requireSchedule']);
  const [startMonth, setStartMonth] = useState(initial['schoolYear.startMonth']);
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = SettingsPatch.safeParse({
      'auth.allowedEmailDomain': domain.trim() || null,
      'assignment.requireSchedule': requireSchedule,
      'schoolYear.startMonth': startMonth,
    });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Invalid value');
    setError(null);
    save.mutate(parsed.data, { onSuccess: () => toast.success('Settings saved'), onError: (err) => toast.error(err.message) });
  }

  return (
    <form onSubmit={submit} noValidate className="max-w-xl space-y-6">
      <FieldGroup>
        <Field data-invalid={!!error}>
          <FieldLabel htmlFor="domain">Allowed sign-in domain</FieldLabel>
          <Input id="domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="umindanao.edu.ph" aria-describedby="domain-help" />
          <FieldDescription id="domain-help">
            Only Google accounts on this domain can sign in. Leave empty to allow any domain. The bootstrap adviser can always sign in.
          </FieldDescription>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </Field>
        <Field orientation="horizontal">
          <Switch id="require-schedule" checked={requireSchedule} onCheckedChange={setRequireSchedule} />
          <FieldLabel htmlFor="require-schedule" className="font-normal">
            Members need a submitted class schedule to be assigned
          </FieldLabel>
        </Field>
        <Field>
          <FieldLabel htmlFor="start-month">School year starts in</FieldLabel>
          <Select value={String(startMonth)} onValueChange={(v) => setStartMonth(Number(v))}>
            <SelectTrigger id="start-month" className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>Used to tell new members (joined this school year) from returning ones.</FieldDescription>
        </Field>
      </FieldGroup>
      <Button type="submit" disabled={save.isPending}>
        {save.isPending ? 'Saving…' : 'Save'}
      </Button>
    </form>
  );
}

export function GeneralSettings() {
  const { data } = useSettings();
  return data ? <GeneralForm initial={data} /> : <Skeleton className="h-64 max-w-xl" />;
}
