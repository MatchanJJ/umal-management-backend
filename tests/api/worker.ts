// Test entry: exposes the Hono app as a module worker so `SELF.fetch` reaches it.
import { app } from '../../server/app';

const worker = { fetch: app.fetch };
export default worker;
