-- Seed data: colleges (Backend Schema §7) and settings defaults (Backend Schema §6).
INSERT INTO colleges (code, name, active, created_at) VALUES
  ('CAE',   'College of Accounting Education',                  1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CAFAE', 'College of Architecture and Fine Arts Education',  1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CASE',  'College of Arts and Sciences Education',           1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CBAE',  'College of Business Administration Education',     1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CCE',   'College of Computing Education',                   1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CCJE',  'College of Criminal Justice Education',            1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CEE',   'College of Engineering Education',                 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CHE',   'College of Hospitality Education',                 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CHSE',  'College of Health and Sciences Education',         1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CTE',   'College of Teacher Education',                     1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('CLE',   'College of Legal Education',                       1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('PS',    'Professional Schools',                             1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('TS',    'Technical School',                                 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('BED',   'Basic Education',                                  1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
--> statement-breakpoint
INSERT INTO settings (key, value_json, updated_by, updated_at) VALUES
  ('auth.allowedEmailDomain',   '"umindanao.edu.ph"',                             NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('assignment.requireSchedule', 'true',                                          NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('scoring.weights',           '{"load":3,"recency":1,"reliability":1}',         NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('scoring.loadUnitHours',     '4',                                              NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('ai.turnsPerHour',           '40',                                             NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('schoolYear.startMonth',     '8',                                              NULL, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
