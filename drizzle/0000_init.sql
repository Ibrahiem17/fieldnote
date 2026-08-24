CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`inspection_id` text NOT NULL,
	`field_key` text NOT NULL,
	`value_text` text,
	`value_number` integer,
	`value_json` text
);
--> statement-breakpoint
CREATE INDEX `answers_inspection_id_idx` ON `answers` (`inspection_id`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`inspection_id` text NOT NULL,
	`field_key` text NOT NULL,
	`local_uri` text NOT NULL,
	`remote_url` text,
	`mime_type` text,
	`byte_size` integer,
	`width` integer,
	`height` integer
);
--> statement-breakpoint
CREATE INDEX `attachments_inspection_id_idx` ON `attachments` (`inspection_id`);--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`project_id` text NOT NULL,
	`template_id` text,
	`title` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`inspector_name` text,
	`started_at` integer,
	`completed_at` integer,
	`latitude` integer,
	`longitude` integer,
	`notes` text
);
--> statement-breakpoint
CREATE INDEX `inspections_project_id_idx` ON `inspections` (`project_id`);--> statement-breakpoint
CREATE INDEX `inspections_status_idx` ON `inspections` (`status`);--> statement-breakpoint
CREATE INDEX `inspections_updated_at_idx` ON `inspections` (`updated_at`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`operation` text NOT NULL,
	`payload_json` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `outbox_next_attempt_at_idx` ON `outbox` (`next_attempt_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`name` text NOT NULL,
	`client_name` text,
	`address` text,
	`latitude` integer,
	`longitude` integer
);
--> statement-breakpoint
CREATE TABLE `templates` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`name` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`schema_json` text NOT NULL
);
