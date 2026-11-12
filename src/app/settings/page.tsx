'use client';

import { AppGate } from '@/components/layout/AppGate';
import { AdviserShell } from '@/components/layout/AdviserShell';
import { AiSettings } from '@/components/settings/AiSettings';
import { CatalogSettings } from '@/components/settings/CatalogSettings';
import { GeneralSettings } from '@/components/settings/GeneralSettings';
import { ScoringSettings } from '@/components/settings/ScoringSettings';
import { TermsSettings } from '@/components/settings/TermsSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// App Flow §10.
export default function SettingsPage() {
  return (
    <AppGate require="adviser">
      {(me) => (
        <AdviserShell me={me!} title="Settings">
          <Tabs defaultValue="general" className="gap-4">
            <TabsList>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="terms">Terms</TabsTrigger>
              <TabsTrigger value="catalog">Colleges &amp; Courses</TabsTrigger>
              <TabsTrigger value="scoring">Scoring</TabsTrigger>
              <TabsTrigger value="ai">AI</TabsTrigger>
            </TabsList>
            <TabsContent value="general">
              <GeneralSettings />
            </TabsContent>
            <TabsContent value="terms">
              <TermsSettings />
            </TabsContent>
            <TabsContent value="catalog">
              <CatalogSettings />
            </TabsContent>
            <TabsContent value="scoring">
              <ScoringSettings />
            </TabsContent>
            <TabsContent value="ai">
              <AiSettings />
            </TabsContent>
          </Tabs>
        </AdviserShell>
      )}
    </AppGate>
  );
}
