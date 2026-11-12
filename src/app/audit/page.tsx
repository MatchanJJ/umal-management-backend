'use client';

import { AuditTable } from '@/components/audit/AuditTable';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { AppGate } from '@/components/layout/AppGate';

/** FR-30 / App Flow §9: filterable audit log. */
export default function AuditPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Audit log">
          <AuditTable />
        </AdviserShell>
      )}
    </AppGate>
  );
}
