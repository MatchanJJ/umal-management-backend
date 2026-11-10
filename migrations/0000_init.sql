CREATE TABLE `access_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text COLLATE NOCASE NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`source` text NOT NULL,
	`decided_by` integer,
	`decided_at` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`decided_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "access_requests_status" CHECK("access_requests"."status" IN ('pending', 'approved', 'rejected')),
	CONSTRAINT "access_requests_role" CHECK("access_requests"."role" IN ('member', 'adviser')),
	CONSTRAINT "access_requests_source" CHECK("access_requests"."source" IN ('sign_in', 'bulk'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_requests_email_unique` ON `access_requests` (`email`);--> statement-breakpoint
CREATE INDEX `access_requests_status_idx` ON `access_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`created_by` integer NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`constraints_json` text NOT NULL,
	`pins_json` text DEFAULT '{"include":[],"exclude":[]}' NOT NULL,
	`scope_json` text NOT NULL,
	`last_result_json` text,
	`outcome_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_sessions_status" CHECK("ai_sessions"."status" IN ('open', 'approved', 'abandoned'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_sessions_one_open` ON `ai_sessions` (`event_id`,`created_by`) WHERE "ai_sessions"."status" = 'open';--> statement-breakpoint
CREATE TABLE `ai_turns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`created_by` integer NOT NULL,
	`kind` text NOT NULL,
	`user_message` text,
	`reply` text,
	`assumptions_json` text DEFAULT '[]' NOT NULL,
	`constraints_json` text NOT NULL,
	`provider` text NOT NULL,
	`model` text,
	`latency_ms` integer,
	`error` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `ai_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_turns_kind" CHECK("ai_turns"."kind" IN ('update', 'answer', 'clarify', 'confirm_request', 'manual_edit')),
	CONSTRAINT "ai_turns_provider" CHECK("ai_turns"."provider" IN ('gemini', 'groq', 'none'))
);
--> statement-breakpoint
CREATE INDEX `ai_turns_session` ON `ai_turns` (`session_id`,`id`);--> statement-breakpoint
CREATE INDEX `ai_turns_rate` ON `ai_turns` (`created_by`,`created_at`);--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`shift_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`source` text NOT NULL,
	`ai_session_id` integer,
	`conflict_override` integer DEFAULT false NOT NULL,
	`assigned_by` integer NOT NULL,
	`assigned_at` text NOT NULL,
	`attendance_marked_by` integer,
	`attendance_marked_at` text,
	`cancelled_by` integer,
	`cancelled_at` text,
	`cancel_reason` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ai_session_id`) REFERENCES `ai_sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`attendance_marked_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`cancelled_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assignments_status" CHECK("assignments"."status" IN ('assigned', 'attended', 'no_show', 'excused', 'cancelled')),
	CONSTRAINT "assignments_source" CHECK("assignments"."source" IN ('ai', 'manual')),
	CONSTRAINT "assignments_cancel_fields" CHECK("assignments"."status" <> 'cancelled' OR ("assignments"."cancelled_at" IS NOT NULL AND "assignments"."cancel_reason" IS NOT NULL)),
	CONSTRAINT "assignments_ai_session" CHECK("assignments"."source" <> 'ai' OR "assignments"."ai_session_id" IS NOT NULL)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `assignments_one_active` ON `assignments` (`shift_id`,`member_id`) WHERE "assignments"."status" <> 'cancelled';--> statement-breakpoint
CREATE INDEX `assignments_member_status` ON `assignments` (`member_id`,`status`);--> statement-breakpoint
CREATE INDEX `assignments_event` ON `assignments` (`event_id`,`status`);--> statement-breakpoint
CREATE INDEX `assignments_shift` ON `assignments` (`shift_id`,`status`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor_id` integer,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer,
	`data_json` text DEFAULT '{}' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_entity` ON `audit_log` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_actor_time` ON `audit_log` (`actor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `audit_time` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `class_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`schedule_id` integer NOT NULL,
	`day_of_week` integer NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`label` text,
	FOREIGN KEY (`schedule_id`) REFERENCES `class_schedules`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "class_entries_day" CHECK("class_entries"."day_of_week" BETWEEN 1 AND 7),
	CONSTRAINT "class_entries_times" CHECK("class_entries"."start_time" < "class_entries"."end_time")
);
--> statement-breakpoint
CREATE INDEX `class_entries_schedule_day` ON `class_entries` (`schedule_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `class_schedules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`term_id` integer NOT NULL,
	`submitted_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_schedules_member_term` ON `class_schedules` (`member_id`,`term_id`);--> statement-breakpoint
CREATE TABLE `colleges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `colleges_code_unique` ON `colleges` (`code`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`college_id` integer NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `courses_college_code` ON `courses` (`college_id`,`code`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`term_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`venue` text,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`cancel_reason` text,
	`version` integer DEFAULT 0 NOT NULL,
	`created_by` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "events_status" CHECK("events"."status" IN ('draft', 'published', 'completed', 'cancelled')),
	CONSTRAINT "events_span" CHECK("events"."start_at" < "events"."end_at")
);
--> statement-breakpoint
CREATE INDEX `events_start` ON `events` (`start_at`);--> statement-breakpoint
CREATE INDEX `events_end` ON `events` (`end_at`);--> statement-breakpoint
CREATE INDEX `events_term_status` ON `events` (`term_id`,`status`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`email` text COLLATE NOCASE NOT NULL,
	`role` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`first_name` text,
	`last_name` text,
	`student_number` text,
	`gender` text,
	`college_id` integer,
	`course_id` integer,
	`year_level` integer,
	`batch_year` integer,
	`height_cm` integer,
	`tshirt_size` text,
	`onboarded_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`college_id`) REFERENCES `colleges`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "members_role" CHECK("members"."role" IN ('member', 'adviser')),
	CONSTRAINT "members_status" CHECK("members"."status" IN ('active', 'inactive')),
	CONSTRAINT "members_gender" CHECK("members"."gender" IN ('M', 'F')),
	CONSTRAINT "members_year_level" CHECK("members"."year_level" BETWEEN 1 AND 5),
	CONSTRAINT "members_batch_year" CHECK("members"."batch_year" BETWEEN 2000 AND 2100),
	CONSTRAINT "members_height" CHECK("members"."height_cm" BETWEEN 100 AND 230),
	CONSTRAINT "members_tshirt" CHECK("members"."tshirt_size" IN ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id_unique` ON `members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_email_unique` ON `members` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_student_number_unique` ON `members` (`student_number`);--> statement-breakpoint
CREATE INDEX `members_role_status` ON `members` (`role`,`status`);--> statement-breakpoint
CREATE INDEX `members_college` ON `members` (`college_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_by` integer,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`updated_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`label` text NOT NULL,
	`start_at` text NOT NULL,
	`end_at` text NOT NULL,
	`required_volunteers` integer NOT NULL,
	`position` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shifts_required" CHECK("shifts"."required_volunteers" BETWEEN 1 AND 200),
	CONSTRAINT "shifts_span" CHECK("shifts"."start_at" < "shifts"."end_at")
);
--> statement-breakpoint
CREATE INDEX `shifts_event` ON `shifts` (`event_id`,`position`);--> statement-breakpoint
CREATE INDEX `shifts_time` ON `shifts` (`start_at`,`end_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `shifts_event_label` ON `shifts` (`event_id`,`label`);--> statement-breakpoint
CREATE TABLE `terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT "terms_dates" CHECK("terms"."start_date" < "terms"."end_date")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `terms_name_unique` ON `terms` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `terms_one_active` ON `terms` (`is_active`) WHERE "terms"."is_active" = 1;--> statement-breakpoint
CREATE TABLE `unavailability` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`term_id` integer NOT NULL,
	`kind` text NOT NULL,
	`day_of_week` integer,
	`date` text,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`reason` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`term_id`) REFERENCES `terms`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "unavailability_kind" CHECK("unavailability"."kind" IN ('weekly', 'date')),
	CONSTRAINT "unavailability_day" CHECK("unavailability"."day_of_week" BETWEEN 1 AND 7),
	CONSTRAINT "unavailability_times" CHECK("unavailability"."start_time" < "unavailability"."end_time"),
	CONSTRAINT "unavailability_kind_fields" CHECK(("unavailability"."kind" = 'weekly' AND "unavailability"."day_of_week" IS NOT NULL AND "unavailability"."date" IS NULL) OR ("unavailability"."kind" = 'date' AND "unavailability"."date" IS NOT NULL AND "unavailability"."day_of_week" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `unavailability_member_term` ON `unavailability` (`member_id`,`term_id`);--> statement-breakpoint
CREATE INDEX `unavailability_date` ON `unavailability` (`date`) WHERE "unavailability"."kind" = 'date';--> statement-breakpoint
CREATE TABLE `write_guards` (
	`ok` integer NOT NULL,
	CONSTRAINT "write_guards_ok" CHECK("write_guards"."ok" = 1)
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);