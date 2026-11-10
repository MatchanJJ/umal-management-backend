'use client';

import { AppGate, CenteredMessage } from '@/components/layout/AppGate';

// Placeholder so the gate's onboarding route exists; Task 1.5 builds the 2-step form.
export default function Onboarding() {
  return (
    <AppGate require="onboarding">
      <CenteredMessage title="Complete your profile" body="Onboarding opens here shortly." />
    </AppGate>
  );
}
