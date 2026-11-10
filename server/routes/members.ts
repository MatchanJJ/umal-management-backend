import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { requireAdviser } from '../middleware/auth';

// Stub with its final guard (Task 1.3). Task 1.4 / 6.3 implement member management.
export const members = new Hono<AppEnv>().patch('/:id', ...requireAdviser, (c) => c.json({ stub: true }));
