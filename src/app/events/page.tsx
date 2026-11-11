'use client';

import { PlusIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { EventList } from '@/components/events/EventList';
import { AppGate } from '@/components/layout/AppGate';
import { AppShell } from '@/components/layout/MemberShell';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useEvents } from '@/lib/api';
import type { EventDTO } from '../../../shared/events';

function Events({ adviser }: { adviser: boolean }) {
  const [status, setStatus] = useState<EventDTO['status'] | 'all'>('all');
  const { data, isLoading } = useEvents(status === 'all' ? undefined : status);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            {adviser && <TabsTrigger value="draft">Draft</TabsTrigger>}
            <TabsTrigger value="published">Published</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            {adviser && <TabsTrigger value="cancelled">Cancelled</TabsTrigger>}
          </TabsList>
        </Tabs>
        {adviser && (
          <Button asChild>
            <Link href="/events/new/">
              <PlusIcon className="size-4" aria-hidden /> New event
            </Link>
          </Button>
        )}
      </div>
      <EventList events={data?.items} loading={isLoading} />
    </div>
  );
}

export default function EventsPage() {
  return (
    <AppGate require="onboarded">
      {(me) => (
        <AppShell me={me!} title="Events">
          <Events adviser={me!.member!.role === 'adviser'} />
        </AppShell>
      )}
    </AppGate>
  );
}
