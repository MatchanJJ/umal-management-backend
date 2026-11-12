import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { MemberListQuery, MemberPatch, type MemberDetail, type MemberHistoryItem, type MemberListItem, type MemberStats } from '../../shared/api';
import { getDb } from '../db/client';
import * as schema from '../db/schema';
import type { AppEnv } from '../env';
import { apiError } from '../errors';
import { requireAdviser } from '../middleware/auth';
import { updateMember } from '../services/members';
import { validate } from '../validate';
import { toMemberDTO } from './me';

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const NAME = `COALESCE(NULLIF(TRIM(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), ''), m.email)`;
const like = (s: string) => `%${s.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

// Members directory and detail (App Flow §2), role/status changes (TRD §5 lock-out guards).
export const members = new Hono<AppEnv>()
  .use(...requireAdviser)
  .get('/', validate('query', MemberListQuery), async (c) => {
    const D = c.env.DB;
    const q = c.req.valid('query');
    const term = await D.prepare(`SELECT id FROM terms WHERE is_active = 1`).first<{ id: number }>();
    const binds: unknown[] = [];
    const p = (v: unknown) => (binds.push(v), `?${binds.length}`);
    const submitted = term ? `EXISTS (SELECT 1 FROM class_schedules cs WHERE cs.member_id = m.id AND cs.term_id = ${p(term.id)})` : '0';
    const where: string[] = [];
    if (q.search) {
      const s = p(like(q.search));
      where.push(`(${NAME} LIKE ${s} ESCAPE '\\' OR m.email LIKE ${s} ESCAPE '\\' OR m.student_number LIKE ${s} ESCAPE '\\')`);
    }
    if (q.college) where.push(`c.code = ${p(q.college.toUpperCase())}`);
    if (q.yearLevel) where.push(`m.year_level = ${p(q.yearLevel)}`);
    if (q.role) where.push(`m.role = ${p(q.role)}`);
    if (q.status) where.push(`m.status = ${p(q.status)}`);
    if (q.schedule) where.push(q.schedule === 'submitted' ? submitted : `NOT ${submitted}`);
    const from = `FROM members m LEFT JOIN colleges c ON c.id = m.college_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`;

    const [rows, count] = await D.batch([
      D.prepare(
        `SELECT m.id, ${NAME} AS name, m.email, m.student_number AS studentNumber, m.role, m.status, c.code AS collegeCode, m.year_level AS yearLevel,
                m.onboarded_at IS NOT NULL AS onboarded, ${submitted} AS scheduleSubmitted
         ${from} ORDER BY m.last_name IS NULL, m.last_name COLLATE NOCASE, m.first_name COLLATE NOCASE, m.email
         LIMIT ${q.pageSize} OFFSET ${(q.page - 1) * q.pageSize}`, // validated integers
      ).bind(...binds),
      // Same bindings, so the count selects the schedule flag too (D1 rejects unused parameters).
      D.prepare(`SELECT COUNT(*) AS n FROM (SELECT ${submitted} ${from})`).bind(...binds),
    ]);
    const items = (rows.results as (Omit<MemberListItem, 'onboarded' | 'scheduleSubmitted'> & { onboarded: number; scheduleSubmitted: number })[]).map((r) => ({
      ...r,
      onboarded: r.onboarded === 1,
      scheduleSubmitted: r.scheduleSubmitted === 1,
    }));
    return c.json({ items, total: (count.results[0] as { n: number }).n });
  })

  .get('/:id', validate('param', IdParam), async (c) => {
    const id = c.req.valid('param').id;
    const db = getDb(c.env);
    const D = c.env.DB;
    const [m, term] = await Promise.all([
      db.select().from(schema.members).where(eq(schema.members.id, id)).get(),
      db.select().from(schema.terms).where(eq(schema.terms.isActive, true)).get(),
    ]);
    if (!m) return apiError(c, 404, 'NOT_FOUND', 'Member not found');
    const termId = term?.id ?? 0;
    const [names, stats, history] = await D.batch([
      D.prepare(
        `SELECT (SELECT code FROM colleges WHERE id = ?1) AS collegeCode, (SELECT name FROM courses WHERE id = ?2) AS courseName,
                EXISTS (SELECT 1 FROM class_schedules WHERE member_id = ?3 AND term_id = ?4) AS scheduleSubmitted`,
      ).bind(m.collegeId, m.courseId, id, termId),
      // Same counting rules as the fairness report (Schema §8.2), plus excused.
      D.prepare(
        `SELECT COALESCE(SUM(CASE WHEN a.status IN ('assigned','attended','no_show') THEN (julianday(s.end_at) - julianday(s.start_at)) * 24 END), 0) AS hours,
                COALESCE(SUM(a.status IN ('assigned','attended','no_show')), 0) AS shifts,
                COALESCE(SUM(a.status = 'attended'), 0) AS attended, COALESCE(SUM(a.status = 'no_show'), 0) AS noShow, COALESCE(SUM(a.status = 'excused'), 0) AS excused
         FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
         WHERE a.member_id = ?1 AND e.term_id = ?2`,
      ).bind(id, termId),
      D.prepare(
        `SELECT a.id, a.event_id AS eventId, e.title AS eventTitle, s.label AS shiftLabel, s.start_at AS startAt, s.end_at AS endAt, a.status, a.source
         FROM assignments a JOIN shifts s ON s.id = a.shift_id JOIN events e ON e.id = a.event_id
         WHERE a.member_id = ?1 ORDER BY s.start_at DESC LIMIT 100`,
      ).bind(id),
    ]);
    const n = names.results[0] as { collegeCode: string | null; courseName: string | null; scheduleSubmitted: number };
    const st = stats.results[0] as MemberStats;
    const body: MemberDetail = {
      member: toMemberDTO(m),
      collegeCode: n.collegeCode,
      courseName: n.courseName,
      activeTerm: term ? { id: term.id, name: term.name, startDate: term.startDate, endDate: term.endDate, isActive: true } : null,
      scheduleSubmitted: n.scheduleSubmitted === 1,
      stats: { ...st, hours: Math.round(st.hours * 100) / 100 },
      assignments: history.results as MemberHistoryItem[],
    };
    return c.json(body);
  })

  .patch('/:id', validate('param', IdParam), validate('json', MemberPatch), async (c) => {
    const r = await updateMember(getDb(c.env), c.get('member')!.id, c.req.valid('param').id, c.req.valid('json'));
    return r.ok ? c.json(r.member) : apiError(c, r.status, r.code, r.message);
  });
