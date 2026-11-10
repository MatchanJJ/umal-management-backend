# UMAL Management v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild UMAL Management as a ₱0/month production app. It runs on Cloudflare Pages as a static Next.js export with a Hono API on Pages Functions, D1 and Better Auth. AssignAI parses constraints with an LLM and a deterministic engine applies hard rules and ranks fairly, with human approval before any write.

**Architecture:** A static export of the Next.js frontend in `src/` calls `/api/*`, which a single Hono app serves from `functions/api/[[route]].ts`. Business logic lives in `server/`; `server/engine/` is pure and fully unit-tested. Shared Zod schemas live in `shared/`. The LLM is used only in `server/ai/` to produce a validated `Constraints` object.

**Tech Stack:** TypeScript, pnpm, Next.js (App Router, `output:'export'`), Tailwind v4, shadcn/ui, TanStack Query, React Hook Form, Hono, Drizzle ORM + Cloudflare D1, Better Auth (Google), Vercel AI SDK (`@ai-sdk/google`, `@ai-sdk/groq`), Vitest + `@cloudflare/vitest-pool-workers`, Playwright, GitHub Actions + Wrangler.

**Spec:** `docs/01-product-requirements.md`, `docs/02-technical-requirements.md` (primary for implementers), `docs/03-app-flow.md`, `docs/04-design-brief.md`, `docs/05-backend-schema.md`.

## Global Constraints

- Static export only: no `app/api`, server actions, `middleware.ts` or dynamic `[id]` route segments. Dynamic pages use `?id=` (TRD §4).
- Every `/api` route validates input with Zod from `shared/` and enforces roles server-side (TRD §5 matrix).
- Event bounds are local `YYYY-MM-DDTHH:MM` (`start_at` < `end_at`, span ≤ 14 days, may cross midnight). Schedule times are `HH:MM` 24 h, with `'24:00'` allowed only as an end time. Weekdays are ISO 1–7. No timezone conversion anywhere.
- Only two roles exist: `member` and `adviser`. Only members are assignable.
- Every event has ≥ 1 shift (≤ 24 h each). Volunteers are assigned to **shifts**; eligibility is evaluated per shift. Workload = **hours served** (sum of shift durations; excused and cancelled excluded).
- An AI turn may issue at most 12 D1 queries and at most 2 LLM calls. All candidate reads go through one `db.batch`.
- No member PII (names, emails, student numbers, member ids) in any LLM request.
- No DB writes as a side effect of a chat turn. Assignments are written only by `POST /api/events/:id/assignments`.
- Roster, attendance and event mutations use the `write_guards` + `events.version` batch pattern (TRD §8.5).
- Error body: `{ error: { code, message, details? } }`. Codes used in tests: `UNAUTHENTICATED`, `ACCESS_PENDING`, `ACCESS_REJECTED`, `ONBOARDING_REQUIRED`, `FORBIDDEN`, `VALIDATION`, `INELIGIBLE`, `OVER_CAPACITY`, `VERSION_CONFLICT`, `NO_TERM_FOR_DATE`, `AI_RATE_LIMITED`, `NOT_FOUND`, `DOMAIN_NOT_ALLOWED`, `LAST_ADVISER`, `SHIFT_HAS_ASSIGNMENTS`.
- Design tokens are exactly those in Design Brief §3. Primary `#A50511`, gold `#FFB600`, font Poppins, radius `0.5rem`.
- Settings keys and defaults are exactly as in Backend Schema §6.

## Review Focus

1. **Boundary times and midnight.** Class 08:00–10:00 and event 10:00–12:00 is *not* a conflict; event 09:30–10:30 against that class *is*. An event Fri 22:00 → Sat 02:00 must be checked against **Saturday's** classes and date blocks too, and a 3-day event against every day it touches. → Task 3.2 and Task 3.3 tests.
2. **Event outside the active term.** Eligibility must use the event's own term's schedules. An event on a date covered by no term → 422 `NO_TERM_FOR_DATE`. → Task 4.1 and Task 4.2 tests.
3. **Two advisers approving at once.** The second approve gets 409 `VERSION_CONFLICT` and no partial writes. → Task 4.3 test.
4. **Confirmations and Tagalog modifiers.** "sige, i-assign mo na" must yield `confirm_request` and no write. "lalaki lang" must patch gender without resetting count. → Task 5.2 tests + eval cases (Task 5.5).
5. **Missing data.** A member with null height under a height filter, null college under a college filter, or no schedule must be filtered out or flagged, never crash. → Task 3.3 and Task 3.5 tests.
6. **Same person, several shifts.** One member may take Day 1 and Day 2 of the same event, but never two overlapping shifts. This holds within a single approve request too. → Task 3.3, Task 3.7 and Task 4.3 tests.

---

## Phase 0 — Foundation

### Task 0.1: Repository reset

**Files:**
- Create: `docs/` (these six documents), `.gitignore`, `README.md`

**Interfaces:**
- Produces: repo `MatchanJJ/umal-management` with tag `v1-laravel`; `main` contains only docs + scaffold.

- [ ] **Step 1:** On the current `main`, run `git tag v1-laravel && git push origin v1-laravel`.
- [ ] **Step 2:** Rename the repo in GitHub Settings → `umal-management`. Check that `git remote -v` still works (GitHub redirects the old URL).
- [ ] **Step 3:** Remove the dump from history: `git filter-repo --path database/umalDBbu --invert-paths`, then force-push all branches and tags. (Only Mark should run this; it rewrites history.)
- [ ] **Step 4:** Create branch `v2` from `main`, run `git rm -r` on everything except `docs/` and `.gitattributes`, and add a `.gitignore` covering `node_modules`, `.next`, `out`, `.wrangler`, `.dev.vars`, `*.sql.gz`, `*.dump`, `*bu`.
- [ ] **Step 5:** Commit with `chore: reset for v2 rewrite (v1 preserved at tag v1-laravel)`, open a PR `v2 → main` and merge it. From then on `main` is v2, and v1 is only reachable via the tag (optionally also publish a GitHub Release "v1 (Laravel + T5)" from the tag).

### Task 0.2: Frontend scaffold with UM tokens

**Files:**
- Create: `package.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `components.json`, `src/components/ui/*` (shadcn: button, card, badge, input, label, select, dialog, sheet, table, tabs, sonner, skeleton, switch, textarea, dropdown-menu, form)
- Test: `tests/design/contrast.test.ts`

**Interfaces:**
- Produces: CSS variables from Design Brief §3 in `globals.css`; `poppins` font variable `--font-sans`.

- [ ] **Step 1: Write the failing test** `contrast.test.ts`. It parses `globals.css` `:root` and asserts:
  - `ratio(--primary, #FFFFFF) >= 7.9`
  - `ratio(--secondary-foreground, --secondary) >= 4.5`
  - `ratio(--muted-foreground, --muted) >= 4.5`
  - `ratio(#FFFFFF, --destructive) >= 4.5`
- [ ] **Step 2:** Run `pnpm vitest run tests/design`. Expected: FAIL (file missing).
- [ ] **Step 3:** Scaffold with `create-next-app` (TS, App Router, Tailwind, `src/`), run `shadcn init`, and paste the Design Brief §3 tokens. In `next.config.ts` set:
  - `output:'export'`
  - `images.unoptimized:true`
  - `trailingSlash:true`
  - a dev-only `rewrites` proxying `/api/:path*` → `http://localhost:8788/api/:path*`

  Load Poppins 400–800 via `next/font/google`.
- [ ] **Step 4:** Run `pnpm vitest run tests/design && pnpm next build`. Expected: PASS, and `out/index.html` exists.
- [ ] **Step 5:** Commit with `feat: next static-export scaffold with UM design tokens`.

### Task 0.3: Hono API on Pages Functions + D1 binding

**Files:**
- Create: `functions/api/[[route]].ts`, `server/app.ts`, `server/env.ts`, `server/db/client.ts`, `wrangler.toml`, `vitest.config.ts`, `tests/api/health.test.ts`, `.dev.vars.example`

**Interfaces:**
- Produces:
  - `type Env = { DB: D1Database; BETTER_AUTH_SECRET: string; BETTER_AUTH_URL: string; GOOGLE_CLIENT_ID: string; GOOGLE_CLIENT_SECRET: string; GEMINI_API_KEY?: string; GEMINI_MODEL?: string; GROQ_API_KEY?: string; GROQ_MODEL?: string; AI_GATEWAY_URL?: string; BOOTSTRAP_ADVISER_EMAIL: string; ENV: 'local'|'test'|'preview'|'production' }`
  - `app: Hono<{ Bindings: Env; Variables: { member?: MemberCtx } }>`
  - `export type AppType = typeof routes`
  - `getDb(env: Env): DrizzleD1Database<typeof schema>`
  - `apiError(c, status, code, message, details?)`

- [ ] **Step 1: Write the failing test** `health.test.ts` using `SELF.fetch('http://x/api/health')`. It expects status 200 and body `{ ok: true, db: true }`.
- [ ] **Step 2:** Run `pnpm vitest run tests/api/health.test.ts`. Expected: FAIL (404).
- [ ] **Step 3:** Implement:
  - `GET /api/health` runs `SELECT 1` on `DB`
  - `functions/api/[[route]].ts` exports `onRequest = handle(app)` from `hono/cloudflare-pages`
  - `wrangler.toml`: `pages_build_output_dir="out"`, `compatibility_flags=["nodejs_compat"]`, `[[d1_databases]] binding="DB" database_name="umal-preview"`, and env overrides for production `umal-prod`
  - global `onError` returning the error shape, with `ZodError` → 400 `VALIDATION`
- [ ] **Step 4:** Run the test. Expected: PASS. Then run `pnpm dev` and confirm that `curl :3000/api/health` returns ok.
- [ ] **Step 5:** Commit with `feat: hono api on pages functions with d1 health check`.

### Task 0.4: CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/backup.yml`

- [ ] **Step 1:** In `ci.yml`, on PR and push run: pnpm install, `pnpm lint`, `pnpm typecheck`, `pnpm vitest run`, `pnpm next build`. Then on push only: `wrangler d1 migrations apply <db> --remote`, then `wrangler pages deploy out --project-name umal-management --branch ${{ github.ref_name }}`. The database is `umal-prod` on `main` and `umal-preview` otherwise.
- [ ] **Step 2:** In `backup.yml`, run weekly on cron `0 19 * * 0` (Mon 03:00 Manila): `wrangler d1 export umal-prod --output backup.sql`, gzip + `age`-encrypt with `BACKUP_PUBKEY`, upload as an artifact with 30-day retention.
- [ ] **Step 3:** Push a branch and confirm a preview URL serves `/` and `/api/health`.
- [ ] **Step 4:** Commit with `ci: test, build, migrate, deploy; weekly d1 backup`.

---

## Phase 1 — Data model and access

### Task 1.1: Schema, migrations, seed

**Files:**
- Create: `server/db/schema.ts`, `server/db/auth-schema.ts` (generated), `drizzle.config.ts`, `migrations/0000_init.sql` (generated), `migrations/0001_seed.sql`, `shared/enums.ts`
- Test: `tests/api/schema.test.ts`

**Interfaces:**
- Produces: Drizzle tables named exactly as in Backend Schema §4 (camelCase TS names, snake_case columns), plus the enums in `shared/enums.ts`: `ROLES`, `EVENT_STATUS`, `ASSIGNMENT_STATUS`, `REASONS`, `PRIORITIES`.

- [ ] **Step 1: Write the failing tests:**
  - `seed_has_14_colleges`: `SELECT COUNT(*) FROM colleges` = 14, and the codes include `CAFAE` and `CLE`
  - `one_active_assignment_per_member_shift`: inserting two `assigned` rows for the same (shift, member) throws; inserting `cancelled` + `assigned` succeeds; the same member on two different shifts of one event succeeds
  - `write_guard_rejects_zero`: `INSERT INTO write_guards(ok) VALUES (0)` throws
  - `unavailability_kind_check`: weekly with `date` set throws
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:**
  - Write `schema.ts` from Backend Schema §4, including partial indexes via `uniqueIndex().on(...).where(sql\`status <> 'cancelled'\`)`.
  - Generate the auth schema with the Better Auth CLI.
  - Run `drizzle-kit generate`.
  - Hand-write `0001_seed.sql` with the 14 colleges (Schema §7) and the settings defaults (Schema §6).
  - Configure vitest-pool-workers to apply `migrations/` before tests.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: d1 schema, migrations and seed`.

### Task 1.2: Better Auth + access gate + `/api/me`

**Files:**
- Create: `server/auth.ts`, `server/services/access.ts`, `server/routes/me.ts`, `shared/api.ts` (MeResponse)
- Test: `tests/api/access.test.ts`

**Interfaces:**
- Consumes: `getDb`, schema.
- Produces:
  - `createAuth(env: Env)`
  - `resolveAccess(db, email: string, env): Promise<{ status: 'approved'|'pending'|'rejected', member?: MemberRow }>`
  - `MeResponse = { user: {id,email,name,image}, accessStatus, onboarded: boolean, member: MemberDTO|null, activeTerm: TermDTO|null, scheduleSubmitted: boolean }`

- [ ] **Step 1: Write the failing tests.** Call `resolveAccess` directly, plus `/api/me` with a session created through Better Auth's test helpers (`auth.api.signInSocial` mocked via the `E2E_AUTH` test provider only when `ENV==='test'`):
  - `unknown_email_creates_pending_request`
  - `bulk_preapproved_email_creates_member_with_role` (role `adviser` → `members.role='adviser'`, `onboarded_at` null)
  - `rejected_email_returns_rejected`
  - `bootstrap_adviser_auto_approved_as_adviser` (allowed even if the domain setting would reject it)
  - `domain_restriction_rejects_other_domain` (setting `auth.allowedEmailDomain='umindanao.edu.ph'`, email `x@gmail.com` → sign-in error code `DOMAIN_NOT_ALLOWED`)
  - `me_without_session_401`
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement:
  - Better Auth with Drizzle adapter (`provider:'sqlite'`), Google provider, `trustedOrigins` from env, `databaseHooks.session.create.before` → domain check, and `databaseHooks.user.create.after` → `resolveAccess`
  - mount at `app.on(['GET','POST'], '/api/auth/*', c => createAuth(c.env).handler(c.req.raw))`
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: google auth with access-request gate and /api/me`.

### Task 1.3: Authorization middleware + matrix

**Files:**
- Create: `server/middleware/auth.ts`
- Test: `tests/api/authz.test.ts`

**Interfaces:**
- Produces: `requireSession`, `requireApproved`, `requireOnboarded`, `requireRole(...roles: Role[])`. These set `c.var.member: { id, role, status, email }`.

- [ ] **Step 1: Write a failing table-driven test** `authz_matrix`. For each row of TRD §5's matrix, it picks a representative endpoint per capability (`GET /api/me/assignments`, `POST /api/events`, `GET /api/access-requests`, `PATCH /api/members/:id {role:'adviser'}`, `PUT /api/settings`, `GET /api/reports/fairness`) and asserts the status for member vs adviser = 403 `FORBIDDEN` vs 200|201. Stub routes return 200 until their tasks land.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the middleware chain and register the stub routes with their final role guards.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: role middleware and authz matrix test`.

### Task 1.4: Access queue (API + UI)

**Files:**
- Create: `server/routes/access.ts`, `src/app/access/page.tsx`, `src/components/access/*`, `src/lib/api.ts` (`hc<AppType>` client + TanStack Query hooks), `src/components/layout/AppGate.tsx`, `src/components/layout/AdviserShell.tsx`, `src/app/login/page.tsx`, `src/app/access/pending/page.tsx`, `src/app/access/rejected/page.tsx`
- Test: `tests/api/access-routes.test.ts`

**Interfaces:**
- Produces:
  - `POST /api/access-requests/bulk { emails: string[], role } → { created: number, alreadyApproved: number, invalid: string[] }`
  - `POST /:id/approve { role }`
  - `POST /:id/reject { note? }`
  - `<AppGate>` implementing App Flow §1

- [ ] **Step 1: Write the failing tests:**
  - `bulk_dedupes_and_reports_invalid` (input `["A@x.com","a@x.com","bad"]` → created 1, invalid `["bad"]`)
  - `member_cannot_approve_403`
  - `approve_writes_audit_row` (`audit_log.action='access.approve'`)
  - `reject_blocks_rerequest_for_7_days` (FR-6)
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the routes and UI per App Flow §2–3 and Design Brief §5–6 (login brand panel in maroon band).
- [ ] **Step 4:** Run the tests, then check manually on the preview URL with two Google accounts.
- [ ] **Step 5:** Commit with `feat: access requests queue and login/pending screens`.

### Task 1.5: Onboarding

**Files:**
- Create: `server/routes/me.ts` (onboarding, profile), `shared/profile.ts`, `src/app/onboarding/page.tsx`, `src/app/me/profile/page.tsx`
- Test: `tests/api/onboarding.test.ts`

**Interfaces:**
- Produces: `OnboardingInput` Zod (FR-5 fields with the Schema §4 checks).

- [ ] **Step 1: Write the failing tests:**
  - `onboarding_sets_onboarded_at`
  - `course_must_belong_to_college` (422 `VALIDATION`)
  - `duplicate_student_number_409`
  - `protected_route_before_onboarding_403_ONBOARDING_REQUIRED`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the routes and the 2-step form (App Flow §3); the course select is filtered by college.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: member onboarding`.

---

## Phase 2 — Terms, catalog, schedules

### Task 2.1: Terms, catalog, settings API + settings pages

**Files:**
- Create: `server/routes/terms.ts`, `server/routes/catalog.ts`, `server/routes/settings.ts`, `server/services/settings.ts`, `src/app/settings/page.tsx` (tabs General / Terms / Colleges & Courses; Scoring and AI tabs added in Task 6.3)
- Test: `tests/api/terms-catalog.test.ts`

**Interfaces:**
- Produces:
  - `getSettings(db): Promise<Settings>` (typed, with defaults from Schema §6)
  - `termForDate(db, date: string): Promise<TermRow|null>`

- [ ] **Step 1: Write the failing tests:**
  - `activate_term_deactivates_previous`
  - `overlapping_terms_rejected` (422)
  - `termForDate_inclusive_bounds` (start and end dates both match)
  - `catalog_get_hides_inactive`
  - `settings_put_validates_weights_range`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: terms, catalog and settings`.

### Task 2.2: Class schedule

**Files:**
- Create: `server/routes/schedule.ts`, `shared/schedule.ts`, `src/app/me/schedule/page.tsx`, `src/components/schedule/WeekGrid.tsx`, `src/components/schedule/ClassList.tsx`
- Test: `tests/api/schedule.test.ts`, `tests/ui/week-grid.test.tsx`

**Interfaces:**
- Produces:
  - `PUT /api/me/schedule { termId, entries: { dayOfWeek: 1..7, startTime: 'HH:MM', endTime: 'HH:MM', label?: string }[] }` → replaces all entries in one batch and sets `submitted_at`
  - `GET` returns `{ submitted: boolean, entries, previousTermAvailable: boolean }`

- [ ] **Step 1: Write the failing tests:**
  - `put_replaces_entries_atomically`
  - `overlapping_entries_same_day_422`
  - `touching_entries_allowed` (08:00–10:00 + 10:00–11:30)
  - `time_format_validated` (`'8:00'` rejected)
  - UI test: `grid_renders_entry_at_correct_row` (entry 07:30–09:00 spans rows 2–4 of the 30-min grid)
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the API and the grid (desktop) / list (mobile) per Design Brief §6, with "Copy from previous term".
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: member class schedule`.

### Task 2.3: Unavailability + member home

**Files:**
- Create: `server/routes/unavailability.ts`, `src/app/me/availability/page.tsx`, `src/app/me/page.tsx`, `src/app/me/history/page.tsx`, `src/components/layout/MemberShell.tsx`
- Modify: `server/routes/me.ts` (add `GET /api/me/assignments` → `{ upcoming, past, termStats: { hours, shifts, attended, noShow } }`, one row per shift)
- Test: `tests/api/unavailability.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `weekly_requires_day_not_date`
  - `date_requires_date_not_day`
  - `whole_day_block_is_0000_2400`
  - `end_time_2400_allowed_only_as_end`
  - `member_cannot_delete_others_block_404`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement, plus the member home cards (upcoming assignments, term stats, schedule banner per FR-10).
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: unavailability blocks and member home`.

---

## Phase 3 — Assignment engine (pure, TDD; no I/O imports allowed in `server/engine/`)

### Task 3.1: Shared constraint schemas

**Files:**
- Create: `shared/constraints.ts`
- Test: `tests/engine/constraints.test.ts`

**Interfaces:**
- Produces (exactly TRD §7.2):
  - `Gender`, `Tenure`, `Priority`, `GroupSpec`, `Constraints`, `InterpreterOutput` (Zod + inferred types)
  - `emptyGroup(): GroupSpec`
  - `defaultConstraints(): Constraints` = `{ groups: [], allowClassConflicts: false, priorities: [], teamMode: 'per_shift' }`
  - `Pins = { include: number[]; exclude: number[] }`

- [ ] **Step 1: Write the failing tests:**
  - `default_is_no_conflicts_and_per_shift`
  - `rejects_count_zero`
  - `rejects_more_than_10_groups`
  - `rejects_unknown_priority`
- [ ] **Step 2:** Run `pnpm vitest run tests/engine/constraints.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: shared constraint schemas`.

### Task 3.2: Time utilities

**Files:**
- Create: `server/engine/time.ts`
- Test: `tests/engine/time.test.ts`

**Interfaces:**
- Produces:
  - `overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean` (works for both `HH:MM` and `YYYY-MM-DDTHH:MM`)
  - `type Segment = { date: string; weekday: 1|2|3|4|5|6|7; start: string; end: string }`
  - `segments(startAt: string, endAt: string): Segment[]` (middle days are `00:00–24:00`)
  - `isoWeekday(date: string): 1|2|3|4|5|6|7`
  - `hoursBetween(startAt: string, endAt: string): number`
  - `daysBetween(from: string, to: string): number`
  - `schoolYearStart(today: string, startMonth: number): number`
  - `fnv1a32(s: string): number`

- [ ] **Step 1: Write the failing tests:**
```ts
expect(overlaps('08:00','10:00','10:00','12:00')).toBe(false)
expect(overlaps('09:30','10:30','10:00','11:00')).toBe(true)
expect(overlaps('08:00','12:00','09:00','10:00')).toBe(true)
expect(isoWeekday('2026-11-10')).toBe(2)          // Tuesday
expect(isoWeekday('2026-11-15')).toBe(7)          // Sunday
expect(daysBetween('2026-10-31','2026-11-10')).toBe(10)
expect(hoursBetween('2026-11-13T22:00','2026-11-14T02:00')).toBe(4)
expect(hoursBetween('2026-11-13T08:00','2026-11-13T17:30')).toBe(9.5)
expect(schoolYearStart('2026-07-31', 8)).toBe(2025)
expect(schoolYearStart('2026-08-01', 8)).toBe(2026)
expect(fnv1a32('1:2')).toBe(fnv1a32('1:2')); expect(fnv1a32('1:2')).not.toBe(fnv1a32('1:3'))
expect(overlaps('2026-11-13T22:00','2026-11-14T02:00','2026-11-14T01:00','2026-11-14T05:00')).toBe(true)
expect(segments('2026-11-12T13:00','2026-11-12T17:00')).toEqual([{ date:'2026-11-12', weekday:4, start:'13:00', end:'17:00' }])
expect(segments('2026-11-13T22:00','2026-11-14T02:00')).toEqual([
  { date:'2026-11-13', weekday:5, start:'22:00', end:'24:00' },
  { date:'2026-11-14', weekday:6, start:'00:00', end:'02:00' }])
expect(segments('2026-11-13T08:00','2026-11-15T17:00').map(s => [s.start, s.end]))
  .toEqual([['08:00','24:00'],['00:00','24:00'],['00:00','17:00']])
expect(segments('2026-11-13T08:00','2026-11-14T00:00')).toHaveLength(1)   // ends exactly at midnight → no empty Saturday segment
```
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement. `isoWeekday` and `daysBetween` parse as UTC midnight (`Date.UTC`) so the host timezone can't shift the day.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(engine): time utilities`.

### Task 3.3: Eligibility

**Files:**
- Create: `server/engine/types.ts`, `server/engine/eligibility.ts`
- Test: `tests/engine/eligibility.test.ts`, `tests/engine/fixtures.ts`

**Interfaces:**
- Produces:
```ts
type Interval = { start: string; end: string }
type CandidateFacts = {
  memberId: number; gender: 'M'|'F'|null; collegeCode: string|null; yearLevel: number|null;
  isNew: boolean; heightCm: number|null;
  scheduleSubmitted: boolean;
  classesByWeekday: Partial<Record<1|2|3|4|5|6|7, Interval[]>>;
  weeklyUnavailable: Partial<Record<1|2|3|4|5|6|7, Interval[]>>;
  dateUnavailable: { date: string; start: string; end: string }[];
  bookings: { shiftId: number; start: string; end: string }[];   // non-cancelled shifts this member holds ('YYYY-MM-DDTHH:MM')
  termHours: number; lastPastAssignmentDate: string|null;   // date part of end_at of latest ENDED shift
  attended: number; noShow: number;
}
type ShiftCtx = { eventId: number; shiftId: number; startAt: string; endAt: string; requiredVolunteers: number;
                  activeCount: number; termStart: string; termEnd: string;
                  today: string; now: string; requireSchedule: boolean }   // now = 'YYYY-MM-DDTHH:MM' Asia/Manila
type Reason = 'ALREADY_ON_SHIFT'|'DOUBLE_BOOKED'|'UNAVAILABLE'|'SCHEDULE_MISSING'|'CLASS_CONFLICT'|'PINNED_EXCLUDE'
type Eligibility = { hard: Reason[]; soft: Reason[] }
function checkEligibility(f: CandidateFacts, shift: ShiftCtx, pins: Pins): Eligibility   // ALREADY_ON_SHIFT if a booking has this shiftId; DOUBLE_BOOKED if another booking overlaps
function isSelectable(e: Eligibility, allowClassConflicts: boolean): boolean   // no hard && (!soft.includes('CLASS_CONFLICT') || allow)
```
- `fixtures.ts` exports `facts(overrides?: Partial<CandidateFacts>): CandidateFacts`, which defaults to a fully eligible member, and `shift(overrides?)` for shift 1 of event 1, `2026-11-12T13:00` → `2026-11-12T17:00` (Thursday), 4 required, in a term `2026-08-10`–`2026-12-18`.

- [ ] **Step 1: Write the failing tests** (one assertion each):
  - `eligible_by_default` → `{hard:[],soft:[]}`
  - `class_overlap_is_soft` (Thu class 14:00–15:00) → soft `['CLASS_CONFLICT']`
  - `class_touching_is_not_conflict` (Thu class 11:00–13:00) → none
  - `cross_midnight_checks_next_day_class` (event Fri 22:00 → Sat 02:00, Sat class 01:00–03:00) → `CLASS_CONFLICT`
  - `multi_day_checks_middle_day` (event Fri 08:00 → Sun 17:00, weekly unavailability Sat 10:00–12:00) → hard `UNAVAILABLE`
  - `class_outside_term_dates_ignored` (event day after `termEnd`, class on that weekday) → none
  - `date_block_on_second_day_is_hard`
  - `unavailable_is_hard`
  - `double_booked_is_hard` (booking on shift 9 `2026-11-12T16:00`–`2026-11-12T20:00`), `back_to_back_booking_ok` (`17:00`–`20:00`)
  - `already_on_shift_is_hard` (booking with `shiftId` 1)
  - `other_shift_same_event_overlapping_is_double_booked`, `other_shift_same_event_next_day_ok`
  - `pinned_exclude_is_hard`
  - `schedule_missing_hard_when_required` / `..._soft_when_not_required`
  - `isSelectable_respects_allowClassConflicts`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement using `overlaps`.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(engine): eligibility rules`.

### Task 3.4: Scoring

**Files:**
- Create: `server/engine/scoring.ts`
- Test: `tests/engine/scoring.test.ts`

**Interfaces:**
- Produces:
```ts
type Weights = { load: number; recency: number; reliability: number }
type ScoreCtx = { avgTermHours: number; loadUnitHours: number; today: string; weights: Weights }
type Score = { total: number; loadGap: number; recency: number; reliability: number }
function scoreCandidate(f: CandidateFacts, ctx: ScoreCtx): Score
function averageHours(all: CandidateFacts[]): number   // 0 for empty
```

- [ ] **Step 1: Write the failing tests:**
```ts
const ctx = { avgTermHours: 8, loadUnitHours: 4, today: '2026-11-10', weights: { load: 3, recency: 1, reliability: 1 } }
expect(scoreCandidate(facts({ termHours: 0, lastPastAssignmentDate: null, attended: 0, noShow: 0 }), ctx))
  .toEqual({ loadGap: 2, recency: 2, reliability: 0.5, total: 3*2 + 2 + 0.5 })        // 8.5
expect(scoreCandidate(facts({ termHours: 14 }), ctx).loadGap).toBe(-1.5)            // 6 h above average
expect(scoreCandidate(facts({ lastPastAssignmentDate: '2026-10-27' }), ctx).recency).toBeCloseTo(14/30)
expect(scoreCandidate(facts({ lastPastAssignmentDate: '2026-06-01' }), ctx).recency).toBe(2)   // capped at 60 days
expect(scoreCandidate(facts({ attended: 3, noShow: 1 }), ctx).reliability).toBeCloseTo(4/6)
expect(averageHours([])).toBe(0)
```
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement per TRD §8.3. Keep full precision internally; the API layer rounds to 2 dp for display.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(engine): fairness scoring`.

### Task 3.5: Allocation

**Files:**
- Create: `server/engine/allocate.ts`, `server/engine/priorities.ts`, `server/engine/index.ts` (re-exports)
- Test: `tests/engine/allocate.test.ts`

**Interfaces:**
- Consumes: `checkEligibility`, `isSelectable`, `scoreCandidate`, `averageHours`, `fnv1a32`, `Constraints`, `Pins`.
- Produces:
```ts
type AllocateCtx = ShiftCtx & { weights: Weights; loadUnitHours: number; remainingSlots: number }
type Pick = { memberId: number; groupIndex: number; rank: number; score: Score; softFlags: Reason[] }
type GroupResult = { index: number; requested: number; filled: number; poolSize: number; shortfall: number; suggestion?: { relax: RelaxKey; wouldAdd: number } }
type AllocationResult = { picks: Pick[]; groups: GroupResult[]; excluded: Partial<Record<Reason, number>>; totalEligible: number }
function matchesGroup(f: CandidateFacts, g: GroupSpec): boolean
function comparePriority(p: Priority, a: CandidateFacts, b: CandidateFacts): number
function allocate(cands: CandidateFacts[], c: Constraints, pins: Pins, ctx: AllocateCtx): AllocationResult
```
- `comparePriority` order (negative = a first):
  - `least_assigned_first` → `a.termHours - b.termHours`
  - `reliable_first` → by reliability descending
  - `new_first` / `returning_first` → by `isNew`
  - `tallest_first` / `shortest_first` → null height last
  - `male_first` / `female_first`
- Normalization inside `allocate`: `groups=[]` → `[emptyGroup()]`; a single `count:null` → `remainingSlots`.

- [ ] **Step 1: Write the failing tests** (fixtures with explicit ids):
  - `filters_ineligible_and_counts_reasons`: 5 eligible, 2 class conflicts, 1 unavailable → `excluded = { CLASS_CONFLICT: 2, UNAVAILABLE: 1 }`, `totalEligible = 5`
  - `allow_class_conflicts_includes_soft`: picks may include conflict members, and `softFlags` contains `CLASS_CONFLICT`
  - `priority_applies_before_cut`: 3 candidates, priority `new_first`, count 1; the only new member has the *lowest* score → they are picked (regression for v1 bug #3)
  - `scarce_group_filled_first`: groups `[ {count:2}, {count:1, colleges:['CCE'], gender:'F'} ]` with exactly one CCE female who also has the highest score → she goes to group 1 (index 1), and group 0 gets the next two
  - `no_member_picked_twice`
  - `pinned_include_first_if_matching`
  - `pinned_include_ignored_if_ineligible` (no throw, not picked)
  - `null_height_fails_height_filter`, `null_college_fails_college_filter`
  - `deterministic_tiebreak`: equal scores → order by `fnv1a32(\`${shiftId}:${memberId}\`)`; same input twice → identical output
  - `single_null_count_uses_remaining_slots` (remaining 4 → requested 4)
  - `shortfall_reported`: requested 3, pool 1 → `shortfall 2`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement per TRD §8.4 steps 1–4 (diagnostics come in Task 3.6; leave `suggestion` undefined).
- [ ] **Step 4:** Run them, plus `pnpm vitest run --coverage tests/engine`. Expected: PASS, branches 100% for `allocate.ts`, `eligibility.ts`, `scoring.ts`, `time.ts`.
- [ ] **Step 5:** Commit with `feat(engine): constraint-aware fair allocation`.

### Task 3.6: Shortfall diagnostics

**Files:**
- Create: `server/engine/diagnostics.ts`
- Modify: `server/engine/allocate.ts` (call diagnostics for groups with `shortfall > 0`)
- Test: `tests/engine/diagnostics.test.ts`

**Interfaces:**
- Produces:
  - `type RelaxKey = 'colleges'|'gender'|'tenure'|'yearLevels'|'height'|'allowClassConflicts'`
  - `function suggestRelaxation(cands, group: GroupSpec, c: Constraints, pins, ctx, taken: Set<number>): { relax: RelaxKey; wouldAdd: number } | undefined`
  - It returns the single relaxation that adds the most *untaken* selectable candidates. Ties go in RelaxKey order; it returns undefined when no relaxation adds anyone.

- [ ] **Step 1: Write the failing tests:**
  - `suggests_any_college_when_college_is_bottleneck` (wouldAdd 5)
  - `suggests_allow_conflicts_when_conflicts_are_bottleneck`
  - `undefined_when_nothing_helps`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: PASS, coverage still 100% on the engine.
- [ ] **Step 5:** Commit with `feat(engine): shortfall relaxation suggestions`.

### Task 3.7: Multi-shift allocation

**Files:**
- Create: `server/engine/allocate-shifts.ts`
- Modify: `server/engine/index.ts` (re-export)
- Test: `tests/engine/allocate-shifts.test.ts`

**Interfaces:**
- Consumes: `allocate`, `checkEligibility`, `isSelectable`, `hoursBetween`.
- Produces:
```ts
type ShiftsAllocation = { teamMode: 'per_shift'|'same_team'; perShift: { shiftId: number; result: AllocationResult }[] }
function allocateShifts(cands: CandidateFacts[], c: Constraints, pins: Pins,
                        shifts: AllocateCtx[]): ShiftsAllocation   // shifts sorted by startAt inside
```
- `per_shift`: after each shift, clone the facts of its picks, adding `{shiftId, start, end}` to `bookings` and `hoursBetween(start, end)` to `termHours`, before allocating the next shift. Input `cands` is never mutated.
- `same_team`: eligible = selectable for every shift (hard/soft reasons unioned); `remainingSlots = min` over shifts; one `allocate` call using the first shift's ctx; identical picks per shift.

- [ ] **Step 1: Write the failing tests:**
  - `single_shift_equals_allocate` (one shift → same picks as `allocate`)
  - `per_shift_rotates`: 2 non-overlapping 8-hour shifts, count 2 each, 4 equally eligible members with equal hours → the 2 picked for shift 1 are not picked for shift 2
  - `per_shift_repeats_when_only_option`: only 1 eligible member, 2 non-overlapping shifts, count 1 → same member on both
  - `per_shift_never_double_books_overlapping_shifts`: 2 overlapping shifts, 1 eligible member → picked for the first only, shortfall 1 on the second
  - `same_team_requires_eligibility_for_all_shifts`: a member with a class on Day 2 only is excluded from every shift
  - `same_team_uses_min_remaining_slots` (remaining 3 and 5 → 3 picks on both)
  - `input_facts_not_mutated`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them, with coverage still 100% on the engine. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(engine): multi-shift allocation with same-team and rotation modes`.

---

## Phase 4 — Events and manual assignment

### Task 4.1: Candidate loader

**Files:**
- Create: `server/services/candidate-loader.ts`
- Test: `tests/api/candidate-loader.test.ts`

**Interfaces:**
- Consumes: Schema §8.1 queries, `isoWeekday`, `schoolYearStart`, `getSettings`.
- Produces: `loadCandidates(db, eventId: number, opts?: { memberIds?: number[]; shiftIds?: number[] }): Promise<{ event: EventRow; shifts: AllocateCtx[]; facts: CandidateFacts[]; roster: AssignmentRow[] }>`. `shifts` defaults to all active shifts. `today`/`now` are the current Asia/Manila date and `YYYY-MM-DDTHH:MM` (`new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila'})`).

- [ ] **Step 1: Write the failing tests:**
  - `uses_event_term_not_active_term` (event in an inactive future term → schedules from that term)
  - `termHours_sums_shift_durations` (a 4 h shift + a 9.5 h shift → 13.5)
  - `excused_and_cancelled_not_in_termHours`
  - `future_assignments_not_in_lastPastAssignmentDate` (including an event that started but hasn't ended)
  - `multi_day_event_loads_classes_for_all_touched_weekdays`
  - `overlapping_booking_on_previous_night_detected` (other event's shift Thu 22:00 → Fri 03:00 vs this shift Fri 01:00 → 05:00)
  - `bookings_include_other_shifts_of_same_event`
  - `remainingSlots_per_shift` (required 6, 2 active → 4)
  - `query_budget`: wrap `DB` with a counting proxy → ≤ 12 statements
  - `only_onboarded_active_members`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with two round trips: (event → term id), then one `db.batch` of the remaining queries.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: batched candidate loader`.

### Task 4.2: Events API

**Files:**
- Create: `server/routes/events.ts`, `shared/events.ts` (`EventInput`, `ShiftInput`), `server/services/audit.ts`
- Test: `tests/api/events.test.ts`

**Interfaces:**
- Produces:
  - `EventInput` Zod
  - `audit(db, actorId: number|null, action: AuditAction, entityType: string, entityId: number|null, data?: object): BatchItem` (returns a statement to include in batches)
  - routes per TRD §6 for events
  - `POST /api/events/:id/shifts/daily` (TRD §6)
  - `GET /api/events/:id/candidates?shiftId&search` → `{ items: { member: MemberSummary; eligibility: Eligibility; score: Score }[] }`

- [ ] **Step 1: Write the failing tests:**
  - `create_assigns_term_by_start_date`
  - `create_without_term_422_NO_TERM_FOR_DATE`
  - `end_before_start_422`
  - `span_over_14_days_422`
  - `cross_midnight_event_created`
  - `event_without_shifts_gets_default_main_shift`
  - `daily_helper_creates_one_shift_per_day` (13–15 Nov 08:00–17:00 → `Day 1..3`, event span `2026-11-13T08:00`–`2026-11-15T17:00`)
  - `shift_over_24h_422`
  - `remove_or_move_shift_with_assignments_409_SHIFT_HAS_ASSIGNMENTS`
  - `lower_required_below_active_count_422`
  - `event_span_recomputed_after_shift_change`
  - `members_see_only_published_and_completed`
  - `unpublish_blocked_with_assignments_409`
  - `cancel_cascades_assignments_to_cancelled_with_reason`
  - `candidates_endpoint_returns_reasons`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement the status transitions (App Flow §5). Every mutation bumps `version` and writes an audit row in the same batch.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: events api`.

### Task 4.3: Assignment writer + cancel

**Files:**
- Create: `server/services/assignment-writer.ts`, `server/routes/assignments.ts`, `shared/assignments.ts`
- Test: `tests/api/assignments.test.ts`

**Interfaces:**
- Consumes: `loadCandidates(db, eventId, { memberIds, shiftIds })`, `checkEligibility`, `isSelectable`.
- Produces:
  - `CreateAssignmentsInput = { items: { shiftId: number; memberIds: number[] (1..200, unique); overrideConflictIds?: number[] }[] (1..20); source: 'ai'|'manual'; aiSessionId?: number; expectedVersion: number }`
  - `writeAssignments(db, actor, eventId, input): Promise<{ created: AssignmentRow[]; version: number }>`
  - `POST /api/assignments/:id/cancel { reason: string (3..300) }`

- [ ] **Step 1: Write the failing tests:**
  - `manual_create_happy_path_201_bumps_version`
  - `ineligible_422_lists_reasons_and_writes_nothing`
  - `conflict_requires_override_for_manual`
  - `ai_source_uses_session_allowClassConflicts`
  - `over_capacity_409` (checked per shift)
  - `same_member_two_overlapping_shifts_in_one_request_422`
  - `same_member_two_non_overlapping_shifts_ok`
  - `shift_of_other_event_404`
  - `stale_version_409_VERSION_CONFLICT_writes_nothing`
  - `concurrent_approvals`: `Promise.all` of two requests with the same `expectedVersion` → exactly one 201 and one 409, and the roster count equals the first's size
  - `ai_approve_stores_outcome_json` (`accepted`/`removed`/`added`, computed against `last_result_json`)
  - `cancel_requires_reason_and_soft_deletes`
  - `audit_rows_written` (`assignment.create`, `assignment.override_conflict`)
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement exactly the TRD §8.5 batch: guard, version bump, inserts, audit, session outcome, guard cleanup. A D1 error raised by the guard's CHECK maps to `VERSION_CONFLICT`.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: transactional assignment writer with optimistic locking`.

### Task 4.4: Events UI + roster + manual add

**Files:**
- Create: `src/app/events/page.tsx`, `src/app/events/new/page.tsx`, `src/app/events/edit/page.tsx`, `src/app/events/view/page.tsx`, `src/components/events/{EventForm,ShiftsEditor,EventList,StaffingBar,ShiftChip,RosterTab,AddVolunteersDialog,EligibilityBadge,StatusBadge}.tsx`, `src/app/dashboard/page.tsx`
- Test: `tests/ui/eligibility-badge.test.tsx`, `tests/e2e/manual-assign.spec.ts`

- [ ] **Step 1: Write the failing tests:**
  - `badge_shows_icon_and_text_for_each_reason` (6 reasons + eligible)
  - e2e `adviser_creates_event_and_adds_two_members`: create (single block) → publish → add 2 → roster shows `2 / N`
  - e2e `daily_event_staffs_two_shifts`: create (daily block, 2 days) → add the same member to Day 1 and Day 2 → both shift bars update
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement per App Flow §5–6 and Design Brief §6. `/events/view` reads `id` from `useSearchParams` inside `<Suspense>`. On 409, invalidate the roster query and show a toast.
- [ ] **Step 4:** Run the tests plus `pnpm next build`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: events pages, roster and manual assignment`.

---

## Phase 5 — AssignAI

### Task 5.1: Vocabulary and prompt

**Files:**
- Create: `server/ai/vocabulary.ts`, `server/ai/prompt.ts`
- Test: `tests/ai/prompt.test.ts`

**Interfaces:**
- Produces:
  - `buildVocabulary(colleges: {code,name}[]): Vocabulary`
  - `buildMessages(input: { vocab: Vocabulary; shifts: { label; startAt; endAt; weekdays: string[]; required; remaining }[]; totalShifts: number; constraints: Constraints; history: { role:'user'|'assistant'; content:string }[]; message: string }): { system: string; messages: CoreMessage[] }`
  - The system prompt contains TRD §7.3 rules 1–8 verbatim. History is trimmed to the last 6.

- [ ] **Step 1: Write the failing tests:**
  - `no_pii_in_prompt`: build from a fixture whose members have names, emails and student numbers; assert none of those strings, and no `memberId` key, appear in the serialized output
  - `includes_all_college_codes`
  - `history_trimmed_to_6`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(ai): vocabulary and prompt builder`.

### Task 5.2: Interpreter with fallback

**Files:**
- Create: `server/ai/providers.ts`, `server/ai/interpret.ts`
- Test: `tests/ai/interpret.test.ts`

**Interfaces:**
- Consumes: `buildMessages`, `InterpreterOutput`.
- Produces:
  - `type Provider = { name: 'gemini'|'groq'; model: string; generate(args): Promise<InterpreterOutput> }`
  - `providersFromEnv(env: Env): Provider[]` (skips providers without keys)
  - `interpret(providers: Provider[], input: BuildMessagesInput, ctx: { vocabCodes: Set<string>; remainingByShift: { label: string; remaining: number }[] }): Promise<{ output: InterpreterOutput; provider: 'gemini'|'groq'|'none'; model?: string; latencyMs: number; error?: string }>`
  - `sanitize(o, vocabCodes): InterpreterOutput`
  - `normalize(o, remainingByShift): InterpreterOutput`

- [ ] **Step 1: Write the failing tests** (providers are fakes):
  - `falls_back_to_groq_when_gemini_throws`
  - `retries_once_on_validation_error_then_falls_back`
  - `none_provider_returns_unchanged_constraints_and_notice` (reply equals "AI is unavailable; edit the constraints card directly.")
  - `unknown_college_dropped_with_assumption`
  - `height_min_max_swapped`
  - `single_null_count_left_null_for_engine`
  - `two_null_counts_become_clarify`
  - `missing_teamMode_defaults_to_per_shift`
  - `over_remaining_adds_warning_naming_shift` (group total 5, "Day 2" has 3 remaining → reply mentions "Day 2")
  - `timeout_8s_per_provider` (fake timers)
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with `generateObject({ model, schema: InterpreterOutput, system, messages, temperature: 0, abortSignal: AbortSignal.timeout(8000) })`. If `AI_GATEWAY_URL` is set, use it as the provider `baseURL`.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(ai): interpreter with sanitize/normalize and provider fallback`.

### Task 5.3: AI session routes

**Files:**
- Create: `server/routes/ai.ts`, `shared/ai.ts` (`TurnResponse`)
- Test: `tests/api/ai-routes.test.ts`

**Interfaces:**
- Consumes: `loadCandidates`, `allocateShifts`, `interpret`, `providersFromEnv`.
- Produces: TRD §6 AI endpoints. `TurnResponse` is exactly as in TRD §6; pick display fields (name, college, year) are joined server-side after allocation.

- [ ] **Step 1: Write the failing tests** (with `providersFromEnv` mocked):
  - `create_resumes_open_session`
  - `default_scope_is_shifts_with_open_slots`
  - `scope_with_ended_or_foreign_shift_422`
  - `same_team_turn_returns_identical_picks_per_shift`
  - `turn_persists_ai_turn_and_updates_session`
  - `confirm_request_writes_no_assignments` (assignments count unchanged)
  - `manual_constraints_put_skips_llm` (fake provider not called)
  - `rate_limit_41st_turn_429` (`ai.turnsPerHour` = 40)
  - `other_adviser_cannot_post_to_session_403`
  - `turn_query_budget_le_12`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. Store `last_result_json` (ids, groupIndex, score) on every turn and manual edit.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(ai): sessions, turns and manual constraint edits`.

### Task 5.4: AssignAI UI

**Files:**
- Create: `src/components/assignai/{AssignAITab,ShiftScopeBar,TeamModeToggle,ChatPanel,MessageBubble,ConstraintsCard,GroupRow,PriorityList,PicksPanel,ShiftPicksSection,PickCard,ShortfallCallout,ExcludedSummary,ApproveBar,ApproveDialog,MemberPinSearch}.tsx`
- Test: `tests/ui/constraints-card.test.tsx`, `tests/e2e/assignai.spec.ts`

- [ ] **Step 1: Write the failing tests:**
  - `card_edit_emits_valid_constraints` (changing gender → `PUT` body validates against `Constraints`)
  - `changed_fields_highlighted_after_turn`
  - e2e `assignai_happy_path` (mocked LLM via `ENV=test` provider): open tab → send "need 2 girls from CCE" → 2 picks in "Group 1" → Approve → roster shows 2
  - e2e `confirm_text_does_not_assign`: send "yes assign them" → roster unchanged and Approve visible
  - e2e `same_team_three_days`: daily event (3 shifts) → scope All → "same 2 people all 3 days" → toggle shows Same team → Approve → 6 assignments, 2 distinct members
  - `scope_bar_hidden_for_single_shift_event`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement per App Flow §7 and Design Brief §7, including the mobile sheet and the `aria-live` log.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: AssignAI panel`.

### Task 5.5: Evals

**Files:**
- Create: `evals/cases.json`, `evals/run-evals.ts`, `evals/README.md`
- Modify: `package.json` (add a `"evals"` script)

**Interfaces:**
- Consumes: `interpret`, `providersFromEnv` (real keys from `.dev.vars`).
- Produces: a per-category accuracy table and exit code 1 if below the TRD §7.6 gate.

- [ ] **Step 1:** Port the cases:
  - v1 `nlp-service/tests/test_cases.json` (58), converted to the new schema (college codes, `tenure` for `new_old`)
  - the 34 hallucination-audit cases
  - ≥ 25 new cases: Tagalog gender terms (lalaki/babae), modifier-only turns, priorities phrasing, confirmations ("sige", "go na", "i-assign mo na"), unknown college → clarify, team mode ("same people all 3 days" → `same_team`; "iba-iba bawat araw" → `per_shift`)
- [ ] **Step 2:** Implement the runner. Comparison is field-wise on `expected`; JSON-equal for groups after sorting colleges.
- [ ] **Step 3:** Run `pnpm evals`. Expected: ≥ 95% overall, 100% for `confirm_request` and the conflicts default. If below, iterate on `prompt.ts` only.
- [ ] **Step 4:** Commit with `test(ai): eval suite and ship gate`.

---

## Phase 6 — Attendance, reports, audit, settings

### Task 6.1: Attendance

**Files:**
- Create: `server/routes/attendance.ts`, `src/components/events/AttendanceTab.tsx`
- Test: `tests/api/attendance.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `before_shift_end_409` (`now` < that shift's `end_at`, Asia/Manila)
  - `marking_day1_allowed_while_day2_not_ended`
  - `completes_event_only_when_all_shifts_ended_and_marked`
  - `cancelled_assignments_ignored`
  - `correction_after_completed_allowed_and_audited`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with the version guard batch.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: attendance marking`.

### Task 6.2: Fairness report

**Files:**
- Create: `server/services/fairness.ts`, `server/routes/reports.ts`, `src/app/reports/fairness/page.tsx`
- Test: `tests/api/fairness.test.ts`

**Interfaces:**
- Produces:
  - `gini(xs: number[]): number` (applied to hours)
  - `topShare(xs: number[], pct: number): number`
  - `fairnessReport(db, termId): Promise<FairnessReport>`
  - CSV route with columns `member_id,name,college,hours,shifts,attended,no_show,from_ai`

- [ ] **Step 1: Write the failing tests:**
```ts
expect(gini([1,1,1,1])).toBe(0)
expect(gini([0,0,0,4])).toBeCloseTo(0.75)
expect(gini([0,0,0,0])).toBe(0)
expect(topShare([10,0,0,0,0,0,0,0,0,0], 0.1)).toBe(1)
```
  Plus `never_assigned_includes_members_with_other_term_assignments_only` and `hours_from_shift_durations` (shifts of 4 h and 9.5 h → 13.5).
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement with Schema §8.2 and the UI per App Flow §9 (KPI cards, histogram with a data-table toggle).
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: term fairness report`.

### Task 6.3: Audit view, members directory, dashboard, scoring/AI settings

**Files:**
- Create: `server/routes/audit.ts`, `server/routes/members.ts`, `src/app/audit/page.tsx`, `src/app/members/page.tsx`, `src/app/members/view/page.tsx`
- Modify: `src/app/dashboard/page.tsx` (cards per App Flow §2, including "⚠ New conflicts (n)"), `src/app/settings/page.tsx` (Scoring + AI tabs)
- Test: `tests/api/members-audit.test.ts`

- [ ] **Step 1: Write the failing tests:**
  - `adviser_cannot_change_own_role_or_status_403`
  - `last_active_adviser_cannot_be_demoted_409_LAST_ADVISER`
  - `role_change_audited`
  - `deactivated_member_not_candidate`
  - `new_conflicts_query_finds_future_assignment_after_schedule_change`
  - `audit_filters_by_action_and_date`
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3:** Implement. The scoring settings tab shows a live top-10 preview by calling `GET /api/events/:id/candidates` with draft weights passed as a query param.
- [ ] **Step 4:** Run them. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: members, audit, dashboard and scoring settings`.

---

## Phase 7 — Hardening and launch

### Task 7.1: Security headers, hard-rule audit, e2e smoke

**Files:**
- Create: `public/_headers`, `server/services/hard-rule-audit.ts`, `tests/api/hard-rule-audit.test.ts`, `tests/e2e/smoke.spec.ts`

- [ ] **Step 1:** In `_headers`, set CSP `default-src 'self'; img-src 'self' https://lh3.googleusercontent.com data:; connect-src 'self'; frame-ancestors 'none'`, plus `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and `Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- [ ] **Step 2:** Create `server/services/hard-rule-audit.ts` per Schema §8.3 and test `hard_rule_audit_returns_zero_after_full_flow`. Seed a term, members with schedules, single-day, cross-midnight and multi-day events, and AI + manual assignments through the API, then expect 0 violations.
- [ ] **Step 3:** Run the e2e smoke `login → onboarding → schedule → adviser creates event → AssignAI → approve → attendance → fairness report`.
- [ ] **Step 4:** Run everything. Expected: PASS.
- [ ] **Step 5:** Commit with `chore: security headers, hard-rule audit and smoke test`.

### Task 7.2: UAT and go-live

- [ ] **Step 1:** Create the `umal-prod` D1, set production secrets, and register the Google OAuth production redirect URI.
- [ ] **Step 2:** Bootstrap adviser sign-in; create the active term; bulk pre-approve UMAL members.
- [ ] **Step 3:** UAT with 2 advisers + 5 members for one week on preview data. Track issues as GitHub issues labelled `uat`.
- [ ] **Step 4:** Confirm the go-live checklist:
  - evals ≥ gate
  - hard-rule audit = 0
  - backups workflow green
  - p95 non-AI API < 500 ms (Workers analytics)
- [ ] **Step 5:** Tag `v2.0.0` and announce to members with onboarding instructions.

---

## Dependency order

`0.1 → 0.2 → 0.3 → 0.4 → 1.1 → 1.2 → 1.3 → (1.4 ∥ 1.5) → 2.1 → (2.2 ∥ 2.3) → 3.1 → 3.2 → 3.3 → 3.4 → 3.5 → 3.6 → 3.7 → 4.1 → 4.2 → 4.3 → 4.4 → 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 6.1 → 6.2 → 6.3 → 7.1 → 7.2`

Phase 3 depends only on Task 3.1 and Task 0.3's test setup, so it can run in parallel with Phases 1–2 if two people or agents are working.
