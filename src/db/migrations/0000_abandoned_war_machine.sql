CREATE TABLE `checklist_template_items` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`texto` text NOT NULL,
	`ordem` integer NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`descricao` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contract_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`corpo_markdown` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`template_id` text,
	`conteudo_json` text,
	`pdf_path` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `contract_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `cost_calculations` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text,
	`nome_cenario` text NOT NULL,
	`transporte` integer DEFAULT 0,
	`combustivel` integer DEFAULT 0,
	`equipamento_logistica` integer DEFAULT 0,
	`ensaio` integer DEFAULT 0,
	`extras` integer DEFAULT 0,
	`margem_seguranca_pct` real DEFAULT 20,
	`cache_minimo_calc` integer DEFAULT 0,
	`cache_recomendado_calc` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`funcao` text NOT NULL,
	`telefone` text,
	`equipamentos` text,
	`disponibilidade` text,
	`percentual_divisao` real DEFAULT 0,
	`observacoes` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`setlist_id` text NOT NULL,
	`song_id` text NOT NULL,
	`ordem` integer NOT NULL,
	`tom` text,
	`duracao_seg` integer,
	`nota` text,
	FOREIGN KEY (`setlist_id`) REFERENCES `setlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`song_id`) REFERENCES `songs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `setlists` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`show_id` text,
	`duracao_estimada_seg` integer DEFAULT 0,
	`observacoes_gerais` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `show_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`show_checklist_id` text NOT NULL,
	`texto` text NOT NULL,
	`ordem` integer NOT NULL,
	`concluido` integer DEFAULT false NOT NULL,
	`responsavel_member_id` text,
	`concluido_em` integer,
	FOREIGN KEY (`show_checklist_id`) REFERENCES `show_checklists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`responsavel_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `show_checklists` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`template_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `show_day_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`horario` text,
	`descricao` text NOT NULL,
	`ordem` integer NOT NULL,
	`concluido` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `shows` (
	`id` text PRIMARY KEY NOT NULL,
	`casa_id` text NOT NULL,
	`data` integer NOT NULL,
	`inicio` text,
	`termino` text,
	`contato_nome` text,
	`contato_telefone` text,
	`cache_centavos` integer DEFAULT 0,
	`pagamento_status` text DEFAULT 'pendente' NOT NULL,
	`passagem_som` text,
	`publico_esperado` integer,
	`observacoes` text,
	`status` text DEFAULT 'planejado' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`casa_id`) REFERENCES `venues`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `songs` (
	`id` text PRIMARY KEY NOT NULL,
	`titulo` text NOT NULL,
	`artista` text NOT NULL,
	`status` text DEFAULT 'aprendendo' NOT NULL,
	`favorita` integer DEFAULT false NOT NULL,
	`observacoes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'membro' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `venue_evaluations` (
	`id` text PRIMARY KEY NOT NULL,
	`show_id` text NOT NULL,
	`qualidade_som` integer,
	`publico` integer,
	`retorno_financeiro` integer,
	`estrutura` integer,
	`hospitalidade` integer,
	`facilidade_montagem` integer,
	`tocaria_novamente` integer,
	`observacoes` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`nome` text NOT NULL,
	`endereco` text,
	`cidade` text,
	`bairro` text,
	`contato_principal` text,
	`telefone` text,
	`observacoes` text,
	`ativo` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
