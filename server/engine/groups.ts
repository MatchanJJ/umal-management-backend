import type { GroupSpec } from '../../shared/constraints';
import type { CandidateFacts } from './types';

/** Group filters; a null attribute never satisfies a filter that constrains it (review focus 5). */
export function matchesGroup(f: CandidateFacts, g: GroupSpec): boolean {
  return (
    (g.colleges.length === 0 || (f.collegeCode !== null && g.colleges.includes(f.collegeCode))) &&
    (g.gender === null || f.gender === g.gender) &&
    (g.tenure === null || f.isNew === (g.tenure === 'new')) &&
    (g.yearLevels.length === 0 || (f.yearLevel !== null && g.yearLevels.includes(f.yearLevel))) &&
    (g.heightMinCm === null || (f.heightCm !== null && f.heightCm >= g.heightMinCm)) &&
    (g.heightMaxCm === null || (f.heightCm !== null && f.heightCm <= g.heightMaxCm))
  );
}
