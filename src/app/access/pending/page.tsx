'use client';

import { AppGate, CenteredMessage } from '@/components/layout/AppGate';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

export default function PendingPage() {
  return (
    <AppGate require="pending">
      {(me) => (
        <CenteredMessage
          title="Your request was sent to UMAL advisers"
          body={
            <>
              You signed in as <strong className="font-semibold text-foreground">{me?.user.email}</strong>. We&apos;ll let you in
              as soon as an adviser approves it. Check back later.
            </>
          }
        >
          <Button variant="outline" onClick={() => signOut()}>
            Sign out
          </Button>
        </CenteredMessage>
      )}
    </AppGate>
  );
}
