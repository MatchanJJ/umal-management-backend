import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations');
  return {
    test: {
      projects: [
        {
          test: { name: 'unit', include: ['tests/design/**/*.test.ts', 'tests/engine/**/*.test.ts'], environment: 'node' },
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
