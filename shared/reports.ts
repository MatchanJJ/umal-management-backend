import { z } from 'zod';
import type { TermDTO } from './api';

export const FairnessQuery = z.object({ termId: z.coerce.number().int().positive() });

export type FairnessMember = { memberId: number; name: string; college: string | null; hours: number; shifts: number; attended: number; noShow: number; fromAi: number };

/** TRD §9. Rates are null when their denominator is 0. */
export type FairnessReport = {
  term: TermDTO;
  kpis: {
    members: number;
    totalHours: number;
    avgHours: number;
    medianHours: number;
    maxHours: number;
    gini: number;
    top10Share: number;
    neverAssigned: number;
    noShowRate: number | null;
    aiShare: number | null;
    overrideRate: number | null;
  };
  members: FairnessMember[];
};
