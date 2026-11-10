'use client';

import { createAuthClient } from 'better-auth/react';

// Same origin in production (Pages Functions) and in dev (Next proxies /api to wrangler).
export const authClient = createAuthClient({ basePath: '/api/auth' });

export function signInWithGoogle() {
  return authClient.signIn.social({ provider: 'google', callbackURL: '/', errorCallbackURL: '/login/' });
}

export function signOut() {
  // Full reload on purpose: drops every cached query (including /api/me) from the signed-in session.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  return authClient.signOut().finally(() => window.location.assign('/login/'));
}
