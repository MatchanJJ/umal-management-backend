# UMAL Management — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | UMAL Management (with AssignAI) |
| **Organization** | University of Mindanao Ambassadors League (UMAL), UM Matina Campus, Davao City |
| **Owner** | Mark Jade B. Palma |
| **Version** | 2.0 (rewrite of `umal-management-backend` v1) |
| **Status** | Draft for review |
| **Last updated** | 2026-11-10 |
| **Related docs** | [TRD](02-technical-requirements.md) · [App Flow](03-app-flow.md) · [Design Brief](04-design-brief.md) · [Backend Schema](05-backend-schema.md) · [Implementation Plan](06-implementation-plan.md) |

---

## 1. Problem

UMAL advisers staff university events with student ambassadors. Today, assignment is mostly manual. Advisers check who is free, avoid class conflicts, and try to spread the work fairly, all from memory, chat threads and spreadsheets. This causes four problems:

- **Wrong people get assigned.** Members get scheduled during their classes or on days they said they were unavailable.
- **The workload is uneven.** The same reliable members get picked repeatedly, and others are never called.
- **There is no record.** Nobody can show who served, who showed up, or whether the distribution was fair.
- **Requests are informal.** Advisers ask for things like "2 girls from CCE and 3 new members" in plain language, but every tool makes them filter by hand.

The v1 prototype (Laravel + T5-small) proved the concept but is **not production-safe**. A code review found these defects:
- Declared availability was never enforced.
- Class conflicts were allowed by default.
- Priority rules didn't change who got selected.
- The fairness score depended on an attendance column that didn't exist.
- Typing "yes" in chat could trigger database writes.

v2 is a rewrite built for real use by UMAL.

## 2. Goals

| # | Goal | Measured by |
|---|---|---|
| G1 | Every AI or manual assignment respects hard rules: availability, class schedule, no double-booking | 0 hard-rule violations among finalized assignments (checked by an automated audit query) |
| G2 | Work is distributed fairly across active members each term | Gini coefficient of per-member **hours served** ≤ 0.35 per term; "never assigned" share of eligible members ≤ 15% by end of term |
| G3 | Staffing an event takes minutes | Median time from opening AssignAI to approval ≤ 3 minutes |
| G4 | Advisers can phrase requests naturally (English, Tagalog, Taglish) | ≥ 95% of eval suite parsed correctly; ≤ 10% of AI picks manually removed before approval |
| G5 | Runs at ₱0/month | Fits Cloudflare free plan, D1 free tier and free LLM tiers at UMAL's scale |

## 3. Non-goals (v2.0)

- Notifications (email, Messenger, push). Planned for v2.1 (option D from the scope discussion).
- Multiple organizations or tenants. UMAL only.
- Native mobile apps. The web app must be responsive.
- Fully autonomous assignment. A human always approves.
- Payroll, merchandise, finance or uniform inventory.
- Importing v1 member data. Members re-onboard; advisers can bulk pre-approve emails.

## 4. Users and roles

| Role | Who | Can do |
|---|---|---|
| **Adviser** | UMAL faculty advisers | Everything: access approvals, members, events, manual + AI assignment, attendance, reports, terms, catalog, settings, role changes |
| **Member** | Student ambassadors | Own profile, class schedule, unavailability, see own assignments and published events |

UMAL has no officer layer; there are only these two roles. Only users with the **Member** role are assignable to events. Safeguards because every adviser has full control:
- an adviser can't demote or deactivate themselves
- the last active adviser can't be demoted or deactivated (409 `LAST_ADVISER`)
- every role or status change is audited

### Personas
- **Ma'am Reyes (Adviser).** Gets event requests from university offices and runs the org day to day: approves new members, fixes rosters, marks attendance. Wants to type "need 6 ushers, 3 boys 3 girls, tall preferred, no one with class" and get a defensible list.
- **Bea (Member).** 2nd-year CCE student. Wants to enter her schedule once per term and not be called during class.

## 5. Scope: v2.0 (option C)

### 5.1 Access and onboarding
- **FR-1** Sign-in is Google OAuth only. No passwords.
- **FR-2** A first-time sign-in by an unknown email creates a **pending access request**, and the user sees a "Pending approval" screen.
- **FR-3** Advisers approve or reject requests and assign the role on approval. They can also **pre-approve emails in bulk** by pasting a list or uploading a CSV.
- **FR-4** Sign-in is restricted to `@umindanao.edu.ph` Google accounts by default (setting `auth.allowedEmailDomain`). Advisers can change it. The bootstrap adviser email is always allowed.
- **FR-5** Approved members complete **onboarding** before they can use the app:
  - first and last name, student number
  - college, course, year level
  - gender (M/F), batch year
  - height (cm), T-shirt size
- **FR-6** Rejected users see a rejection screen and cannot request access again for 7 days.

### 5.2 Member self-service
- **FR-7** Members enter their **class schedule per term**: UM day code (M-Sa = Mon–Sat, M-SA1 = Mon–Wed, M-SA2 = Thu–Sat, or a single day Mon, Tue, Wed, Thu, Fri, Sa), start time, end time, optional subject label. A multi-day code is stored as one class per weekday.
- **FR-8** Members add **unavailability blocks**, either weekly (e.g. "Saturdays 08:00–12:00, family") or for a specific date.
- **FR-9** Members see their upcoming and past shifts with status, plus their own term stats: hours served, shifts served and attendance rate.
- **FR-10** Members whose schedule for the active term isn't submitted see a persistent banner. By default they are **not assignable** (setting `assignment.requireSchedule`).

### 5.3 Terms and catalog
- **FR-11** Advisers manage academic terms (name, start date, end date). Exactly one term is active at a time.
- **FR-12** Advisers manage colleges and courses. The catalog is seeded with the 14 official UM academic units (see Backend Schema §7). The AI reads its allowed values from this catalog, not from code.

### 5.4 Events
- **FR-13** Advisers create events with title, description, venue, status and **one or more shifts**. Each shift has a label, a start date + time, an end date + time and the number of volunteers needed. Events may **span multiple days and cross midnight** (e.g. Fri 18:00 → Sat 02:00, or a 3-day summit), up to 14 days; a single shift lasts at most 24 hours.
- **FR-13a** A simple event gets one shift covering the whole event, so advisers don't have to think about shifts. A **daily helper** turns "08:00–17:00 every day, 13–15 Nov, 6 volunteers" into three daily shifts in one step. Advisers can add, edit or remove shifts; a shift that already has volunteers can't be removed or moved until they're cancelled.
- **FR-13b** Volunteers are assigned to **shifts**. One member can hold several shifts of the same event (e.g. cover all three days) as long as they don't overlap. Classes, unavailability and other bookings are checked for each shift on every day it touches.
- **FR-14** Event statuses: `draft` → `published` → `completed`, or `cancelled` from any state. Members only see `published` and `completed` events.
- **FR-15** Event detail shows the roster grouped by shift, staffing progress per shift and overall (assigned / required), and tabs for AssignAI and Attendance.

### 5.5 Assignment: manual
- **FR-16** Advisers pick a shift, search members and add them to it. Each candidate shows eligibility: ✅ eligible, or ⚠️ with reasons (class conflict, unavailable, booked elsewhere, schedule missing).
- **FR-17** Adding a member who breaks a **soft** rule (class conflict) needs an explicit override checkbox and is logged. **Hard** rules can't be overridden:
  - declared unavailable
  - double-booked on an overlapping shift (of any event)
  - already on this shift
  - inactive member
- **FR-18** Removing a member marks the assignment `cancelled` with a required reason. Nothing is ever hard-deleted.

### 5.6 Assignment: AssignAI
- **FR-19** On an event, advisers open AssignAI, choose which shifts to staff (one, several or all), and type requests in English, Tagalog or Taglish. Each turn updates a **visible, editable constraint card**:
  - groups with count **per shift**, college, gender, new vs returning, year level, height range
  - whether class conflicts are allowed
  - priorities
  - team mode for multi-shift requests: **same team** for every shift ("same 5 people all 3 days") or **per shift** (different people allowed; the ranking rotates people across shifts)
- **FR-20** After every turn, the system returns a ranked recommendation. For each pick it shows the group it fills, a score breakdown and a one-line reason. It also shows a summary of who was excluded and why.
- **FR-21** If a group can't be filled, the system says how many are missing and suggests the relaxation that would help most (e.g. "Only 1 eligible female from CCE. Allow any college?").
- **FR-22** Advisers can pin members to include or exclude using UI chips, not chat text, so no names are sent to the AI. They can also edit the constraint card directly.
- **FR-23** Nothing is written until the adviser presses **Approve**. If the adviser types "yes, assign them", the assistant replies by pointing to the Approve button.
- **FR-24** On approval, the server re-checks every pick against current data and writes all of them or none. If the roster changed meanwhile (version mismatch), the adviser is asked to refresh.
- **FR-25** Every session, turn, recommendation and the approved set are stored. What was accepted, removed or added becomes feedback data.
- **FR-26** AI usage is rate-limited per user (default 40 turns/hour). If both AI providers fail, the constraint card can still be edited by hand and recommendations still work.

### 5.7 Attendance
- **FR-27** After each shift ends, advisers mark its assignments `attended`, `no_show` or `excused`. Bulk "mark all attended" per shift is allowed. When every shift has ended and every assignment is marked, the event moves to `completed`.
- **FR-28** Attendance feeds the reliability factor in ranking.
- **FR-28a** **Workload is measured in hours served**: the sum of the shift lengths a member was assigned to in the term (excused and cancelled don't count). A 2-hour ushering shift counts 2; three 9-hour summit days count 27. Ranking favours members with fewer hours, and members see "Hours served this term" on their home page.

### 5.8 Reports and audit
- **FR-29** A fairness report per term shows:
  - hours served per member (and shift count), as a distribution chart
  - Gini coefficient of hours
  - top-10% share
  - never-assigned list
  - no-show rate
  - AI vs manual share
  - override rate
  - CSV export
- **FR-30** An audit log records access decisions, role changes, event changes, assignment create/cancel/override, and attendance. Advisers can filter it.

### 5.9 Settings (advisers)
- **FR-31** Settings include:
  - allowed email domain
  - `assignment.requireSchedule`
  - scoring weights (load, recency, reliability)
  - AI turn limit per hour
  - school-year start month (for "new member")

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Cost:** ₱0/month at ≤ 300 members, ≤ 30 events/month, ≤ 20 advisers |
| NFR-2 | **Performance:** non-AI API p95 ≤ 500 ms; AI turn p95 ≤ 6 s including LLM; first page load ≤ 2.5 s on 4G |
| NFR-3 | **Availability:** best effort on free tiers. AI degrades gracefully: provider fallback, then manual constraint editing. |
| NFR-4 | **Privacy:** no member names, emails, student numbers or other PII sent to LLM providers. Only the adviser's message, constraint state, catalog codes and event time are sent. |
| NFR-5 | **Security:** every API route enforces role checks on the server; all input validated with Zod; audit log for sensitive actions |
| NFR-6 | **Accessibility:** WCAG 2.2 AA contrast and keyboard navigation (see Design Brief §8) |
| NFR-7 | **Responsiveness:** all screens usable at 360 px width; the AssignAI panel becomes a full-screen sheet on mobile |
| NFR-8 | **Timezone:** all dates and times are Asia/Manila local, with no conversion (the Philippines has no daylight saving) |
| NFR-9 | **Language:** UI in English. The AI understands English, Filipino and Taglish and replies in the adviser's language. |

## 7. Success metrics (review after first full term)

1. Hard-rule violations among finalized assignments = 0.
2. Gini of hours served per eligible member ≤ 0.35.
3. AI pick acceptance ≥ 90% (picks approved without removal).
4. ≥ 90% of active members submit their schedule within 2 weeks of term start.
5. Adviser satisfaction survey ≥ 4/5.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Free LLM tier limits or terms change | Provider abstraction (Gemini primary, Groq fallback) plus manual constraint editing as the final fallback |
| Members don't submit schedules | `assignment.requireSchedule` gate, dashboard banner, adviser report of missing schedules |
| Gemini free tier may use prompts to improve Google products | NFR-4: no PII leaves the system |
| Cloudflare free limits (10 ms CPU, 50 subrequests) | Bulk queries (≤ 12 per AI turn), pure in-memory ranking, no password hashing (OAuth only) |
| Advisers distrust AI picks | Visible constraints, score breakdowns, exclusion reasons, human approval |

## 9. Decisions and open questions

### Decided (2026-11-10)

| # | Question | Decision |
|---|---|---|
| D1 | Do all members use `@umindanao.edu.ph` Google accounts? | Yes → FR-4 restricts to that domain by default |
| D2 | Can events span multiple days or cross midnight? | Yes → FR-13/13a, `start_at`/`end_at` model (Backend Schema §4) |
| D3 | Who is assignable; are there officers? | No officers. Two roles only: adviser and member. Only members are assignable. |
| D4 | "New member" definition | Batch year = current school year (Backend Schema §6) |
| D5 | One volunteer for the whole multi-day event, or different people per day? | It varies → events have **shifts** (FR-13–13b); AssignAI supports same-team and per-shift modes (FR-19) |
| D6 | How does a long event count toward workload? | **Hours served** (FR-28a) |

### Still open

1. UMAL logo files (SVG) and permission to show the UM wordmark. Mark will provide them; see Design Brief §2.
