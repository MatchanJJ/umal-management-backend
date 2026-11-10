'use client';

import { AppGate, CenteredMessage } from '@/components/layout/AppGate';

// Placeholder so the gate's member home exists; Task 2.3 builds the member home.
export default function MemberHome() {
  return (
    <AppGate require="member">
      <CenteredMessage title="Member home" body="Your shifts and term stats will appear here." />
    </AppGate>
  );
}
