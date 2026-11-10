import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';

// Stub with its final guard (Task 1.3). Task 4.2 implements the events API.
export const events = new Hono<AppEnv>().post('/', ...requireAdviser, (c) => c.json({ stub: true }, 201));
