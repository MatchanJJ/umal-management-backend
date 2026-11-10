import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
          }),
        ],
        test: { name: 'api', include: ['tests/api/**/*.test.ts'] },
      },
    ],
  },
});
