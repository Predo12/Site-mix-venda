CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`access_token` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`assigned_to` text,
	`last_message_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_conversations_token` ON `conversations` (`access_token`);--> statement-breakpoint
CREATE INDEX `idx_conversations_status_last` ON `conversations` (`status`,`last_message_at`);--> statement-breakpoint
CREATE TABLE `delivery_zones` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`neighborhood` text NOT NULL,
	`fee_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_delivery_zones_neighborhood` ON `delivery_zones` (`neighborhood`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`conversation_id` text NOT NULL,
	`sender_type` text NOT NULL,
	`sender_name` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_messages_conversation` ON `messages` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `order_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`from_status` text,
	`to_status` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_order_events_order` ON `order_events` (`order_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `orders` (
	`id` text PRIMARY KEY NOT NULL,
	`order_number` text NOT NULL,
	`customer_name` text NOT NULL,
	`customer_phone` text NOT NULL,
	`fulfillment_type` text NOT NULL,
	`cep` text,
	`street` text,
	`street_number` text,
	`complement` text,
	`neighborhood` text,
	`city` text,
	`items_json` text NOT NULL,
	`subtotal_cents` integer NOT NULL,
	`delivery_fee_cents` integer DEFAULT 0 NOT NULL,
	`payment_method` text NOT NULL,
	`payment_fee_cents` integer DEFAULT 0 NOT NULL,
	`total_cents` integer NOT NULL,
	`notes` text,
	`age_confirmed` integer DEFAULT false NOT NULL,
	`age_confirmed_at` integer,
	`status` text DEFAULT 'new' NOT NULL,
	`eta_min` integer DEFAULT 40 NOT NULL,
	`eta_max` integer DEFAULT 60 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_orders_order_number` ON `orders` (`order_number`);--> statement-breakpoint
CREATE INDEX `idx_orders_status_created` ON `orders` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_staff_email` ON `staff` (`email`);