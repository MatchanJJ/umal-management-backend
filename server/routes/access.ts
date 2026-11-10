import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';

// Stub with its final guard (Task 1.3). Task 1.4 implements the access queue.
export const accessRequests = new Hono<AppEnv>().get('/', ...requireAdviser, (c) => c.json({ stub: true }));
