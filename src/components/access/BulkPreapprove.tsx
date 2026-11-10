'use client';

import { UploadIcon } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useBulkApprove } from '@/lib/api';
import { normalizeEmails, splitEmailInput } from '../../../shared/emails';
import type { BulkAccessResult } from '../../../shared/api';
import type { Role } from '../../../shared/enums';

/** FR-3 / App Flow §3: paste or CSV → preview counts → confirm. */
export function BulkPreapprove() {
  const [text, setText] = useState('');
  const [role, setRole] = useState<Role>('member');
  const [result, setResult] = useState<BulkAccessResult | null>(null);
  const bulk = useBulkApprove();
  const fileId = useId();

  const raw = useMemo(() => splitEmailInput(text), [text]);
  const preview = useMemo(() => normalizeEmails(raw), [raw]);
  const tooMany = raw.length > 500;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <div className="space-y-2">
        <Label htmlFor="bulk-emails">Emails</Label>
        <Textarea
          id="bulk-emails"
          className="min-h-56 font-mono text-sm"
          placeholder={'one@umindanao.edu.ph\ntwo@umindanao.edu.ph, three@umindanao.edu.ph'}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          aria-describedby="bulk-help"
        />
        <p id="bulk-help" className="text-xs text-muted-foreground">
          One email per line (commas are fine), or upload a CSV with an <code>email</code> column. Up to 500 at a time.
        </p>
        <div>
          <input
            id={fileId}
            type="file"
            accept=".csv,text/csv,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) setText(await file.text());
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" asChild>
            <label htmlFor={fileId} className="cursor-pointer">
              <UploadIcon className="size-4" aria-hidden /> Upload CSV
            </label>
          </Button>
        </div>
      </div>

      <aside className="space-y-4 rounded-lg border p-4">
        <div className="space-y-2">
          <Label htmlFor="bulk-role">Approve as</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Role)}>
            <SelectTrigger id="bulk-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">Member</SelectItem>
              <SelectItem value="adviser">Adviser</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <dl className="space-y-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Valid emails</dt>
            <dd className="font-semibold tabular-nums">{preview.valid.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Invalid</dt>
            <dd className={preview.invalid.length ? 'font-semibold text-destructive tabular-nums' : 'tabular-nums'}>
              {preview.invalid.length}
            </dd>
          </div>
        </dl>
        {preview.invalid.length > 0 && (
          <p className="text-xs break-all text-destructive">Skipped: {preview.invalid.slice(0, 5).join(', ')}{preview.invalid.length > 5 ? '…' : ''}</p>
        )}
        {tooMany && <p className="text-xs text-destructive">That&apos;s more than 500 entries. Split the list.</p>}
        <Button
          className="w-full"
          disabled={!preview.valid.length || tooMany || bulk.isPending}
          onClick={() =>
            bulk.mutate(
              { emails: raw, role },
              {
                onSuccess: (r) => {
                  setResult(r);
                  toast.success(`Pre-approved ${r.created} ${r.created === 1 ? 'email' : 'emails'}`);
                },
                onError: (e) => toast.error(e.message),
              },
            )
          }
        >
          Pre-approve {preview.valid.length || ''}
        </Button>
        {result && (
          <p role="status" className="text-sm text-muted-foreground">
            {result.created} new, {result.alreadyApproved} already approved
            {result.invalid.length ? `, ${result.invalid.length} invalid` : ''}.
          </p>
        )}
      </aside>
    </div>
  );
}
