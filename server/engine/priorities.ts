// Priority comparators (TRD §8.4 step 4). Negative = a sorts first.
import type { Priority } from '../../shared/constraints';
import type { CandidateFacts } from './types';

const reliability = (f: CandidateFacts) => (f.attended + 1) / (f.attended + f.noShow + 2);
const first = (aHas: boolean, bHas: boolean) => Number(bHas) - Number(aHas);

/** Height order with members of unknown height always last. */
function byHeight(a: CandidateFacts, b: CandidateFacts, dir: 1 | -1): number {
  if (a.heightCm === null || b.heightCm === null) return first(a.heightCm !== null, b.heightCm !== null);
  return dir * (a.heightCm - b.heightCm);
}

export function comparePriority(p: Priority, a: CandidateFacts, b: CandidateFacts): number {
  switch (p) {
    case 'least_assigned_first':
      return a.termHours - b.termHours;
    case 'reliable_first':
      return reliability(b) - reliability(a);
    case 'new_first':
      return first(a.isNew, b.isNew);
    case 'returning_first':
      return first(!a.isNew, !b.isNew);
    case 'tallest_first':
      return byHeight(a, b, -1);
    case 'shortest_first':
      return byHeight(a, b, 1);
    case 'male_first':
      return first(a.gender === 'M', b.gender === 'M');
    case 'female_first':
      return first(a.gender === 'F', b.gender === 'F');
  }
}
