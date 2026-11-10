# UMAL Management — Technical Requirements Document (TRD)

| | |
|---|---|
| **Version** | 2.0 · Draft · 2026-11-10 |
| **Implements** | [PRD](01-product-requirements.md) |
| **Data model** | [Backend Schema](05-backend-schema.md) |

---

## 1. Architecture

```
                    ┌──────────────────────── Cloudflare Pages project: umal-management ───────────────────────┐
 Browser ──HTTPS──▶ │  Static assets (Next.js `output: 'export'`)      /api/*  → Pages Functions (Hono app)        │
 (React SPA)        │  HTML/JS/CSS — free, unlimited requests          ├─ Better Auth (Google OAuth, cookie session) │
                    │                                                  ├─ Route handlers (Zod-validated)             │
                    │                                                  ├─ Assignment engine (pure TS)                │
                    │                                                  └─ AI interpreter (Vercel AI SDK)             │
                    └───────────────────────────────────────┬──────────────────────┬─────────────────────────────┘
                                                            │ D1 binding           │ HTTPS (via AI Gateway, optional)
                                                     ┌──────▼──────┐        ┌──────▼─────────────────────┐
                                                     │ Cloudflare  │        │ Gemini API (primary)        │
                                                     │ D1 (SQLite) │        │ Groq API (fallback)         │
                                                     └─────────────┘        └─────────────────────────────┘
```

**Design decisions**

1. **Static frontend plus a Functions API in one Pages project.** Static export keeps the frontend free, unlimited and fast. All logic runs in one small Hono bundle, so the 3 MiB free-plan Worker size limit is never a concern. Same origin means first-party cookies and no CORS.
2. **The LLM only interprets text; code decides.** The LLM turns text into a validated `Constraints` object. A pure, deterministic TypeScript engine applies hard rules, scores and allocates. The LLM never sees member data and never writes.
3. **Every write needs human approval.** Writes happen only through explicit REST calls from buttons, never as a side effect of a chat turn.
4. **Built for free-plan budgets** (Workers Free: 10 ms CPU per request, 50 subrequests per request, 100k requests/day):
   - an AI turn makes ≤ 12 D1 queries, batched with `db.batch()`, plus ≤ 2 LLM calls
   - no password hashing, since sign-in is OAuth only
   - ranking about 300 members in memory takes < 3 ms of CPU
   - CPU time spent waiting on the LLM or D1 doesn't count against the limit

## 2. Stack

Pin exact versions in `pnpm-lock.yaml` at project start; use the latest stable releases at that time.

| Layer | Choice | Notes |
|---|---|---|
| Language | TypeScript (strict) | One language end to end |
| Package manager | pnpm | |
| Frontend | Next.js App Router, `output: 'export'`, React | No SSR, server actions or middleware. Dynamic data via client fetch. |
| UI | Tailwind CSS v4 + shadcn/ui, Poppins via `next/font` (self-hosted) | Tokens in Design Brief §3 |
| Data fetching | TanStack Query | Cache, retries, optimistic roster updates |
| Forms | React Hook Form + Zod (`@hookform/resolvers`) | Shares Zod schemas with the API |
| Dates | `date-fns` | All values are local Asia/Manila strings; no TZ math |
| Charts | Recharts (via shadcn charts) | Fairness report |
| API | Hono on Cloudflare Pages Functions (`functions/api/[[route]].ts` → `handle(app)`) | |
| Validation | Zod + `@hono/zod-validator` | `shared/` schemas imported by both sides |
| ORM / migrations | Drizzle ORM (`drizzle-orm/d1`) + drizzle-kit → SQL in `migrations/`, applied with `wrangler d1 migrations apply` | |
| Database | Cloudflare D1 | `umal-prod`, `umal-preview` |
| Auth | Better Auth + Google social provider + Drizzle adapter (sqlite) | Cookie sessions; `member` row links to `user.id` |
| AI | Vercel AI SDK (`ai`) `generateObject` + `@ai-sdk/google` (primary) + `@ai-sdk/groq` (fallback) | Zod output schema; optional Cloudflare AI Gateway base URL for logs and caching |
| Tests | Vitest (unit, engine, API with Miniflare/`@cloudflare/vitest-pool-workers`), Playwright (e2e smoke) | |
| CI/CD | GitHub Actions → `wrangler pages deploy` | Preview deploy per PR, prod on `main` |

## 3. Repository layout

The repo is renamed `umal-management`. v1 code is preserved at tag `v1-laravel`.

```
umal-management/
├─ src/                       # Next.js (static export)
│  ├─ app/                    # routes — see App Flow §2 (dynamic ids via ?id= query)
│  ├─ components/             # ui/ (shadcn), layout/, events/, assignai/, schedule/, reports/
│  ├─ lib/api.ts              # typed fetch client (hono/client `hc<AppType>`)
│  └─ lib/session.ts          # useSession() via better-auth/react
├─ functions/api/[[route]].ts # Pages Functions entry: export const onRequest = handle(app)
├─ server/
│  ├─ app.ts                  # Hono app, route mounting, error handler, AppType export
│  ├─ env.ts                  # Bindings: DB, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_*, GEMINI_API_KEY/MODEL, GROQ_API_KEY/MODEL, AI_GATEWAY_URL?, BOOTSTRAP_ADVISER_EMAIL, ENV
│  ├─ auth.ts                 # createAuth(env) — Better Auth config
│  ├─ middleware/             # requireSession, requireApproved, requireOnboarded, requireRole('adviser')
│  ├─ db/schema.ts            # Drizzle schema (Backend Schema doc)
│  ├─ db/client.ts            # getDb(env)
│  ├─ routes/                 # me, access, members, catalog, terms, events, assignments, attendance, ai, reports, audit, settings
│  ├─ services/               # candidate-loader.ts, assignment-writer.ts, audit.ts, settings.ts, fairness.ts
│  ├─ engine/                 # PURE — no I/O: types, time, eligibility, scoring, allocate, explain
│  └─ ai/                     # vocabulary.ts, prompt.ts, interpret.ts, providers.ts
├─ shared/                    # Zod schemas + types used by client and server (constraints.ts, api.ts, enums.ts)
├─ migrations/                # drizzle-kit generated SQL
├─ evals/                     # cases.json (ported v1 tests + audit cases), run-evals.ts
├─ tests/                     # vitest (engine/, api/), e2e/ (playwright)
├─ docs/                      # these documents
├─ wrangler.toml              # pages_build_output_dir = "out", d1_databases, compatibility_flags = ["nodejs_compat"]
└─ next.config.ts             # output: 'export', images.unoptimized: true, trailingSlash: true
```

**Local development**
- `pnpm dev` runs `next dev` on :3000 and `wrangler pages dev` on :8788 together.
- `next.config.ts` adds a dev-only `rewrites()` that proxies `/api/*` to :8788. Rewrites aren't supported in an export build, so they're applied only when `NODE_ENV === 'development'`.
- `pnpm preview` runs `next build` then `wrangler pages dev out` for a production-like run.

## 4. Static export constraints (must follow)

- No `app/api` route handlers, server actions, `middleware.ts`, `cookies()`/`headers()` or ISR.
- Dynamic pages use query params: `/events/view?id=123`, never `/events/[id]`. The `useSearchParams` wrapper must sit inside `<Suspense>`.
- Hiding routes by role in the client is UX only. **The API enforces every permission.**
- `images.unoptimized = true`. Store images in `public/` or a CDN URL.

## 5. Authentication and authorization

- **Better Auth** is mounted at `/api/auth/*`:
  - Google provider with `prompt: "select_account"`
  - session cookie: `httpOnly`, `secure`, `sameSite=lax`
  - session expiry 30 days, rolling
- **Sign-in hook** (`databaseHooks.user.create.after` + session-create check):
  1. If the allowed domain (setting `auth.allowedEmailDomain`) is set and the email doesn't match → reject with `DOMAIN_NOT_ALLOWED`. The email in env `BOOTSTRAP_ADVISER_EMAIL` is always allowed and treated as an approved `adviser`.
  2. Look up `access_requests` by email:
     - approved → ensure a `members` row exists with the approved role (created on first sign-in, status `active`, `onboarded_at` null)
     - pending or missing → upsert as pending; the session is allowed but `/api/me` returns `accessStatus: 'pending'`
     - rejected → `accessStatus: 'rejected'`
- **Middleware chain** for protected routes:
  - `requireSession` → 401
  - `requireApproved` → 403 `ACCESS_PENDING` / `ACCESS_REJECTED`
  - `requireOnboarded` → 403 `ONBOARDING_REQUIRED`, skipped for `/api/me*` onboarding endpoints
  - `requireRole(...)` → 403 `FORBIDDEN`
- **Permission matrix:**

Two roles only: `member` and `adviser` (UMAL has no officers).

| Capability | member | adviser |
|---|:-:|:-:|
| Own profile, schedule, unavailability, own assignments | ✅ | ✅ |
| View published/completed events | ✅ | ✅ |
| Events CRUD, manual assignment, AssignAI, attendance | | ✅ |
| Access requests, members list/detail, role/status changes | | ✅ |
| Settings, terms, catalog | | ✅ |
| Fairness report, audit log | | ✅ |

**Lock-out guards:** an adviser can't change their own role or status, and the last active adviser can't be demoted or deactivated (409 `LAST_ADVISER`).

## 6. API

**Conventions**
- JSON over REST under `/api`.
- Errors use the shape `{ error: { code: string, message: string, details?: unknown } }`.
- Lists accept `?page&pageSize` (default 25, max 100) and return `{ items, total }`.
- Every request body and query is validated with Zod from `shared/api.ts`.

| Method & path | Role | Purpose |
|---|---|---|
| `GET /api/me` | any session | `{ user, member?, accessStatus, onboarded, activeTerm, scheduleSubmitted }` |
| `POST /api/me/onboarding` | approved | Complete profile (FR-5) |
| `PATCH /api/me/profile` | onboarded | Edit own profile (not role or email) |
| `GET /api/me/schedule?termId` · `PUT /api/me/schedule` | member | Replace the whole class schedule for a term (idempotent) |
| `GET/POST /api/me/unavailability` · `DELETE /api/me/unavailability/:id` | member | Unavailability blocks |
| `GET /api/me/assignments` | member | Own assignments + term stats |
| `GET /api/catalog` | onboarded | Colleges + courses (active) |
| `POST/PATCH /api/catalog/colleges[/:id]`, `.../courses[/:id]` | adviser | Catalog CRUD (soft deactivate) |
| `GET /api/terms` · `POST /api/terms` · `PATCH /api/terms/:id` · `POST /api/terms/:id/activate` | adviser (GET: any) | Terms |
| `GET /api/access-requests?status` | adviser | Queue |
| `POST /api/access-requests/bulk` | adviser | Pre-approve `{ emails[], role }` |
| `POST /api/access-requests/:id/approve` `{ role }` · `/reject` `{ note? }` | adviser | Decide |
| `GET /api/members?search&college&role&status` · `GET /api/members/:id` | adviser | Directory, detail with term stats |
| `PATCH /api/members/:id` `{ role?, status? }` | adviser | Role/status changes (audited, lock-out guards §5) |
| `GET /api/events?status&from&to` · `POST /api/events` · `GET/PATCH /api/events/:id` · `POST /api/events/:id/cancel` | GET any, write adviser | Events with their shifts. `POST`/`PATCH` bodies carry `shifts: ShiftInput[]` (create/update/remove by id; see Schema §9 rules 2–3). Members only get published/completed. |
| `POST /api/events/:id/shifts/daily` `{ fromDate, toDate, startTime, endTime, requiredVolunteers }` | adviser | Helper: replaces the default shift with one shift per day, labelled `Day 1…n` (e.g. a summit 08:00–17:00 × 3 days) |
| `GET /api/events/:id/roster` | adviser (members: names only for published) | Assignments grouped by shift + statuses + `version` |
| `GET /api/events/:id/candidates?shiftId&search` | adviser | All active members with `Eligibility` for that shift (manual add) |
| `POST /api/events/:id/assignments` | adviser | Create assignments across one or more shifts (see §8.5) |
| `POST /api/assignments/:id/cancel` `{ reason }` | adviser | Soft remove |
| `PUT /api/events/:id/attendance` `{ entries: [{ assignmentId, status }] }` | adviser | Mark attendance (each entry only after its shift's `end_at`) |
| `POST /api/events/:id/ai-sessions` | adviser | Start or resume the open session for this event+user |
| `GET /api/ai-sessions/:id` | adviser (owner) | Session with turns |
| `POST /api/ai-sessions/:id/turns` `{ message, pins: { include: number[], exclude: number[] }, scope: { shiftIds: number[] } }` | adviser (owner) | One chat turn → `TurnResponse` |
| `PUT /api/ai-sessions/:id/constraints` `{ constraints, pins, scope }` | adviser (owner) | Manual edit of the constraint card or shift scope → re-rank without LLM |
| `GET /api/reports/fairness?termId` · `GET /api/reports/fairness.csv?termId` | adviser | FR-29 |
| `GET /api/audit?actor&action&entityType&from&to` | adviser | FR-30 |
| `GET /api/settings` · `PUT /api/settings` | adviser | FR-31 |

`TurnResponse`:
```ts
{
  turn: { id, reply, kind: 'update' | 'answer' | 'clarify' | 'confirm_request', assumptions: string[], provider: 'gemini' | 'groq' | 'none' },
  constraints: Constraints,               // shared/constraints.ts
  result: ShiftsAllocation,               // §8.4; display fields joined server-side
  scope: { shiftIds: number[] },
  eventVersion: number
}
```

## 7. AssignAI interpreter

### 7.1 Input sent to the LLM (no PII)
- **System prompt:**
  - role and rules (`server/ai/prompt.ts`)
  - the vocabulary, built from the DB on each turn: college codes with names, year levels 1–5, genders `M`/`F`, tenure `new`/`returning`, the priority enum
- **Shift context** (no member data): the shifts in scope as `label · start → end (weekday) · required · remaining`, and the total number of shifts in the event.
- **Current `Constraints` JSON.**
- **Last 6 messages** (adviser + assistant text only).
- **The new adviser message.**

### 7.2 Output (Zod, `shared/constraints.ts`)
```ts
Gender     = z.enum(['M','F'])
Tenure     = z.enum(['new','returning'])
Priority   = z.enum(['least_assigned_first','reliable_first','new_first','returning_first',
                     'tallest_first','shortest_first','male_first','female_first'])
GroupSpec  = z.object({
  count: z.number().int().min(1).max(100).nullable(),   // null = "fill remaining"
  colleges: z.array(z.string()).max(14),                // catalog codes; [] = any
  gender: Gender.nullable(),
  tenure: Tenure.nullable(),
  yearLevels: z.array(z.number().int().min(1).max(5)),  // [] = any
  heightMinCm: z.number().int().min(100).max(230).nullable(),
  heightMaxCm: z.number().int().min(100).max(230).nullable(),
})
Constraints = z.object({
  groups: z.array(GroupSpec).max(10),                   // [] = one unconstrained group; counts are PER SHIFT
  allowClassConflicts: z.boolean(),                     // default false
  priorities: z.array(Priority).max(4),                 // ordered
  teamMode: z.enum(['per_shift','same_team']),          // default 'per_shift' (only matters with > 1 shift in scope)
})
InterpreterOutput = z.object({
  kind: z.enum(['update','answer','clarify','confirm_request']),
  constraints: Constraints,                             // FULL merged state, not a diff
  reply: z.string().max(600),                           // same language as the adviser
  assumptions: z.array(z.string()).max(5),              // e.g. "Treated 'matangkad' as tallest_first"
})
```

### 7.3 Rules in the prompt (each one is an eval case)
1. Return the **full** merged state. Short modifiers ("also males", "lalaki lang", "experienced only") patch the most recent relevant group. They never reset counts.
2. Never invent a count. If no count is stated, keep the existing one, or use `null`.
3. Only use college codes from the vocabulary. If the adviser names an unknown college, choose `clarify`.
4. A confirmation ("yes", "sige", "go", "assign them") → `kind: 'confirm_request'`, constraints unchanged, and a reply that points to the Approve button.
5. A question about the system → `answer`, constraints unchanged.
6. Default `allowClassConflicts=false`. It becomes true only on an explicit statement.
7. Default `teamMode='per_shift'` (different people per shift allowed, rotation preferred). "Same people every day", "iisang team lang", "they cover the whole event" → `same_team`. "Iba-iba bawat araw", "rotate" → `per_shift`. Counts always mean volunteers **per shift**.
8. The LLM never chooses which shifts are in scope; the adviser picks them in the UI.

### 7.4 Server post-processing (deterministic, `server/ai/interpret.ts`)
1. Validate with Zod. On failure, retry once with the validation error attached; then fall back to the next provider.
2. **Sanitize:**
   - drop unknown college codes and add an assumption note
   - clamp heights
   - swap min/max if inverted
   - dedupe priorities
3. **Normalize:**
   - `groups=[]` → `[{count:null, colleges:[], gender:null, tenure:null, yearLevels:[], heightMinCm:null, heightMaxCm:null}]`
   - exactly one group with `count=null` → left as `null`; the engine fills it with **each shift's own** `remainingSlots`
   - more than one null-count group → `kind='clarify'` with a generated question
4. If the total requested is greater than a shift's `remainingSlots`, add a warning naming that shift to `reply` (the request isn't blocked).

### 7.5 Providers (`server/ai/providers.ts`)
- **Order:** Gemini (model id from the `GEMINI_MODEL` env var, default the current free-tier Flash model), then Groq (`GROQ_MODEL`, default `openai/gpt-oss-120b`), then `none`.
- With `none`, the turn returns `kind:'answer'`, constraints unchanged, and the reply "AI is unavailable; edit the constraints card directly."
- **Timeouts:** 8 s per provider call; one retry for validation errors only.
- Temperature 0.
- Log `provider`, `model`, `latencyMs`, `error` to `ai_turns`.
- **Rate limit:** count of the user's `ai_turns` in the last 60 min, compared with setting `ai.turnsPerHour` (default 40) → 429 `AI_RATE_LIMITED`.

### 7.6 Evals (`evals/`)
- `cases.json` holds the 58 v1 functional cases, the 34 hallucination-audit cases, and new cases for Tagalog gender terms, modifier-only turns, priorities and confirmations. Each case is `{ history[], currentConstraints, message, expected: Partial<InterpreterOutput> }`.
- `pnpm evals` runs them against the configured provider and prints accuracy by category. It's run manually or on a weekly schedule, not on every PR, because of free-tier limits.
- **Ship gate:** ≥ 95% overall; 100% on `confirm_request` and `allowClassConflicts` default cases.

## 8. Assignment engine (`server/engine/`, pure functions)

### 8.1 Inputs (built by `services/candidate-loader.ts` with one `db.batch`)

"Term" here always means **the event's term** (`events.term_id`), not the currently active term. An event scheduled for next semester is checked against next semester's schedules.

The term is the one containing the event's **start date**. Class schedules only apply on days inside `[term.start_date, term.end_date]`.

**Shifts.** Every event has ≥ 1 shift; volunteers are assigned to shifts. The loader reads facts once for the span of the shifts in scope; the engine then evaluates eligibility **per shift** (each shift is its own `[start_at, end_at)` interval).

- the event and its active shifts
- the event's term and settings
- all `members` with `role='member' AND status='active'`, plus college code
- their class entries for that term on the weekdays the event touches, and schedule submission flags
- weekly unavailability on those weekdays, plus date blocks on any date the event touches
- all non-cancelled assignments in the term, joined to shift `start_at`/`end_at` (for hours and recency)
- non-cancelled assignments on any shift (of any event, including this one) overlapping the scope span

**Shifts are datetime intervals.** `start_at` and `end_at` are local `YYYY-MM-DDTHH:MM` strings; string order = time order. For weekly rules the engine splits each shift into **day segments** with `segments(startAt, endAt)`:
- Fri 2026-11-13 18:00 → Sat 2026-11-14 02:00 gives `[{date:'2026-11-13', weekday:5, start:'18:00', end:'24:00'}, {date:'2026-11-14', weekday:6, start:'00:00', end:'02:00'}]`
- full middle days are `00:00–24:00`; `'24:00'` is the end-of-day sentinel and sorts after every `HH:MM`
- a shift lasts ≤ 24 h; an event's span (first shift → last shift) ≤ 14 days
- a 3-day summit that runs 08:00–17:00 daily is **three daily shifts**, not one 57-hour shift; the daily helper creates them

### 8.2 Eligibility (per shift): `checkEligibility(facts, shift, pins) → { hard: Reason[], soft: Reason[] }`; `isSelectable(e, allowClassConflicts)`

| Reason | Kind | Rule |
|---|---|---|
| `ALREADY_ON_SHIFT` | hard | Non-cancelled assignment on this shift |
| `DOUBLE_BOOKED` | hard | Non-cancelled assignment on another shift (any event, including another shift of this event) whose `[start_at, end_at)` overlaps this shift's |
| `UNAVAILABLE` | hard | For any day segment of the shift: a weekly block on that weekday, or a date block on that date, overlapping the segment |
| `SCHEDULE_MISSING` | hard if `assignment.requireSchedule` else soft | No submitted schedule for the event's term |
| `CLASS_CONFLICT` | soft (excluded unless `allowClassConflicts`) | For any day segment of the shift whose date is within the term: a class entry on that weekday overlapping the segment |
| `PINNED_EXCLUDE` | hard | Adviser pinned exclude |

Overlap is `aStart < bEnd && bStart < aEnd`, comparing `HH:MM` strings within a segment, or `YYYY-MM-DDTHH:MM` strings between shifts. Touching end-to-start (e.g. class 08:00–10:00, event 10:00–12:00) is **not** a conflict.

### 8.3 Scoring: `scoreCandidate(facts, ctx) → { total, components }`
- **Workload is measured in hours served.** `termHours` = sum of shift durations (hours) of the member's assignments with status `assigned`, `attended` or `no_show` in the event's term. `excused` and `cancelled` don't count.
- `loadGap = (ctx.avgTermHours − facts.termHours) / ctx.loadUnitHours`
  - `avgTermHours` is the mean over all assignable members
  - `loadUnitHours` (setting `scoring.loadUnitHours`, default 4) turns hours into "duty units" so the default weights stay balanced: 8 hours below average → `loadGap = 2`
- `recency = min(daysSinceLastPast, 60) / 30`
  - `daysSinceLastPast` = days from the `end_at` date of the latest assignment whose shift has **already ended** (`end_at < now`) to today
  - never assigned → 60
- `reliability = (attended + 1) / (attended + noShow + 2)`
  - Laplace-smoothed; a new member scores 0.5
- `total = w.load·loadGap + w.recency·recency + w.reliability·reliability`
  - default `w = { load: 3, recency: 1, reliability: 1 }` (settings)
- **Tie-break:** ascending `fnv1a32(\`${shiftId}:${memberId}\`)`. It's deterministic per shift but doesn't always favour low IDs.

### 8.4 Allocation

**Single shift:** `allocate(candidates, constraints, pins, shiftCtx) → AllocationResult`
1. Partition: `eligible` = no hard reasons and (no `CLASS_CONFLICT` or `allowClassConflicts`). Tally exclusion reasons.
2. For each group *g*, `pool(g)` = eligible candidates matching:
   - colleges (any if empty)
   - gender
   - tenure
   - year levels
   - height bounds (null height fails a bound)
3. **Order groups by scarcity:** ascending `|pool(g)| / count(g)`, ties by original index.
4. For each group in that order:
   - sort its pool by `priorities` (lexicographic comparators), then `total` descending, then tie-break
   - **then** take the first `count(g)` members not already taken
   - pinned-include members matching the group are placed first
5. **Shortfall diagnostics:** for each unfilled group, recompute the pool with each single filter dropped (each college, gender, tenure, yearLevels, height, and `allowClassConflicts=true`). Report the relaxation that adds the most candidates as `suggestion`.
6. Return `AllocationResult` (below).

**Several shifts:** `allocateShifts(candidates, constraints, pins, shifts: ShiftCtx[]) → ShiftsAllocation`
- `teamMode = 'per_shift'`: process shifts in chronological order. After each shift, its picks are added to every candidate's facts as a booking (so overlapping later shifts see `DOUBLE_BOOKED`) and as served hours (so `termHours` rises and later shifts favour other people). Result: natural rotation without a hard ban on repeats.
- `teamMode = 'same_team'`: a candidate is eligible only if selectable for **every** shift in scope (reasons are unioned across shifts). Score with the first shift's context, run `allocate` once with `remainingSlots = min` over the shifts, and assign the same picks to every shift.

```ts
ShiftsAllocation = {
  teamMode: 'per_shift' | 'same_team',
  perShift: { shiftId: number, result: AllocationResult }[]
}
```
```ts
AllocationResult = {
  picks: { memberId, groupIndex, rank, score: { total, loadGap, recency, reliability }, softFlags: Reason[] }[],
  groups: { index, requested, filled, poolSize, shortfall, suggestion?: { relax: string, wouldAdd: number } }[],
  excluded: Partial<Record<Reason, number>>,
  totalEligible: number
}
```

### 8.5 Writing assignments (`services/assignment-writer.ts`)

**Request:** `POST /api/events/:id/assignments` with

```ts
{ items: { shiftId: number, memberIds: number[], overrideConflictIds?: number[] }[],
  source: 'ai'|'manual', aiSessionId?: number, expectedVersion: number }
```

**Checks (all in one request):**
1. Load facts for exactly those members and shifts (same loader, filtered). Items are checked in chronological shift order, with earlier items counted as bookings, so a request that puts one person on two overlapping shifts fails.
2. Reject the whole request with 422 `INELIGIBLE` and per-(shift, member) reasons if any member:
   - has a hard reason, or
   - has `CLASS_CONFLICT` without `allowClassConflicts`, and isn't in `overrideConflictIds`

   `allowClassConflicts` comes from the AI session's constraints when `source='ai'`.
3. Reject with 409 `OVER_CAPACITY` if, for any shift, `activeCount + memberIds.length > shift.required_volunteers`.
4. Reject with 409 `VERSION_CONFLICT` if `expectedVersion ≠ events.version`.

**Writes:** one `db.batch([...])`, which D1 runs as a single transaction:
1. `INSERT INTO write_guards(ok) SELECT CASE WHEN version = :expected THEN 1 ELSE 0 END FROM events WHERE id = :eventId`
   - `write_guards.ok` has `CHECK (ok = 1)`, so a version mismatch makes this statement fail and the whole batch rolls back
   - this closes the race between the version check and the write
2. `UPDATE events SET version = version + 1, updated_at = :now WHERE id = :eventId`
3. Insert the assignments.
4. Insert the audit rows.
5. For `source='ai'`, compare to the session's last recommendation, store `{accepted, removed, added}` in `ai_sessions.outcome_json` and set status `approved`.
6. `DELETE FROM write_guards`.

If the batch fails on the guard check, return 409 `VERSION_CONFLICT`.

The partial unique index `(shift_id, member_id) WHERE status <> 'cancelled'` is the last line of defence against duplicates.

## 9. Fairness report (`services/fairness.ts`)

Computed on request with SQL plus TypeScript, over the term's assignable members. **Hours served** is the primary measure:
- per-member hours and shift counts (assigned + attended + no_show)
- mean, median, max
- Gini of hours: `Σ_i Σ_j |x_i − x_j| / (2 n² μ)`, 0 when μ = 0
- top-10% share of hours
- never-assigned list
- no-show rate = no_show / (attended + no_show)
- AI share = source='ai' / total assignments
- override rate = Σ removed+added / Σ recommended over approved sessions

## 10. Security

- Server-side role checks on every route (§5); IDs in URLs are always re-authorized.
- Zod on every input; Drizzle parameterized queries only; no raw string SQL.
- Better Auth origin and CSRF checks enabled; `trustedOrigins` = production and preview domains.
- Secrets live in Pages environment variables (encrypted): `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GEMINI_API_KEY`, `GROQ_API_KEY`. Never `NEXT_PUBLIC_*`.
- Security headers via `public/_headers`:
  - CSP limited to self and Google OAuth
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
- No PII in LLM calls (enforced by `prompt.ts` building from constraints, catalog and event only; unit test asserts no member fields).
- Audit log is append-only from application code. There is no update or delete route.
- Never commit DB dumps (`.gitignore` `*.sql`, `*.dump`, `*bu`). Remove `database/umalDBbu` from history when resetting the repo.

## 11. Observability

- `console.log` JSON lines (`{level, route, userId, ms, code}`) → Cloudflare Workers Logs / `wrangler pages deployment tail`.
- `ai_turns` stores provider, latency and errors, and is queryable for an AI health card on the adviser dashboard.
- Optional Cloudflare AI Gateway for LLM request logs and analytics.

## 12. Testing strategy

| Level | Tooling | Scope | Gate |
|---|---|---|---|
| Engine unit | Vitest | time overlap, segments, eligibility, hours scoring, single- and multi-shift allocation, diagnostics | 100% branch coverage on `server/engine/` |
| AI unit | Vitest with mocked `generateObject` | sanitize/normalize, fallback order, rate limit, prompt has no PII | CI |
| API integration | Vitest + `@cloudflare/vitest-pool-workers` (real D1 in Miniflare, migrations applied) | authz matrix, write path, version conflict, partial unique index | CI |
| Evals | `pnpm evals` | LLM interpretation accuracy | Manual; ship gate §7.6 |
| E2E smoke | Playwright against `wrangler pages dev out` with a test-only auth bypass (`E2E_AUTH=1`, refused unless `ENV=test`) | login → create event → AI assign → approve → attendance | CI on `main` |

## 13. Environments and deployment

| Env | Pages branch | D1 | Google OAuth redirect |
|---|---|---|---|
| Local | — | local D1 (`.wrangler/state`) | `http://localhost:8788/api/auth/callback/google` |
| Preview | PR branches | `umal-preview` | `https://<branch>.umal-management.pages.dev/...`, registered via a fixed `preview` alias |
| Production | `main` | `umal-prod` | `https://umal-management.pages.dev/...` (custom domain optional) |

**CI** (GitHub Actions):
1. `pnpm i`, then lint, typecheck, `vitest`
2. `next build`
3. `wrangler d1 migrations apply <db> --remote`
4. `wrangler pages deploy out --branch <branch>`

**Backups:**
- D1 Time Travel gives 7-day point-in-time recovery on the free plan.
- A weekly GitHub Action runs `wrangler d1 export` and saves the result as an encrypted artifact (30-day retention).

## 14. Migration from v1

1. Tag `v1-laravel` on the current `main`.
2. Rename the repo to `umal-management`; GitHub redirects the old URL.
3. Purge `database/umalDBbu` from history if the repo is public (`git filter-repo`). It's a schema dump, but dumps shouldn't live in git.
4. Start v2 on `main` with an empty tree plus `docs/`.
5. No member data migration: UMAL bulk pre-approves emails (FR-3) and members re-onboard.
6. Seed the catalog with the 14 UM academic units.
