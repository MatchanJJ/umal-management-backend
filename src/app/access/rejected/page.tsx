'use client';

import { AppGate, CenteredMessage } from '@/components/layout/AppGate';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';

const dateFmt = new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeZone: 'Asia/Manila' });

export default function RejectedPage() {
  return (
    <AppGate require="rejected">
      {(me) => (
        <CenteredMessage
          title="Your access request wasn't approved"
          body={
            me?.accessRerequestAt ? (
              <>
                If you think this is a mistake, talk to a UMAL adviser. You can request access again from{' '}
                <strong className="font-semibold text-foreground">{dateFmt.format(new Date(me.accessRerequestAt))}</strong> by
                signing in.
              </>
            ) : (
              'If you think this is a mistake, talk to a UMAL adviser.'
            )
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
