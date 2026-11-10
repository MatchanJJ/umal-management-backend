'use client';

import { BulkPreapprove } from '@/components/access/BulkPreapprove';
import { RequestsTable } from '@/components/access/RequestsTable';
import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePendingAccessCount } from '@/lib/api';

function PendingLabel() {
  const { data } = usePendingAccessCount(true);
  return <>Pending{data ? <span className="ml-1.5 tabular-nums text-muted-foreground">({data})</span> : null}</>;
}

export default function AccessPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Access">
          <Tabs defaultValue="pending" className="gap-4">
            <TabsList>
              <TabsTrigger value="pending">
                <PendingLabel />
              </TabsTrigger>
              <TabsTrigger value="approved">Approved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
              <TabsTrigger value="bulk">Bulk pre-approve</TabsTrigger>
            </TabsList>
            <TabsContent value="pending">
              <RequestsTable status="pending" />
            </TabsContent>
            <TabsContent value="approved">
              <RequestsTable status="approved" />
            </TabsContent>
            <TabsContent value="rejected">
              <RequestsTable status="rejected" />
            </TabsContent>
            <TabsContent value="bulk">
              <BulkPreapprove />
            </TabsContent>
          </Tabs>
        </AdviserShell>
      )}
    </AppGate>
  );
}
