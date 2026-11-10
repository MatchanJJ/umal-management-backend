import { describe, expect, it } from 'vitest';
import { gateDecision, homeFor, type GateRequirement } from '../../src/lib/gate';
import type { MeState } from '../../src/lib/api';
import type { MeResponse } from '../../shared/api';

function me(over: Partial<MeResponse> & { role?: 'member' | 'adviser' } = {}): MeState {
  const { role = 'member', ...rest } = over;
  return {
    kind: 'signed_in',
    me: {
      user: { id: 'u', email: 'a@umindanao.edu.ph', name: 'A', image: null },
      accessStatus: 'approved',
      accessRerequestAt: null,
      onboarded: true,
      member: { id: 1, email: 'a@umindanao.edu.ph', role, status: 'active' } as MeResponse['member'],
      activeTerm: null,
      scheduleSubmitted: true,
      ...rest,
    },
  };
}

// App Flow §1
describe('homeFor', () => {
  it.each<[string, MeState, string]>([
    ['no session', { kind: 'signed_out' }, '/login/'],
    ['pending', me({ accessStatus: 'pending', member: null, onboarded: false }), '/access/pending/'],
    ['rejected', me({ accessStatus: 'rejected', member: null, onboarded: false }), '/access/rejected/'],
    ['approved, not onboarded', me({ onboarded: false }), '/onboarding/'],
    ['member', me(), '/me/'],
    ['adviser', me({ role: 'adviser' }), '/dashboard/'],
  ])('%s → %s', (_label, state, route) => {
    expect(homeFor(state)).toBe(route);
  });
});

describe('gateDecision', () => {
  const cases: [string, MeState, GateRequirement, ReturnType<typeof gateDecision>][] = [
    ['member page, member', me(), 'member', { kind: 'render' }],
    ['adviser page, adviser', me({ role: 'adviser' }), 'adviser', { kind: 'render' }],
    ['adviser page, member → 403', me(), 'adviser', { kind: 'forbidden' }],
    ['any page, adviser', me({ role: 'adviser' }), 'onboarded', { kind: 'render' }],
    ['adviser page, signed out → login', { kind: 'signed_out' }, 'adviser', { kind: 'redirect', to: '/login/' }],
    ['adviser page, pending → pending', me({ accessStatus: 'pending', member: null }), 'adviser', { kind: 'redirect', to: '/access/pending/' }],
    ['member page, not onboarded → onboarding', me({ onboarded: false }), 'member', { kind: 'redirect', to: '/onboarding/' }],
    ['pending page, pending', me({ accessStatus: 'pending', member: null }), 'pending', { kind: 'render' }],
    ['pending page, approved member → home', me(), 'pending', { kind: 'redirect', to: '/me/' }],
    ['login page, signed out', { kind: 'signed_out' }, 'signed_out', { kind: 'render' }],
    ['login page, adviser → dashboard', me({ role: 'adviser' }), 'signed_out', { kind: 'redirect', to: '/dashboard/' }],
    ['onboarding page, not onboarded', me({ onboarded: false }), 'onboarding', { kind: 'render' }],
    ['onboarding page, onboarded → home', me(), 'onboarding', { kind: 'redirect', to: '/me/' }],
    ['router page (/), adviser → dashboard', me({ role: 'adviser' }), 'route', { kind: 'redirect', to: '/dashboard/' }],
  ];
  it.each(cases)('%s', (_label, state, req, expected) => {
    expect(gateDecision(state, req)).toEqual(expected);
  });
});
