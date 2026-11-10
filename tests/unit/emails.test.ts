import { describe, expect, it } from 'vitest';
import { normalizeEmails, splitEmailInput } from '../../shared/emails';

describe('splitEmailInput', () => {
  it('splits lines, commas and semicolons', () => {
    expect(splitEmailInput('a@x.com, b@x.com\nc@x.com; d@x.com\n\n')).toEqual(['a@x.com', 'b@x.com', 'c@x.com', 'd@x.com']);
  });
  it('takes only the email column of a CSV with a header', () => {
    expect(splitEmailInput('name,email,college\nAna,ana@x.com,CCE\n"Ben","ben@x.com",CAE')).toEqual(['ana@x.com', 'ben@x.com']);
  });
  it('drops a lone "email" header line', () => {
    expect(splitEmailInput('email\na@x.com')).toEqual(['a@x.com']);
  });
});

describe('normalizeEmails', () => {
  it('dedupes case-insensitively and reports invalid entries once', () => {
    expect(normalizeEmails(['A@x.com', 'a@x.com ', 'bad', 'bad', ''])).toEqual({ valid: ['a@x.com'], invalid: ['bad'] });
  });
});
