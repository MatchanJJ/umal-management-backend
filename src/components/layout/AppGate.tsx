'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useMe } from '@/lib/api';
import { gateDecision, homeFor, type GateRequirement } from '@/lib/gate';
import type { MeResponse } from '../../../shared/api';

type Props = {
  require: GateRequirement;
  /** Rendered once the gate passes; receives /api/me when signed in. */
  children: ReactNode | ((me: MeResponse | null) => ReactNode);
};

/** App Flow §1: reads /api/me and redirects by access state before the page renders. */
export function AppGate({ require, children }: Props) {
  const router = useRouter();
  const { data, isError, refetch } = useMe();
  const decision = data ? gateDecision(data, require) : null;

  useEffect(() => {
    if (decision?.kind === 'redirect') router.replace(decision.to);
  }, [decision, router]);

  if (isError) {
    return (
      <CenteredMessage title="We couldn't reach the server" body="Check your connection and try again.">
        <Button onClick={() => refetch()}>Try again</Button>
      </CenteredMessage>
    );
  }
  if (!data || !decision || decision.kind === 'redirect') return <PageSkeleton />;
  if (decision.kind === 'forbidden') {
    return (
      <CenteredMessage title="You don't have access to this page" body="This page is for UMAL advisers.">
        <Button asChild>
          <Link href={homeFor(data)}>Go to your home</Link>
        </Button>
      </CenteredMessage>
    );
  }
  const me = data.kind === 'signed_in' ? data.me : null;
  return <>{typeof children === 'function' ? children(me) : children}</>;
}

export function PageSkeleton() {
  return (
    <div className="flex min-h-svh w-full" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 shrink-0 border-r bg-sidebar p-4 lg:block">
        <Skeleton className="mb-6 h-8 w-32" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="mb-2 h-9 w-full" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <Skeleton className="mb-2 h-8 w-48" />
        <Skeleton className="mb-8 h-[3px] w-10" />
        <Skeleton className="h-64 w-full max-w-5xl" />
      </div>
    </div>
  );
}

export function CenteredMessage({ title, body, children }: { title: string; body?: ReactNode; children?: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <span aria-hidden className="h-[3px] w-10 bg-secondary" />
      {body && <p className="max-w-md text-sm text-muted-foreground">{body}</p>}
      {children && <div className="mt-2 flex gap-2">{children}</div>}
    </main>
  );
}
