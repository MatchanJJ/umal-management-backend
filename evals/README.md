# AssignAI evals

The eval suite checks that the AI turns adviser messages into the right constraints (TRD §7.6).

- **What it calls:** the **real** providers configured in `.dev.vars` (`GEMINI_API_KEY`, `GROQ_API_KEY`), in production fallback order (Gemini, then Groq), with the 2-call budget.
- **When to run it:** by hand or weekly, **not** on every PR, because of free-tier limits.

```sh
pnpm evals                     # all cases, exits 1 below the ship gate
pnpm evals --only=confirm      # one category (or a gate name: confirm_request, conflicts_default)
pnpm evals --id=new_101 --verbose
EVAL_DELAY_MS=3000 pnpm evals  # slower pacing if you hit 429s
```

Each run's results are saved under `evals/results/`, which is git-ignored.

## Ship gate

| Gate | Required |
|---|---|
| Overall accuracy | ≥ 95 % |
| `confirm_request` cases (gate `confirm_request`) | 100 % |
| Class-conflict default cases (gate `conflicts_default`) | 100 % |

If the suite is below the gate, change `server/ai/prompt.ts` only, then re-run.

## Cases (`cases.json`)

Each case has this shape:

```ts
{ id, source, category, gate?, history, currentConstraints, message, expected? | expectedAny?, note? }
```

**Sources**
- **`v1` (64 cases):** the 58 v1 functional cases from `nlp-service/tests/test_cases.json` at tag `v1-laravel`, converted to the v2 schema. Of those, 51 single-turn cases became one case each. The 6 conversations became 13 cases, one per later turn, carrying the history and current constraints. One case was dropped (see below).
- **`audit` (34):** the v1 hallucination audit from `test_semantic_parser_quality.py`. These check that no count, college or gender is invented, that the right college code and gender are picked (including Tagalog), that groups aren't collapsed, that modifiers don't reset counts, and that confirmations are recognised.
- **`new` (29):** new cases covering Tagalog gender terms, modifier-only turns (such as "lalaki lang" keeping the count), priority phrasing, confirmations ("sige", "go na", "i-assign mo na"), unknown colleges (which should get `clarify`), team mode, class-conflict defaults and questions.

**Conversion notes**
- **Tenure:** `new_old` became `tenure` (`new` / `returning`).
- **College code:** `CAFE` became `CAFAE`, the real code.
- **Heights:** inches became centimetres.
- **Priorities:** `attendance_first` became `reliable_first`, and `old_first` became `returning_first`.
- **Confirmations:** `is_confirming` became `kind: 'confirm_request'`.
- **Fixed v1 mistakes:** v1's "2 CompE students → CTE" was wrong and now expects CEE.
- **Unsupported rules:** relative height ("males taller than females") isn't supported, so that case checks the groups only.
- **Dropped case:** v1 `special_004` (a whitespace-only message) can't reach the LLM, because the API rejects empty messages.

**Matching (`judge.ts`, unit-tested)**
- **`kind` / `notKind`:** compared exactly.
- **`groups`:** the number of groups must match. Within each group, only the fields listed are compared:
  - colleges and year levels are compared in any order;
  - heights may differ by up to ±2 cm;
  - an explicit `null` or `[]` means the value must not be invented.
- **`priorities`:** every listed priority must be present, in any order. An empty list `[]` means there must be none.
- **`allowClassConflicts`, `teamMode`:** compared exactly.
- **`expectedAny`:** a case passes if any alternative matches. It's used for genuinely ambiguous phrasing, such as "freshmen" meaning either new members or year 1.
