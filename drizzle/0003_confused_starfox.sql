CREATE TABLE `conflicts` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`field_key` text NOT NULL,
	`local_value_json` text NOT NULL,
	`server_value_json` text NOT NULL,
	`detected_at` integer NOT NULL
);
