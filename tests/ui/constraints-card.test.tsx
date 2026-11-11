import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ConstraintsCard, changedFields } from '@/components/assignai/ConstraintsCard';
import { ShiftScopeBar } from '@/components/assignai/ShiftScopeBar';
import { Constraints, defaultConstraints, emptyGroup } from '../../shared/constraints';

afterEach(cleanup);

const colleges = [
  { code: 'CCE', name: 'College of Computing Education' },
  { code: 'CAE', name: 'College of Accounting Education' },
];
const withGroup = (g: Partial<Constraints['groups'][number]> = {}): Constraints => ({ ...defaultConstraints(), groups: [{ ...emptyGroup(), count: 2, ...g }] });

describe('ConstraintsCard', () => {
  it('card_edit_emits_valid_constraints', () => {
    let emitted: unknown = null;
    render(<ConstraintsCard value={withGroup()} colleges={colleges} onChange={(c) => (emitted = c)} />);
    fireEvent.change(screen.getByLabelText('Group 1 gender'), { target: { value: 'F' } });
    const parsed = Constraints.safeParse(emitted);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.groups[0]).toMatchObject({ count: 2, gender: 'F' });
  });

  it('count_cleared_means_fill_remaining_and_stays_valid', () => {
    let emitted: Constraints | null = null;
    render(<ConstraintsCard value={withGroup()} colleges={colleges} onChange={(c) => (emitted = c)} />);
    fireEvent.change(screen.getByLabelText('Group 1 count'), { target: { value: '' } });
    expect(Constraints.safeParse(emitted).success).toBe(true);
    expect(emitted!.groups[0].count).toBeNull();
  });

  it('changed_fields_highlighted_after_turn', () => {
    const before = withGroup();
    const after: Constraints = { ...withGroup({ gender: 'F', colleges: ['CCE'] }), allowClassConflicts: true };
    const changed = changedFields(before, after);
    expect([...changed].sort()).toEqual(['allowClassConflicts', 'groups.0.colleges', 'groups.0.gender']);
    render(<ConstraintsCard value={after} colleges={colleges} onChange={() => {}} changed={changed} />);
    expect(screen.getByLabelText('Group 1 gender').closest('[data-changed]')?.getAttribute('data-changed')).toBe('true');
    expect(screen.getByLabelText('Group 1 count').closest('[data-changed]')?.getAttribute('data-changed')).toBe('false');
  });

  it('adding_a_group_emits_two_groups', () => {
    let emitted: Constraints | null = null;
    render(<ConstraintsCard value={withGroup()} colleges={colleges} onChange={(c) => (emitted = c)} />);
    fireEvent.click(screen.getByRole('button', { name: /add group/i }));
    expect(emitted!.groups).toHaveLength(2);
    expect(Constraints.safeParse(emitted).success).toBe(true);
  });
});

describe('ShiftScopeBar', () => {
  const shift = (id: number) => ({ id, label: `Day ${id}`, startAt: '2027-03-04T08:00', endAt: '2027-03-04T12:00', requiredVolunteers: 3, activeCount: 0 });

  it('scope_bar_hidden_for_single_shift_event', () => {
    const { container } = render(<ShiftScopeBar shifts={[shift(1)]} scope={[1]} onScope={() => {}} teamMode="per_shift" onTeamMode={() => {}} />);
    expect(container.innerHTML).toBe('');
  });

  it('team_mode_toggle_only_with_more_than_one_shift_in_scope', () => {
    const { rerender } = render(<ShiftScopeBar shifts={[shift(1), shift(2)]} scope={[1]} onScope={() => {}} teamMode="per_shift" onTeamMode={() => {}} />);
    expect(screen.queryByRole('radio', { name: /same team/i })).toBeNull();
    rerender(<ShiftScopeBar shifts={[shift(1), shift(2)]} scope={[1, 2]} onScope={() => {}} teamMode="same_team" onTeamMode={() => {}} />);
    expect(screen.getByRole('radio', { name: /same team/i }).getAttribute('aria-checked')).toBe('true');
  });
});
