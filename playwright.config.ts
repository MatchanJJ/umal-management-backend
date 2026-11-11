import { defineConfig, devices } from '@playwright/test';

// Local e2e: wrangler (API + local D1, ENV=local from .dev.vars) on :8788 and next dev on :3100 proxying /api.
// Sign-in uses the ENV-gated POST /api/test/login, so these never run against preview/production.
export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    { command: 'pnpm exec wrangler pages dev --port 8788', url: 'http://localhost:8788/api/health', reuseExistingServer: true, timeout: 120_000 },
    { command: 'pnpm exec next dev --port 3100', url: 'http://localhost:3100', reuseExistingServer: true, timeout: 120_000 },
  ],
});
