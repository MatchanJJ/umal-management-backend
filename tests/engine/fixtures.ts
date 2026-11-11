import type { CandidateFacts, ShiftCtx } from '../../server/engine/types';

/** A fully eligible member (schedule submitted, no classes, blocks or bookings). */
export function facts(overrides: Partial<CandidateFacts> = {}): CandidateFacts {
  return {
    memberId: 1,
    gender: 'F',
    collegeCode: 'CCE',
    yearLevel: 3,
    isNew: false,
    heightCm: 165,
    scheduleSubmitted: true,
    classesByWeekday: {},
    weeklyUnavailable: {},
    dateUnavailable: [],
    bookings: [],
    termHours: 0,
    lastPastAssignmentDate: null,
    attended: 0,
    noShow: 0,
    ...overrides,
  };
}

/** Shift 1 of event 1: Thursday 2026-11-12 13:00–17:00, 4 required, term 2026-08-10 – 2026-12-18. */
export function shift(overrides: Partial<ShiftCtx> = {}): ShiftCtx {
  return {
    eventId: 1,
    shiftId: 1,
    startAt: '2026-11-12T13:00',
    endAt: '2026-11-12T17:00',
    requiredVolunteers: 4,
    activeCount: 0,
    termStart: '2026-08-10',
    termEnd: '2026-12-18',
    today: '2026-11-10',
    now: '2026-11-10T09:00',
    requireSchedule: true,
    ...overrides,
  };
}

export const noPins = { include: [], exclude: [] };
