import { describe, expect, it } from 'vitest';
import { studentNumberFromEmail } from '../../shared/profile';

describe('studentNumberFromEmail', () => {
  it.each([
    ['m.palma.546616@umindanao.edu.ph', '546616'],
    ['M.Palma.546616@UMINDANAO.EDU.PH', '546616'],
    ['j.dela.cruz.123456@umindanao.edu.ph', '123456'],
    ['boot.adviser@gmail.com', null],
    ['prof.santos@umindanao.edu.ph', null],
    ['m.palma.54661@umindanao.edu.ph', null],
    ['m.palma.5466160@umindanao.edu.ph', null],
    ['m.palma.546616@gmail.com', null],
  ])('%s → %s', (email, expected) => {
    expect(studentNumberFromEmail(email)).toBe(expected);
  });
});
