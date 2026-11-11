import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceTab } from '@/components/events/AttendanceTab';
import type { EventDTO } from '../../shared/events';

const mutate = vi.fn();
vi.mock('@/lib/api', () => ({
  ApiError: class extends Error {},
  useMarkAttendance: () => ({ mutate, isPending: false }),
  useRoster: () => ({
    isLoading: false,
    data: {
      version: 3,
      shifts: [
        // Ended (2026-01) and not ended (2099) relative to the real clock.
        { shiftId: 1, label: 'Day 1', startAt: '2026-01-10T08:00', endAt: '2026-01-10T12:00', requiredVolunteers: 2, assignments: [
          { id: 11, memberId: 1, name: 'Ana', status: 'assigned', source: 'manual', conflictOverride: false },
          { id: 12, memberId: 2, name: 'Ben', status: 'no_show', source: 'manual', conflictOverride: false },
        ] },
        { shiftId: 2, label: 'Day 2', startAt: '2099-01-11T08:00', endAt: '2099-01-11T12:00', requiredVolunteers: 1, assignments: [
          { id: 21, memberId: 3, name: 'Cy', status: 'assigned', source: 'ai', conflictOverride: false },
        ] },
      ],
    },
  }),
}));

afterEach(cleanup);
const event = { id: 7, status: 'published' } as EventDTO;

describe('AttendanceTab', () => {
  it('only_ended_shifts_are_editable_and_save_sends_changes', () => {
    render(<AttendanceTab event={event} />);
    expect(screen.getByRole('group', { name: 'Attendance for Ana' })).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Attendance for Cy' })).toBeNull();
    expect(screen.getByText('Opens when the shift ends')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /mark all attended/i }));
    expect(screen.getByText('2 unsaved changes')).toBeTruthy();
    fireEvent.click(within(screen.getByRole('group', { name: 'Attendance for Ana' })).getByRole('radio', { name: 'Excused' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save attendance' }));
    expect(mutate.mock.calls[0][0]).toEqual({
      entries: [
        { assignmentId: 11, status: 'excused' },
        { assignmentId: 12, status: 'attended' },
      ],
    });
  });

  it('draft_events_have_no_attendance', () => {
    render(<AttendanceTab event={{ ...event, status: 'draft' }} />);
    expect(screen.getByText('Publish the event to take attendance.')).toBeTruthy();
  });
});
