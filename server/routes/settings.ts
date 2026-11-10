import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';

// Stub with its final guard (Task 1.3). Task 2.1 / 6.3 implement settings.
export const settings = new Hono<AppEnv>().put('/', ...requireAdviser, (c) => c.json({ stub: true }));
