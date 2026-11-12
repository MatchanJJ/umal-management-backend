'use client';

import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AppGate } from '@/components/layout/AppGate';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/auth-client';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}

const ERRORS: Record<string, string> = {
  DOMAIN_NOT_ALLOWED: 'Use your @umindanao.edu.ph Google account to sign in.',
  access_denied: 'Google sign-in was cancelled.',
};

function SignInError() {
  const code = useSearchParams().get('error');
  if (!code) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
      {ERRORS[code] ?? ERRORS[code.toUpperCase()] ?? 'Sign-in failed. Please try again.'}
    </p>
  );
}

function LoginScreen() {
  const [busy, setBusy] = useState(false);
  return (
    <main className="grid min-h-svh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand band (Design Brief §5): maroon, white text, one gold highlight word. */}
      <section className="flex flex-col justify-between bg-primary px-6 py-8 text-primary-foreground sm:px-10 lg:px-14 lg:py-12">
        {/* The red mark disappears on maroon and mustn't be recoloured (Design Brief §2), so it sits on a white tile. */}
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white p-2">
            <Image src="/brand/umal-mark.png" alt="" width={105} height={120} className="h-full w-auto" />
          </span>
          <div>
            <p className="text-xl leading-tight font-bold">UMAL</p>
            <p className="text-sm font-medium text-primary-foreground/85">University of Mindanao</p>
          </div>
        </div>
        <div className="my-10 max-w-lg lg:my-0">
          <h1 className="text-3xl leading-tight font-extrabold sm:text-4xl sm:leading-[44px]">
            Ambassadors who show up, <span className="text-secondary">fairly</span> scheduled.
          </h1>
          <span aria-hidden className="mt-5 block h-[3px] w-10 bg-secondary" />
          <p className="mt-5 text-sm leading-[22px] text-primary-foreground/90">
            Events, rosters and attendance for the University of Mindanao Ambassadors League.
          </p>
        </div>
        <p className="hidden text-xs text-primary-foreground/75 lg:block">For UMAL members and advisers.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Sign in</h2>
            <p className="mt-1 text-sm text-muted-foreground">Use your @umindanao.edu.ph Google account.</p>
          </div>
          <Suspense fallback={null}>
            <SignInError />
          </Suspense>
          <Button
            size="lg"
            variant="outline"
            className="h-11 w-full gap-3 text-sm font-medium"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await signInWithGoogle();
              } finally {
                setBusy(false);
              }
            }}
          >
            <GoogleMark />
            {busy ? 'Redirecting to Google…' : 'Continue with Google'}
          </Button>
          <p className="text-xs leading-5 text-muted-foreground">
            New here? Signing in sends an access request to the UMAL advisers. You can use the app once it&apos;s approved.
          </p>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AppGate require="signed_out">
      <LoginScreen />
    </AppGate>
  );
}
