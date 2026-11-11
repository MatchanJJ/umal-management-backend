import { execSync } from 'node:child_process';

/** Bring the local D1 (wrangler state in .wrangler/) up to the latest migrations before the servers start. */
export default function globalSetup() {
  execSync('pnpm exec wrangler d1 migrations apply umal-preview --local', { stdio: 'inherit', env: { ...process.env, CI: '1' } });
}
