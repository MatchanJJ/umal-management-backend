// Vocabulary the LLM may use (TRD §7.1), built from the DB catalog on each turn. No member data.
import { GENDERS, PRIORITIES } from '../../shared/enums';

export type Vocabulary = {
  colleges: { code: string; name: string }[];
  yearLevels: number[];
  genders: readonly string[];
  tenure: readonly string[];
  priorities: readonly string[];
};

export function buildVocabulary(colleges: { code: string; name: string }[]): Vocabulary {
  return {
    colleges: colleges.map(({ code, name }) => ({ code, name })),
    yearLevels: [1, 2, 3, 4, 5],
    genders: GENDERS,
    tenure: ['new', 'returning'],
    priorities: PRIORITIES,
  };
}
