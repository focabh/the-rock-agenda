CREATE TABLE `song_member_readiness` (
	`id` text PRIMARY KEY NOT NULL,
	`song_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'aprendendo' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_song_member` ON `song_member_readiness` (`song_id`,`member_id`);