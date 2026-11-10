// App Flow §1 entry gate, as pure functions so the routing rules are unit-tested.
import type { MeState } from './api';

/**
 * What a page needs before it renders:
 * - `signed_out`: login screen
 * - `pending` / `rejected`: the access status screens
 * - `onboarding`: approved but not yet onboarded
 * - `onboarded`: any onboarded role; `member` / `adviser`: that role only (other roles get a 403 page)
 * - `route`: never renders; sends everyone to their home (used by `/`)
 */
export type GateRequirement = 'signed_out' | 'pending' | 'rejected' | 'onboarding' | 'onboarded' | 'member' | 'adviser' | 'route';

export type GateDecision = { kind: 'render' } | { kind: 'redirect'; to: string } | { kind: 'forbidden' };

type GateState = 'signed_out' | 'pending' | 'rejected' | 'onboarding' | 'member' | 'adviser';

function stateOf(s: MeState): GateState {
  if (s.kind === 'signed_out') return 'signed_out';
  const { me } = s;
  if (me.accessStatus === 'rejected') return 'rejected';
  if (me.accessStatus !== 'approved' || !me.member) return 'pending';
  if (!me.onboarded) return 'onboarding';
  return me.member.role;
}

const HOME: Record<GateState, string> = {
  signed_out: '/login/',
  pending: '/access/pending/',
  rejected: '/access/rejected/',
  onboarding: '/onboarding/',
  member: '/me/',
  adviser: '/dashboard/',
};

export function homeFor(s: MeState): string {
  return HOME[stateOf(s)];
}

export function gateDecision(s: MeState, req: GateRequirement): GateDecision {
  const state = stateOf(s);
  const home = { kind: 'redirect', to: HOME[state] } as const;
  switch (req) {
    case 'route':
      return home;
    case 'onboarded':
      return state === 'member' || state === 'adviser' ? { kind: 'render' } : home;
    case 'member':
    case 'adviser':
      if (state === req) return { kind: 'render' };
      return state === 'member' || state === 'adviser' ? { kind: 'forbidden' } : home;
    default:
      return state === req ? { kind: 'render' } : home;
  }
}
