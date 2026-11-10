# UMAL Management v2

Org management system with AssignAI (agentic volunteer assignment) for the University of Mindanao Ambassadors League.

## Read first
- `docs/06-implementation-plan.md` is the task list. Execute it task by task, TDD, one commit per task.
- `docs/02-technical-requirements.md` is the primary spec for implementers.
- Other specs: `docs/01-product-requirements.md`, `docs/03-app-flow.md`, `docs/04-design-brief.md`, `docs/05-backend-schema.md`.
- When the plan and a spec disagree, stop and ask. Don't guess.

## Hard rules
- Next.js static export only (`output: 'export'`). No `app/api`, server actions, `middleware.ts` or `[id]` route segments. Use `?id=` query params.
- API is Hono on Cloudflare Pages Functions (`functions/api/[[route]].ts`), D1 via Drizzle, Better Auth with Google.
- Two roles only: `member` and `adviser`. Only members are assignable.
- Every route validates input with Zod from `shared/` and checks roles server-side.
- Events have ≥ 1 shift; volunteers are assigned to shifts. Shifts are local `YYYY-MM-DDTHH:MM` intervals (may cross midnight, ≤ 24 h; event span ≤ 14 days). No timezone conversion; everything is Asia/Manila.
- Workload = hours served (sum of shift durations), not assignment count.
- `server/engine/` is pure (no I/O imports) and keeps 100% branch coverage.
- No member PII in any LLM request. A chat turn never writes to the database; only `POST /api/events/:id/assignments` writes assignments.
- Roster/attendance/event writes use the `write_guards` + `events.version` batch pattern (TRD §8.5).
- Free-plan budgets: ≤ 12 D1 queries per AI turn, 10 ms CPU per request.
- Design tokens exactly as Design Brief §3 (primary `#A50511`, gold `#FFB600`, Poppins). Never gold text on white.
- Never commit DB dumps, `.dev.vars` or secrets.

## Commands (once scaffolded)
- `pnpm dev`: Next dev on :3000 + `wrangler pages dev` on :8788
- `pnpm vitest run`: unit and API tests
- `pnpm evals`: LLM eval suite (manual; uses real API keys)

## GIT
Work in small conventional commits with no coauthor line use this as a commit message convention https://gist.github.com/qoomon/5dfcdf8eec66a051ecd85625518cfd13 and also branching https://conventionalbranch.org/. Ask before using my
accounts or secrets.