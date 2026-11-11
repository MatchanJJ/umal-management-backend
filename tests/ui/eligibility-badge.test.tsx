import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { EligibilityBadge } from '@/components/events/EligibilityBadge';

describe('EligibilityBadge (Design Brief §6: icon AND text, never colour alone)', () => {
  it.each([
    [{ hard: [], soft: [] }, 'Eligible'],
    [{ hard: [], soft: ['CLASS_CONFLICT'] }, 'Class conflict'],
    [{ hard: ['UNAVAILABLE'], soft: [] }, 'Unavailable'],
    [{ hard: ['DOUBLE_BOOKED'], soft: [] }, 'Double-booked'],
    [{ hard: ['ALREADY_ON_SHIFT'], soft: [] }, 'Already added'],
    [{ hard: ['SCHEDULE_MISSING'], soft: [] }, 'Schedule missing'],
    [{ hard: ['PINNED_EXCLUDE'], soft: [] }, 'Excluded'],
  ] as const)('badge_shows_icon_and_text_for_each_reason: %j → %s', (eligibility, text) => {
    const { container } = render(<EligibilityBadge eligibility={{ hard: [...eligibility.hard], soft: [...eligibility.soft] }} />);
    expect(container.textContent).toContain(text);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('shows_the_first_hard_reason_and_counts_the_rest', () => {
    const { container } = render(<EligibilityBadge eligibility={{ hard: ['DOUBLE_BOOKED', 'UNAVAILABLE'], soft: ['CLASS_CONFLICT'] }} />);
    expect(container.textContent).toBe('Double-booked +2');
  });
});
