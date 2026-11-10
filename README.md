# UMAL Management v2

Org management system with AssignAI (agentic volunteer assignment) for the University of Mindanao Ambassadors League.

- Frontend: Next.js static export (`src/`)
- API: Hono on Cloudflare Pages Functions (`functions/api/[[route]].ts`), D1 via Drizzle, Better Auth (Google)
- Specs and plan: [`docs/`](docs/)

v1 (Laravel) is preserved at tag `v1-laravel`.

## Commands

- `pnpm dev` — Next dev on :3000 + `wrangler pages dev` on :8788
- `pnpm vitest run` — unit and API tests
- `pnpm evals` — LLM eval suite (manual; uses real API keys)
