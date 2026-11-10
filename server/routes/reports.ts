import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';

// Stub with its final guard (Task 1.3). Task 6.2 implements the fairness report.
export const reports = new Hono<AppEnv>().get('/fairness', ...requireAdviser, (c) => c.json({ stub: true }));
