CREATE TABLE `spotify_auth` (
	`id` text PRIMARY KEY NOT NULL,
	`refresh_token` text NOT NULL,
	`scope` text,
	`owner_display_name` text,
	`updated_at` integer NOT NULL
);
