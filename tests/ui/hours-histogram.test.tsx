import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HoursHistogram, hourBins } from '@/components/reports/HoursHistogram';

afterEach(cleanup);

describe('hourBins', () => {
  it('zero_bin_then_nice_width_bins', () => {
    expect(hourBins([0, 0, 3, 9.5])).toEqual([
      { label: '0 h', count: 2 },
      { label: '0–2 h', count: 0 },
      { label: '2–4 h', count: 1 },
      { label: '4–6 h', count: 0 },
      { label: '6–8 h', count: 0 },
      { label: '8–10 h', count: 1 },
    ]);
    expect(hourBins([])).toEqual([{ label: '0 h', count: 0 }]);
    expect(hourBins([4, 8]).at(-1)).toEqual({ label: '7–8 h', count: 1 }); // upper bound inclusive
  });
});

describe('HoursHistogram', () => {
  it('bars_are_labelled_and_table_view_lists_bins', () => {
    render(<HoursHistogram hours={[0, 3]} />);
    expect(screen.getByLabelText('0 h: 1 member')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'table' }));
    expect(screen.getByRole('cell', { name: '2–3 h' })).toBeTruthy();
  });
});
