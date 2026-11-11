'use client';

import { PinIcon, SearchIcon } from 'lucide-react';
import { useState } from 'react';
import { EligibilityBadge } from '@/components/events/EligibilityBadge';
import { Input } from '@/components/ui/input';
import { useCandidates } from '@/lib/api';

/** App Flow §7.4 "Add someone specific": pins an include; ineligible members show their reason instead. */
export function MemberPinSearch({ eventId, shiftId, pinned, onPin }: { eventId: number; shiftId: number | null; pinned: number[]; onPin: (memberId: number) => void }) {
  const [q, setQ] = useState('');
  const { data } = useCandidates(eventId, q.trim().length >= 2 ? shiftId : null, q.trim());
  return (
    <div className="space-y-2">
      <div className="relative">
        <SearchIcon className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" aria-hidden />
        <Input className="pl-8" placeholder="Add someone specific…" aria-label="Search a member to pin" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {q.trim().length >= 2 && data && (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
          {data.items.slice(0, 8).map(({ member: m, eligibility }) => {
            const ok = eligibility.hard.length === 0;
            const name = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
            return (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <span className="flex-1 truncate">{name}</span>
                {ok ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary disabled:text-muted-foreground"
                    disabled={pinned.includes(m.id)}
                    onClick={() => {
                      onPin(m.id);
                      setQ('');
                    }}
                  >
                    <PinIcon className="size-3.5" aria-hidden /> {pinned.includes(m.id) ? 'Pinned' : 'Pin'}
                  </button>
                ) : (
                  <EligibilityBadge eligibility={eligibility} />
                )}
              </li>
            );
          })}
          {!data.items.length && <li className="px-3 py-2 text-sm text-muted-foreground">No members found.</li>}
        </ul>
      )}
    </div>
  );
}
