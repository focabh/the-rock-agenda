CREATE TABLE `show_propostas` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`corpo_markdown` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_propostas_show_id_unique` ON `show_propostas` (`show_id`);--> statement-breakpoint
ALTER TABLE `venue_evaluations` ADD `nota_geral` integer;