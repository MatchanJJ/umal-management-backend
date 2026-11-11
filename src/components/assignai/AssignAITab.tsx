'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, useAddAssignments, useAiConstraints, useAiSession, useAiTurn, useCatalog } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ResultDTO, SessionResponse, TurnResponse } from '../../../shared/ai';
import type { Constraints, Pins } from '../../../shared/constraints';
import type { EventDTO } from '../../../shared/events';
import { manilaNow } from '../../../shared/time';
import { ApproveDialog, type Ineligible } from './ApproveDialog';
import { ChatPanel, type ChatMessage } from './ChatPanel';
import { changedFields, ConstraintsCard } from './ConstraintsCard';
import { MemberPinSearch } from './MemberPinSearch';
import { applyRelaxation, PicksPanel } from './PicksPanel';
import { ShiftScopeBar } from './ShiftScopeBar';

const UNAVAILABLE = 'AI unavailable. You can still edit constraints directly.';

function toMessages(s: SessionResponse): ChatMessage[] {
  return s.turns.flatMap((t) =>
    t.kind === 'manual_edit'
      ? []
      : [
          ...(t.userMessage ? [{ id: `${t.id}-u`, role: 'adviser' as const, text: t.userMessage }] : []),
          ...(t.reply ? [{ id: `${t.id}-a`, role: 'assistant' as const, text: t.reply, assumptions: t.assumptions, kind: t.kind }] : []),
        ],
  );
}

function Session({ event, data, onApproved }: { event: EventDTO; data: SessionResponse; onApproved: () => void }) {
  const qc = useQueryClient();
  const sessionId = data.session.id;
  const catalog = useCatalog();
  const turn = useAiTurn(sessionId);
  const edit = useAiConstraints(sessionId);
  const approve = useAddAssignments(event.id);

  const [constraints, setConstraints] = useState<Constraints>(data.session.constraints);
  const [pins, setPins] = useState<Pins>(data.session.pins);
  const [scope, setScope] = useState<number[]>(data.session.scope.shiftIds);
  const [result, setResult] = useState<ResultDTO>(data.result);
  const [version, setVersion] = useState(data.eventVersion);
  const [messages, setMessages] = useState<ChatMessage[]>(() => toMessages(data));
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [provider, setProvider] = useState<'ok' | 'degraded' | 'unknown'>('unknown');
  const [view, setView] = useState<'chat' | 'picks'>('chat');
  const [confirming, setConfirming] = useState(false);
  const [ineligible, setIneligible] = useState<Ineligible | null>(null);
  const clearHighlight = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(clearHighlight.current), []);

  function apply(r: TurnResponse) {
    const diff = changedFields(constraints, r.constraints);
    setConstraints(r.constraints);
    setResult(r.result);
    setScope(r.scope.shiftIds);
    setVersion(r.eventVersion);
    setChanged(diff);
    clearTimeout(clearHighlight.current);
    clearHighlight.current = setTimeout(() => setChanged(new Set()), 2000);
  }

  // Manual edits re-rank without the LLM (PUT /constraints).
  function rerank(next: { constraints?: Constraints; pins?: Pins; scope?: number[] }) {
    const body = { constraints: next.constraints ?? constraints, pins: next.pins ?? pins, scope: { shiftIds: next.scope ?? scope } };
    if (next.constraints) setConstraints(next.constraints);
    if (next.pins) setPins(next.pins);
    if (next.scope) setScope(next.scope);
    edit.mutate(body, { onSuccess: apply, onError: (e) => toast.error(e.message) });
  }

  async function send(text: string): Promise<boolean> {
    setNotice(null);
    setMessages((m) => [...m, { id: `local-${Date.now()}`, role: 'adviser', text }]);
    try {
      const r = await turn.mutateAsync({ message: text, pins, scope: { shiftIds: scope } });
      setProvider(r.turn.provider === 'none' ? 'degraded' : 'ok');
      if (r.turn.provider === 'none') setNotice(UNAVAILABLE);
      setMessages((m) => [...m, { id: `${r.turn.id}-a`, role: 'assistant', text: r.turn.reply, assumptions: r.turn.assumptions, kind: r.turn.kind }]);
      apply(r);
      if (r.turn.kind === 'update') setView('picks');
      return true;
    } catch (e) {
      setMessages((m) => m.slice(0, -1)); // the text stays in the input for a retry
      setNotice(e instanceof ApiError && e.code === 'AI_RATE_LIMITED' ? `${e.message} Manual editing still works.` : `Couldn’t reach AssignAI: ${(e as Error).message}`);
      return false;
    }
  }

  async function submit(skip: Set<string> = new Set()) {
    const items = result.perShift
      .map((s) => ({ shiftId: s.shiftId, memberIds: s.result.picks.map((p) => p.memberId).filter((m) => !skip.has(`${s.shiftId}:${m}`)) }))
      .filter((i) => i.memberIds.length);
    if (!items.length) return setConfirming(false);
    try {
      const r = await approve.mutateAsync({ items, source: 'ai', aiSessionId: sessionId, expectedVersion: version });
      toast.success(`${r.created.length} assignment${r.created.length === 1 ? '' : 's'} across ${items.length} shift${items.length === 1 ? '' : 's'}`);
      setConfirming(false);
      await qc.invalidateQueries({ queryKey: ['ai-session', event.id] }); // the session is now approved; the next visit starts fresh
      onApproved();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INELIGIBLE') return setIneligible(e.details as Ineligible);
      setConfirming(false);
      if (e instanceof ApiError && e.code === 'VERSION_CONFLICT') {
        toast.error('The roster changed. Picks were refreshed — review and approve again.');
        return rerank({});
      }
      if (e instanceof ApiError && e.code === 'OVER_CAPACITY') {
        const d = (e.details as { shiftId: number; remaining: number }[]) ?? [];
        return toast.error(`Too many picks: ${d.map((x) => `${result.perShift.find((s) => s.shiftId === x.shiftId)?.label} has ${x.remaining} open`).join(', ')}. Remove some.`);
      }
      toast.error((e as Error).message);
    }
  }

  const now = manilaNow();
  const shifts = event.shifts.filter((s) => s.endAt > now);
  const busy = turn.isPending || edit.isPending;

  const right = (
    <div className="space-y-4">
      <ConstraintsCard value={constraints} colleges={catalog.data?.colleges ?? []} changed={changed} onChange={(c) => rerank({ constraints: c })} />
      <MemberPinSearch
        eventId={event.id}
        shiftId={scope[0] ?? null}
        pinned={pins.include}
        onPin={(id) => rerank({ pins: { include: [...pins.include, id], exclude: pins.exclude.filter((x) => x !== id) } })}
      />
      <PicksPanel
        result={result}
        constraints={constraints}
        busy={busy}
        onRemove={(id) => rerank({ pins: { include: pins.include.filter((x) => x !== id), exclude: [...pins.exclude, id] } })}
        onRelax={(gi, relax) => rerank({ constraints: applyRelaxation(constraints, gi, relax) })}
        onApprove={() => {
          setIneligible(null);
          setConfirming(true);
        }}
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <ShiftScopeBar
        shifts={shifts}
        scope={scope}
        onScope={(ids) => rerank({ scope: ids })}
        teamMode={constraints.teamMode}
        onTeamMode={(m) => rerank({ constraints: { ...constraints, teamMode: m } })}
      />
      {/* Mobile: segmented Chat | Picks (App Flow §7.1). */}
      <div className="inline-flex rounded-md border p-0.5 text-sm lg:hidden" role="tablist" aria-label="AssignAI view">
        {(['chat', 'picks'] as const).map((v) => (
          <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn('rounded px-4 py-1 capitalize', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
            {v === 'chat' ? 'Chat' : 'Picks'}
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_3fr]">
        <div className={cn(view === 'chat' ? 'block' : 'hidden', 'lg:block')}>
          <ChatPanel messages={messages} onSend={send} busy={turn.isPending} notice={notice} providerStatus={provider} />
        </div>
        <div className={cn(view === 'picks' ? 'block' : 'hidden', 'lg:block')}>{right}</div>
      </div>
      <ApproveDialog
        open={confirming}
        result={result}
        ineligible={ineligible}
        busy={approve.isPending}
        onConfirm={() => void submit()}
        onDropIneligible={() => void submit(new Set((ineligible ?? []).map((i) => `${i.shiftId}:${i.memberId}`)))}
        onClose={() => setConfirming(false)}
      />
    </div>
  );
}

/** Event detail → AssignAI tab (App Flow §7). */
export function AssignAITab({ event, onApproved }: { event: EventDTO; onApproved: () => void }) {
  const { data, isLoading, isError, error } = useAiSession(event.id);
  if (isLoading) return <Skeleton className="h-96" />;
  if (isError || !data) return <p className="text-sm text-destructive">{(error as Error)?.message ?? 'Couldn’t open AssignAI.'}</p>;
  return <Session key={data.session.id} event={event} data={data} onApproved={onApproved} />;
}
