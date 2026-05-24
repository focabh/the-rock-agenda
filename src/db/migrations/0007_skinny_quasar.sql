CREATE TABLE `show_member_payment` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`member_id` text NOT NULL,
	`valor_centavos` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_show_member_pay` ON `show_member_payment` (`show_id`,`member_id`);--> statement-breakpoint
ALTER TABLE `shows` ADD `apply_commission` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `shows` ADD `commission_pct` real DEFAULT 10 NOT NULL;