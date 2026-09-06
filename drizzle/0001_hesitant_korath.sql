ALTER TABLE `settings` ADD `display_language` text DEFAULT 'hebrew' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `display_learning_cycles` text DEFAULT '["chumash","daf","nach","dirshu"]' NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `display_show_tefillah` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `says_morid_hatal` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `settings` ADD `kiddush_levana_from_days` integer DEFAULT 7 NOT NULL;