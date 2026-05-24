CREATE TABLE `show_member_presence` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`member_id` text NOT NULL,
	`status` text DEFAULT 'pendente' NOT NULL,
	`observacao` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `members` ADD `user_id` text REFERENCES users(id);