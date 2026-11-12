import { env } from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

const NOW = '2026-11-10T00:00:00.000Z';
const db = () => env.DB;

async function fixture() {
  await db().batch([
    db().prepare(`INSERT INTO user (id, name, email, email_verified) VALUES ('u1','A','a@umindanao.edu.ph',1),('u2','B','b@umindanao.edu.ph',1)`),
    db().prepare(
      `INSERT INTO members (id, user_id, email, role, created_at, updated_at) VALUES
       (1,'u1','a@umindanao.edu.ph','adviser',?1,?1),(2,'u2','b@umindanao.edu.ph','member',?1,?1)`,
    ).bind(NOW),
    db().prepare(`INSERT INTO terms (id, name, start_date, end_date, is_active, created_at) VALUES (1,'T1','2026-08-01','2026-12-20',1,?1)`).bind(NOW),
    db().prepare(
      `INSERT INTO events (id, term_id, title, start_at, end_at, created_by, created_at, updated_at)
       VALUES (1,1,'Expo','2026-11-20T08:00','2026-11-21T17:00',1,?1,?1)`,
    ).bind(NOW),
    db().prepare(
      `INSERT INTO shifts (id, event_id, label, start_at, end_at, required_volunteers, position, created_at, updated_at) VALUES
       (1,1,'Day 1','2026-11-20T08:00','2026-11-20T17:00',5,1,?1,?1),
       (2,1,'Day 2','2026-11-21T08:00','2026-11-21T17:00',5,2,?1,?1)`,
    ).bind(NOW),
  ]);
}

function assign(shiftId: number, status: string) {
  const cancelled = status === 'cancelled';
  return db()
    .prepare(
      `INSERT INTO assignments (event_id, shift_id, member_id, status, source, assigned_by, assigned_at, cancelled_at, cancel_reason)
       VALUES (1, ?1, 2, ?2, 'manual', 1, ?3, ?4, ?5)`,
    )
    .bind(shiftId, status, NOW, cancelled ? NOW : null, cancelled ? 'test' : null)
    .run();
}

describe('schema', () => {
  beforeAll(fixture);

  it('seed_has_14_colleges', async () => {
    const { n } = (await db().prepare('SELECT COUNT(*) AS n FROM colleges').first<{ n: number }>())!;
    expect(n).toBe(14);
    const { results } = await db().prepare('SELECT code FROM colleges').all<{ code: string }>();
    const codes = results.map((r) => r.code);
    expect(codes).toContain('CAFAE');
    expect(codes).toContain('CLE');
  });

  it('seed_has_um_courses_without_professional_schools', async () => {
    const { results } = await db()
      .prepare(`SELECT c.code AS college, COUNT(*) AS n FROM courses k JOIN colleges c ON c.id = k.college_id GROUP BY c.code ORDER BY c.code`)
      .all<{ college: string; n: number }>();
    expect(Object.fromEntries(results.map((r) => [r.college, r.n]))).toEqual({
      CAE: 3, CAFAE: 3, CASE: 9, CBAE: 8, CCE: 5, CCJE: 1, CEE: 9, CHE: 2, CHSE: 4, CTE: 8, TS: 4,
    }); // no CLE (law) or PS (graduate) programs
    expect(await db().prepare(`SELECT name FROM colleges WHERE code = 'CHSE'`).first()).toEqual({ name: 'College of Health Sciences Education' });
  });

  it('seed_has_settings_defaults', async () => {
    const { results } = await db().prepare('SELECT key, value_json FROM settings ORDER BY key').all<{ key: string; value_json: string }>();
    expect(Object.fromEntries(results.map((r) => [r.key, JSON.parse(r.value_json)]))).toEqual({
      'ai.turnsPerHour': 40,
      'assignment.requireSchedule': true,
      'auth.allowedEmailDomain': 'umindanao.edu.ph',
      'schoolYear.startMonth': 8,
      'scoring.loadUnitHours': 4,
      'scoring.weights': { load: 3, recency: 1, reliability: 1 },
    });
  });

  it('one_active_assignment_per_member_shift', async () => {
    await assign(1, 'cancelled');
    await assign(1, 'assigned'); // cancelled + assigned on the same shift is fine
    await expect(assign(1, 'assigned')).rejects.toThrow(/UNIQUE/);
    await assign(2, 'assigned'); // same member, other shift of the same event
    const { n } = (await db().prepare('SELECT COUNT(*) AS n FROM assignments WHERE member_id = 2').first<{ n: number }>())!;
    expect(n).toBe(3);
  });

  it('write_guard_rejects_zero', async () => {
    await expect(db().prepare('INSERT INTO write_guards(ok) VALUES (0)').run()).rejects.toThrow(/CHECK/);
  });

  it('unavailability_kind_check', async () => {
    await expect(
      db()
        .prepare(
          `INSERT INTO unavailability (member_id, term_id, kind, day_of_week, date, start_time, end_time, created_at)
           VALUES (2, 1, 'weekly', 1, '2026-11-20', '08:00', '10:00', ?1)`,
        )
        .bind(NOW)
        .run(),
    ).rejects.toThrow(/CHECK/);
  });

  it('member_email_is_case_insensitive_unique', async () => {
    await db().prepare(`INSERT INTO user (id, name, email, email_verified) VALUES ('u3','C','c@umindanao.edu.ph',1)`).run();
    await expect(
      db()
        .prepare(`INSERT INTO members (user_id, email, role, created_at, updated_at) VALUES ('u3','A@UMINDANAO.EDU.PH','member',?1,?1)`)
        .bind(NOW)
        .run(),
    ).rejects.toThrow(/UNIQUE/);
  });
});
