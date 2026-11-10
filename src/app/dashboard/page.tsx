'use client';

import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';

// Placeholder so the gate's adviser home exists; Task 6.3 builds the dashboard.
export default function Dashboard() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Dashboard">
          <p className="text-sm text-muted-foreground">The dashboard is coming soon. Review access requests under Access.</p>
        </AdviserShell>
      )}
    </AppGate>
  );
}
