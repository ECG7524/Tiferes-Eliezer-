CREATE TABLE `aliyos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`parsha` text DEFAULT '',
	`occasion_label` text DEFAULT '',
	`aliyah` text DEFAULT 'kohen' NOT NULL,
	`recipient_user_id` integer,
	`recipient_name` text DEFAULT '' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`pledge_id` integer,
	`status` text DEFAULT 'pledged' NOT NULL,
	`notes` text DEFAULT '',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pledge_id`) REFERENCES `pledges`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `aliyos_date_idx` ON `aliyos` (`date`);--> statement-breakpoint
CREATE INDEX `aliyos_recipient_idx` ON `aliyos` (`recipient_user_id`);--> statement-breakpoint
CREATE TABLE `announcements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`audience` text DEFAULT 'public' NOT NULL,
	`publish_at` integer DEFAULT (unixepoch()) NOT NULL,
	`expires_at` integer,
	`pinned` integer DEFAULT false NOT NULL,
	`show_on_display` integer DEFAULT true NOT NULL,
	`author_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `announcements_publish_idx` ON `announcements` (`publish_at`);--> statement-breakpoint
CREATE TABLE `donation_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`name_he` text DEFAULT '',
	`description` text DEFAULT '',
	`kind` text DEFAULT 'general' NOT NULL,
	`suggested_amounts` text DEFAULT '[1800,3600,5400,10000]' NOT NULL,
	`allow_custom_amount` integer DEFAULT true NOT NULL,
	`goal_cents` integer DEFAULT 0,
	`active` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `donation_categories_slug_idx` ON `donation_categories` (`slug`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '',
	`start_at` integer NOT NULL,
	`end_at` integer,
	`location` text DEFAULT '',
	`show_on_display` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_start_idx` ON `events` (`start_at`);--> statement-breakpoint
CREATE TABLE `minyanim` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_he` text DEFAULT '',
	`day_type` text DEFAULT 'weekday' NOT NULL,
	`time_type` text DEFAULT 'fixed' NOT NULL,
	`fixed_time` text DEFAULT '07:00',
	`relative_to` text DEFAULT 'sunset',
	`offset_minutes` integer DEFAULT 0 NOT NULL,
	`round_to` integer DEFAULT 0 NOT NULL,
	`round_direction` text DEFAULT 'earlier' NOT NULL,
	`location` text DEFAULT 'Main Shul',
	`notes` text DEFAULT '',
	`active` integer DEFAULT true NOT NULL,
	`show_on_display` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `minyanim_day_idx` ON `minyanim` (`day_type`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`pledge_id` integer,
	`user_id` integer,
	`donor_name` text NOT NULL,
	`donor_email` text DEFAULT '',
	`category_id` integer,
	`amount_cents` integer NOT NULL,
	`method` text DEFAULT 'cash' NOT NULL,
	`reference` text DEFAULT '',
	`stripe_session_id` text DEFAULT '',
	`stripe_payment_intent` text DEFAULT '',
	`status` text DEFAULT 'succeeded' NOT NULL,
	`paid_at` integer DEFAULT (unixepoch()) NOT NULL,
	`notes` text DEFAULT '',
	`recorded_by_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`pledge_id`) REFERENCES `pledges`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `donation_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`recorded_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `payments_pledge_idx` ON `payments` (`pledge_id`);--> statement-breakpoint
CREATE INDEX `payments_user_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_stripe_idx` ON `payments` (`stripe_session_id`);--> statement-breakpoint
CREATE INDEX `payments_paid_at_idx` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE TABLE `pledges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`donor_name` text NOT NULL,
	`donor_email` text DEFAULT '',
	`donor_phone` text DEFAULT '',
	`category_id` integer,
	`amount_cents` integer NOT NULL,
	`occasion` text DEFAULT '',
	`dedication` text DEFAULT '',
	`anonymous` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`due_date` text DEFAULT '',
	`notes` text DEFAULT '',
	`created_by_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`category_id`) REFERENCES `donation_categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `pledges_user_idx` ON `pledges` (`user_id`);--> statement-breakpoint
CREATE INDEX `pledges_status_idx` ON `pledges` (`status`);--> statement-breakpoint
CREATE TABLE `seats` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`section` text DEFAULT 'Main' NOT NULL,
	`row` text DEFAULT 'A' NOT NULL,
	`number` integer DEFAULT 1 NOT NULL,
	`label` text DEFAULT '',
	`price_cents` integer DEFAULT 50000 NOT NULL,
	`year` integer DEFAULT 5786 NOT NULL,
	`holder_user_id` integer,
	`holder_name` text DEFAULT '',
	`status` text DEFAULT 'available' NOT NULL,
	`pledge_id` integer,
	`notes` text DEFAULT '',
	FOREIGN KEY (`holder_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pledge_id`) REFERENCES `pledges`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seats_unique_idx` ON `seats` (`year`,`section`,`row`,`number`);--> statement-breakpoint
CREATE INDEX `seats_year_idx` ON `seats` (`year`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`name_he` text DEFAULT 'קהל תפארת אליעזר' NOT NULL,
	`name_en` text DEFAULT 'Kehal Tiferes Eliezer' NOT NULL,
	`dedication_he` text DEFAULT 'ע"ש הרה"ג ר'' אליעזר געלדצעהלער זצ"ל' NOT NULL,
	`nasi_he` text DEFAULT 'בנשיאות הרה"ג ר'' יוסף האלפערט שליט"א' NOT NULL,
	`address_line` text DEFAULT '1146 N Maple Ave' NOT NULL,
	`city` text DEFAULT 'Toms River' NOT NULL,
	`state` text DEFAULT 'NJ' NOT NULL,
	`zip` text DEFAULT '08755' NOT NULL,
	`phone` text DEFAULT '',
	`email` text DEFAULT '',
	`latitude` real DEFAULT 40.0334 NOT NULL,
	`longitude` real DEFAULT -74.2129 NOT NULL,
	`elevation` real DEFAULT 12 NOT NULL,
	`timezone` text DEFAULT 'America/New_York' NOT NULL,
	`candle_lighting_minutes` integer DEFAULT 18 NOT NULL,
	`havdalah_minutes` integer DEFAULT 50 NOT NULL,
	`tzais_opinion` text DEFAULT 'geonim_8_5' NOT NULL,
	`alos_opinion` text DEFAULT 'degrees_16_1' NOT NULL,
	`in_israel` integer DEFAULT false NOT NULL,
	`currency` text DEFAULT 'usd' NOT NULL,
	`default_kiddush_cents` integer DEFAULT 36000 NOT NULL,
	`default_shalosh_seudos_cents` integer DEFAULT 18000 NOT NULL,
	`default_seat_cents` integer DEFAULT 50000 NOT NULL,
	`default_aliyah_cents` integer DEFAULT 3600 NOT NULL,
	`display_rotate_seconds` integer DEFAULT 20 NOT NULL,
	`display_show_yahrzeits` integer DEFAULT true NOT NULL,
	`display_show_sponsors` integer DEFAULT true NOT NULL,
	`display_show_daf` integer DEFAULT true NOT NULL,
	`display_message` text DEFAULT '',
	`require_approval` integer DEFAULT true NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shiurim` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`title_he` text DEFAULT '',
	`maggid_shiur` text DEFAULT '',
	`description` text DEFAULT '',
	`location` text DEFAULT 'Beis Medrash',
	`recurrence` text DEFAULT 'weekly' NOT NULL,
	`day_of_week` integer,
	`specific_date` text DEFAULT '',
	`time_type` text DEFAULT 'fixed' NOT NULL,
	`start_time` text DEFAULT '20:00',
	`relative_to` text DEFAULT 'sunset',
	`offset_minutes` integer DEFAULT 0 NOT NULL,
	`duration_minutes` integer DEFAULT 45 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`show_on_display` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `shiurim_day_idx` ON `shiurim` (`day_of_week`);--> statement-breakpoint
CREATE TABLE `sponsorships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text DEFAULT 'kiddush' NOT NULL,
	`date` text NOT NULL,
	`label` text DEFAULT '',
	`sponsor_user_id` integer,
	`sponsor_name` text DEFAULT '',
	`occasion` text DEFAULT '',
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`pledge_id` integer,
	`status` text DEFAULT 'open' NOT NULL,
	`co_sponsors` text DEFAULT '',
	`notes` text DEFAULT '',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`sponsor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`pledge_id`) REFERENCES `pledges`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `sponsorships_date_idx` ON `sponsorships` (`date`);--> statement-breakpoint
CREATE INDEX `sponsorships_kind_date_idx` ON `sponsorships` (`kind`,`date`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`hebrew_name` text DEFAULT '',
	`phone` text DEFAULT '',
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text DEFAULT '',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `yahrzeits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`nifter_name` text NOT NULL,
	`nifter_name_he` text DEFAULT '',
	`relationship` text DEFAULT '',
	`hebrew_day` integer NOT NULL,
	`hebrew_month` integer NOT NULL,
	`hebrew_year` integer NOT NULL,
	`gregorian_date` text DEFAULT '',
	`show_on_display` integer DEFAULT true NOT NULL,
	`notes` text DEFAULT '',
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `yahrzeits_user_idx` ON `yahrzeits` (`user_id`);--> statement-breakpoint
CREATE INDEX `yahrzeits_heb_idx` ON `yahrzeits` (`hebrew_month`,`hebrew_day`);