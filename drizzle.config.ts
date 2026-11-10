import { defineConfig } from 'drizzle-kit';

// SQL only: migrations are applied with `wrangler d1 migrations apply`.
export default defineConfig({
  dialect: 'sqlite',
  schema: './server/db/schema.ts',
  out: './migrations',
});
