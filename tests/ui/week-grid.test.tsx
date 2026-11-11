import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeekGrid } from '@/components/schedule/WeekGrid';

describe('WeekGrid', () => {
  it('grid_renders_entry_at_correct_row', () => {
    render(<WeekGrid entries={[{ dayOfWeek: 2, startTime: '07:30', endTime: '09:00', label: 'CS 311' }]} />);
    const block = screen.getByText('CS 311').closest('[data-slot="class-block"]') as HTMLElement;
    // 30-min rows from 07:00: 07:30–09:00 starts on row 2 and spans rows 2–4 (+1 for the header row).
    expect(block.style.gridRow).toBe('3 / span 3');
    // Tuesday is the 2nd day column (+1 for the time gutter).
    expect(block.style.gridColumn).toBe('3');
  });
});
