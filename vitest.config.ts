import { fileURLToPath } from 'node:url';
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    test: {
      // CLAUDE.md: server/engine/ keeps 100% branch coverage (`pnpm test:engine`).
      coverage: { provider: 'v8' as const, include: ['server/engine/**'], thresholds: { 100: true } },
      projects: [
        {
          test: { name: 'unit', include: ['tests/design/**/*.test.ts', 'tests/engine/**/*.test.ts', 'tests/unit/**/*.test.ts', 'tests/ai/**/*.test.ts'], environment: 'node' },
        },
        {
          test: { name: 'ui', include: ['tests/ui/**/*.test.tsx'], environment: 'jsdom' },
          resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
        },
        {
          plugins: [
            cloudflareTest({
              main: './tests/api/worker.ts',
              wrangler: { configPath: './wrangler.toml' },
              miniflare: {
                bindings: {
                  TEST_MIGRATIONS: migrations,
                  ENV: 'test',
                  BETTER_AUTH_SECRET: 'test-secret-test-secret-test-secret-32',
                  BETTER_AUTH_URL: 'http://x',
                  GOOGLE_CLIENT_ID: 'test-client',
                  GOOGLE_CLIENT_SECRET: 'test-secret',
                  BOOTSTRAP_ADVISER_EMAIL: 'boot.adviser@gmail.com',
                },
              },
            }),
          ],
          test: { name: 'api', include: ['tests/api/**/*.test.ts'], setupFiles: ['./tests/api/apply-migrations.ts'] },
        },
      ],
    },
  };
});
