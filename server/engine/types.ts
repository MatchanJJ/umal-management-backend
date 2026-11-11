// Engine input/output types (TRD §8). Built by services/candidate-loader.ts; consumed by pure engine functions.
import type { Pins } from '../../shared/constraints';
import type { Reason } from '../../shared/enums';
import type { Weekday } from './time';

export type { Pins, Reason };

export type Interval = { start: string; end: string };

export type CandidateFacts = {
  memberId: number;
  gender: 'M' | 'F' | null;
  collegeCode: string | null;
  yearLevel: number | null;
  isNew: boolean;
  heightCm: number | null;
  scheduleSubmitted: boolean;
  classesByWeekday: Partial<Record<Weekday, Interval[]>>;
  weeklyUnavailable: Partial<Record<Weekday, Interval[]>>;
  dateUnavailable: { date: string; start: string; end: string }[];
  /** Non-cancelled shifts this member holds ('YYYY-MM-DDTHH:MM'). */
  bookings: { shiftId: number; start: string; end: string }[];
  termHours: number;
  /** Date part of end_at of the latest ENDED shift. */
  lastPastAssignmentDate: string | null;
  attended: number;
  noShow: number;
};

export type ShiftCtx = {
  eventId: number;
  shiftId: number;
  startAt: string;
  endAt: string;
  requiredVolunteers: number;
  activeCount: number;
  termStart: string;
  termEnd: string;
  today: string;
  /** 'YYYY-MM-DDTHH:MM' Asia/Manila. */
  now: string;
  requireSchedule: boolean;
};

export type Eligibility = { hard: Reason[]; soft: Reason[] };
