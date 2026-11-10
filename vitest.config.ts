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
              miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
            }),
          ],
          test: { name: 'api', include: ['tests/api/**/*.test.ts'], setupFiles: ['./tests/api/apply-migrations.ts'] },
        },
      ],
    },
  };
});
