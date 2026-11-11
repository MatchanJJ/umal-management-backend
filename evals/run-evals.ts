// AssignAI eval runner (TRD §7.6). Uses the real providers from .dev.vars; prints accuracy by category and
// exits 1 below the ship gate: ≥ 95 % overall and 100 % on confirm_request and conflicts-default cases.
//   pnpm evals                       all cases
//   pnpm evals --only=confirm        one category
//   pnpm evals --id=new_098 --verbose
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { interpret } from '../server/ai/interpret';
import { providersFromEnv } from '../server/ai/providers';
import { buildVocabulary } from '../server/ai/vocabulary';
import type { Env } from '../server/env';
import { judge, type EvalCase } from './judge';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=') as [string, string?]));
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 1500); // stay under free-tier requests-per-minute

function devVars(): Record<string, string> {
  const text = readFileSync('.dev.vars', 'utf8');
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

// The same 14 colleges production seeds (migrations/0001_seed.sql), so the vocabulary has one source.
const colleges = [...readFileSync('migrations/0001_seed.sql', 'utf8').matchAll(/\('([A-Z]+)',\s*'([^']+)'/g)].map((m) => ({ code: m[1], name: m[2] }));

const vars = devVars();
const env = { ...vars, ENV: 'local', AI_PROVIDER: undefined } as unknown as Env; // never the e2e fake
const providers = providersFromEnv(env);
if (!providers.length) {
  console.error('No GEMINI_API_KEY or GROQ_API_KEY in .dev.vars — nothing to evaluate.');
  process.exit(2);
}

let cases = JSON.parse(readFileSync('evals/cases.json', 'utf8')) as EvalCase[];
if (args.only) cases = cases.filter((c) => c.category === args.only || c.gate === args.only);
if (args.id) cases = cases.filter((c) => c.id === args.id);
if (args.limit) cases = cases.slice(0, Number(args.limit));

const vocab = buildVocabulary(colleges);
const vocabCodes = new Set(colleges.map((c) => c.code));
const shifts = ['Day 1', 'Day 2', 'Day 3'].map((label, i) => ({
  label,
  startAt: `2027-03-0${4 + i}T08:00`,
  endAt: `2027-03-0${4 + i}T17:00`,
  weekdays: [['Thu', 'Fri', 'Sat'][i]],
  required: 30,
  remaining: 30,
}));

type Row = { id: string; category: string; gate?: string; pass: boolean; why?: string; provider: string; latencyMs: number; message: string; kind: string };
const rows: Row[] = [];
console.log(`Running ${cases.length} cases against ${providers.map((p) => `${p.name}:${p.model}`).join(' → ')}\n`);

for (const [i, c] of cases.entries()) {
  // Team-mode cases get a 3-shift event; everything else a single shift.
  const scope = c.category === 'team_mode' ? shifts : shifts.slice(0, 1);
  const r = await interpret(
    providers,
    { vocab, shifts: scope, totalShifts: scope.length, constraints: c.currentConstraints, history: c.history, message: c.message },
    { vocabCodes, remainingByShift: scope.map((s) => ({ label: s.label, remaining: s.remaining })) },
  );
  const verdict = r.provider === 'none' ? { pass: false, why: `no provider answered (${r.error})` } : judge(c, r.output);
  rows.push({ id: c.id, category: c.category, gate: c.gate, ...verdict, provider: r.provider, latencyMs: r.latencyMs, message: c.message, kind: r.output.kind });
  const mark = verdict.pass ? '✓' : '✗';
  process.stdout.write(`${mark} ${c.id.padEnd(9)} ${c.category.padEnd(16)} ${r.provider.padEnd(6)} ${String(r.latencyMs).padStart(5)}ms  ${c.message.slice(0, 60)}\n`);
  if (!verdict.pass) process.stdout.write(`    ↳ ${verdict.why}\n`);
  if ('verbose' in args) process.stdout.write(`    ${JSON.stringify(r.output)}\n`);
  if (i < cases.length - 1) await new Promise((res) => setTimeout(res, DELAY_MS));
}

const pct = (xs: Row[]) => (xs.length ? (100 * xs.filter((r) => r.pass).length) / xs.length : 100);
const byCat = [...new Set(rows.map((r) => r.category))].sort();
console.log('\nCategory            Pass   Total   Accuracy');
for (const cat of byCat) {
  const xs = rows.filter((r) => r.category === cat);
  console.log(`${cat.padEnd(18)}  ${String(xs.filter((r) => r.pass).length).padStart(4)}   ${String(xs.length).padStart(5)}   ${pct(xs).toFixed(1).padStart(6)} %`);
}
const overall = pct(rows);
const gates = (['confirm_request', 'conflicts_default'] as const).map((g) => ({ g, acc: pct(rows.filter((r) => r.gate === g)), n: rows.filter((r) => r.gate === g).length }));
const providerCounts = rows.reduce<Record<string, number>>((m, r) => ((m[r.provider] = (m[r.provider] ?? 0) + 1), m), {});
console.log(`\nOverall: ${overall.toFixed(1)} % (${rows.filter((r) => r.pass).length}/${rows.length})   providers: ${JSON.stringify(providerCounts)}`);
for (const { g, acc, n } of gates) console.log(`Gate ${g}: ${acc.toFixed(1)} % of ${n}`);

mkdirSync('evals/results', { recursive: true });
writeFileSync(`evals/results/${new Date().toISOString().replace(/[:.]/g, '-')}.json`, JSON.stringify({ overall, gates, providerCounts, rows }, null, 1));

const full = !args.only && !args.id && !args.limit;
const ok = overall >= 95 && gates.every((x) => x.n === 0 || x.acc === 100);
console.log(ok ? '\nSHIP GATE: PASS' : `\nSHIP GATE: FAIL${full ? '' : ' (partial run)'}`);
process.exit(ok ? 0 : 1);
