'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { EventForm } from '@/components/events/EventForm';
import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { Skeleton } from '@/components/ui/skeleton';
import { useEvent } from '@/lib/api';

function Edit() {
  const id = Number(useSearchParams().get('id')) || null;
  const { data, isLoading, isError } = useEvent(id);
  if (isError) return <p className="text-sm text-destructive">Event not found.</p>;
  if (isLoading || !data) return <Skeleton className="h-96 max-w-3xl" />;
  // Keyed by version so a refetch after someone else's edit reloads the form.
  return <EventForm key={`${data.id}-${data.version}`} event={data} />;
}

export default function EditEventPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Edit event">
          <Suspense fallback={<Skeleton className="h-96 max-w-3xl" />}>
            <Edit />
          </Suspense>
        </AdviserShell>
      )}
    </AppGate>
  );
}
