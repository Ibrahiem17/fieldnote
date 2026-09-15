PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`sync_status` text DEFAULT 'local' NOT NULL,
	`inspection_id` text NOT NULL,
	`field_key` text NOT NULL,
	`local_uri` text,
	`remote_url` text,
	`mime_type` text,
	`byte_size` integer,
	`width` integer,
	`height` integer
);
--> statement-breakpoint
INSERT INTO `__new_attachments`("id", "created_at", "updated_at", "deleted_at", "sync_status", "inspection_id", "field_key", "local_uri", "remote_url", "mime_type", "byte_size", "width", "height") SELECT "id", "created_at", "updated_at", "deleted_at", "sync_status", "inspection_id", "field_key", "local_uri", "remote_url", "mime_type", "byte_size", "width", "height" FROM `attachments`;--> statement-breakpoint
DROP TABLE `attachments`;--> statement-breakpoint
ALTER TABLE `__new_attachments` RENAME TO `attachments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `attachments_inspection_id_idx` ON `attachments` (`inspection_id`);