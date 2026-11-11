'use client';

import { EventForm } from '@/components/events/EventForm';
import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';

export default function NewEventPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="New event">
          <EventForm />
        </AdviserShell>
      )}
    </AppGate>
  );
}
