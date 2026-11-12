import { Hono } from 'hono';
import { FairnessQuery } from '../../shared/reports';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser } from '../middleware/auth';
import { aiHealth, dashboard } from '../services/dashboard';
import { fairnessCsv, fairnessReport } from '../services/fairness';
import { validate } from '../validate';

// FR-29 term fairness report and its CSV export; the adviser dashboard and AI health (App Flow §2, §10).
export const reports = new Hono<AppEnv>()
  .get('/dashboard', ...requireAdviser, async (c) => c.json(await dashboard(c.env.DB)))
  .get('/ai-health', ...requireAdviser, async (c) => c.json(await aiHealth(c.env.DB)))
  .get('/fairness', ...requireAdviser, validate('query', FairnessQuery), async (c) => {
    const r = await fairnessReport(c.env.DB, c.req.valid('query').termId);
    return r ? c.json(r) : apiError(c, 404, 'NOT_FOUND', 'Term not found');
  })
  .get('/fairness.csv', ...requireAdviser, validate('query', FairnessQuery), async (c) => {
    const r = await fairnessReport(c.env.DB, c.req.valid('query').termId);
    if (!r) return apiError(c, 404, 'NOT_FOUND', 'Term not found');
    const file = `fairness-${r.term.name.replace(/[^\w-]+/g, '-')}.csv`;
    return c.body(fairnessCsv(r), 200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${file}"` });
  });
