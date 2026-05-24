CREATE TABLE `member_unavailability` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`data_inicio` integer NOT NULL,
	`data_fim` integer NOT NULL,
	`motivo` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
