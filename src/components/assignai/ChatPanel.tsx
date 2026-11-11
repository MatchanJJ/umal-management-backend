'use client';

import { BotIcon, SendHorizontalIcon, TriangleAlertIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export type ChatMessage = { id: string; role: 'adviser' | 'assistant'; text: string; assumptions?: string[]; kind?: string };

/** Design Brief §7: adviser bubbles right (maroon), assistant left (muted); assumptions as outline chips. */
function MessageBubble({ m }: { m: ChatMessage }) {
  const mine = m.role === 'adviser';
  return (
    <li className={cn('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      <p
        className={cn(
          'max-w-[85%] px-3 py-2 text-sm whitespace-pre-line',
          mine ? 'rounded-xl rounded-br-sm bg-primary text-primary-foreground' : 'rounded-xl rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {m.text}
      </p>
      {m.assumptions?.length ? (
        <div className="flex max-w-[85%] flex-wrap gap-1">
          {m.assumptions.map((a) => (
            <span key={a} className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">
              Assumed: {a}
            </span>
          ))}
        </div>
      ) : null}
    </li>
  );
}

export function ChatPanel({
  messages,
  onSend,
  busy,
  notice,
  providerStatus,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => Promise<boolean>;
  busy: boolean;
  notice?: string | null;
  providerStatus: 'ok' | 'degraded' | 'unknown';
}) {
  const [text, setText] = useState('');
  const end = useRef<HTMLLIElement>(null);
  // Block body on purpose: newer Chrome returns a Promise from scrollIntoView, and an effect must return nothing.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [messages.length, busy]);

  async function send() {
    const t = text.trim();
    if (!t || busy) return;
    // The message stays in the box if the turn fails (App Flow §7.5).
    if (await onSend(t)) setText('');
  }

  return (
    <section aria-label="AssignAI chat" className="flex min-h-[420px] flex-col rounded-lg border bg-card">
      <header className="flex items-center gap-2 border-b px-3 py-2">
        <BotIcon className="size-4 text-primary" aria-hidden />
        <h3 className="text-sm font-semibold">AssignAI</h3>
        <span
          className={cn('ml-1 size-2 rounded-full', providerStatus === 'ok' ? 'bg-success' : providerStatus === 'degraded' ? 'bg-secondary' : 'bg-muted-foreground/40')}
          aria-label={providerStatus === 'ok' ? 'AI available' : providerStatus === 'degraded' ? 'AI unavailable' : 'AI status unknown'}
        />
      </header>
      <ol aria-live="polite" aria-label="Conversation" className="flex-1 space-y-3 overflow-y-auto p-3">
        {!messages.length && (
          <li className="text-sm text-muted-foreground">Describe who you need, e.g. “6 ushers — 3 male, 3 female, tall, no one with class”.</li>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} m={m} />
        ))}
        {busy && (
          <li className="flex gap-1 px-1" aria-label="AssignAI is thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </li>
        )}
        <li ref={end} aria-hidden />
      </ol>
      {notice && (
        <p role="status" className="mx-3 mb-2 flex items-start gap-2 rounded-md bg-warning px-3 py-2 text-xs text-warning-foreground">
          <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {notice}
        </p>
      )}
      <div className="flex items-end gap-2 border-t p-2">
        <Textarea
          aria-label="Message AssignAI"
          rows={2}
          className="min-h-0 resize-none"
          placeholder="e.g. 6 ushers — 3 male, 3 female, tall, no one with class"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button size="icon" onClick={() => void send()} disabled={busy || !text.trim()} aria-label="Send">
          <SendHorizontalIcon className="size-4" />
        </Button>
      </div>
    </section>
  );
}
