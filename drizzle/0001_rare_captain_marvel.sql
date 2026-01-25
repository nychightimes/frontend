CREATE TABLE `chat_conversations` (
	`id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`driver_id` varchar(255),
	`order_id` varchar(255),
	`agora_channel_name` varchar(255) NOT NULL,
	`is_active` boolean DEFAULT true,
	`last_message_at` datetime,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` varchar(255) NOT NULL,
	`conversation_id` varchar(255) NOT NULL,
	`sender_id` varchar(255),
	`sender_kind` varchar(20) NOT NULL DEFAULT 'user',
	`message` text NOT NULL,
	`message_type` varchar(50) DEFAULT 'text',
	`is_read` boolean DEFAULT false,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_excluded_categories` (
	`id` varchar(255) NOT NULL,
	`coupon_id` varchar(255) NOT NULL,
	`category_id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupon_excluded_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_excluded_products` (
	`id` varchar(255) NOT NULL,
	`coupon_id` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupon_excluded_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_included_categories` (
	`id` varchar(255) NOT NULL,
	`coupon_id` varchar(255) NOT NULL,
	`category_id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupon_included_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_included_products` (
	`id` varchar(255) NOT NULL,
	`coupon_id` varchar(255) NOT NULL,
	`product_id` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupon_included_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupon_redemptions` (
	`id` varchar(255) NOT NULL,
	`coupon_id` varchar(255) NOT NULL,
	`order_id` varchar(255),
	`user_id` varchar(255),
	`email` varchar(255),
	`code_snapshot` varchar(64) NOT NULL,
	`discount_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` varchar(20) NOT NULL DEFAULT 'redeemed',
	`redeemed_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupon_redemptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` varchar(255) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(255),
	`description` text,
	`discount_type` varchar(20) NOT NULL,
	`discount_value` decimal(10,2) NOT NULL,
	`max_discount_amount` decimal(10,2),
	`min_subtotal` decimal(10,2),
	`start_at` datetime,
	`end_at` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`usage_limit_total` int,
	`usage_limit_per_user` int,
	`first_order_only` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`),
	CONSTRAINT `coupons_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `domain_verification` (
	`id` varchar(255) NOT NULL,
	`domain` varchar(255) NOT NULL,
	`last_verified_at` datetime NOT NULL,
	`verification_status` varchar(50) DEFAULT 'valid',
	`client_status` varchar(50),
	`subscription_status` varchar(50),
	`subscription_end_date` datetime,
	`verified_by` varchar(255),
	`metadata` json,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `domain_verification_id` PRIMARY KEY(`id`),
	CONSTRAINT `domain_verification_domain_unique` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `driver_order_rejections` (
	`id` varchar(255) NOT NULL,
	`driver_id` varchar(255) NOT NULL,
	`order_id` varchar(255) NOT NULL,
	`rejected_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`reason` text,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `driver_order_rejections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `global_magic_link` (
	`id` varchar(255) NOT NULL,
	`token` varchar(255) NOT NULL,
	`is_enabled` boolean DEFAULT true,
	`description` text,
	`created_by` varchar(255),
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `global_magic_link_id` PRIMARY KEY(`id`),
	CONSTRAINT `global_magic_link_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `magic_link_usage` (
	`id` varchar(255) NOT NULL,
	`user_id` varchar(255) NOT NULL,
	`magic_link_id` varchar(255) NOT NULL,
	`used_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`ip_address` varchar(45),
	`user_agent` text,
	CONSTRAINT `magic_link_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pickup_locations` (
	`id` varchar(255) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text NOT NULL,
	`instructions` text,
	`latitude` decimal(10,8),
	`longitude` decimal(11,8),
	`is_active` boolean DEFAULT true,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	`updated_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `pickup_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_categories` (
	`product_id` varchar(255) NOT NULL,
	`category_id` varchar(255) NOT NULL,
	`created_at` datetime DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `product_categories_product_id_category_id_pk` PRIMARY KEY(`product_id`,`category_id`)
);
--> statement-breakpoint
ALTER TABLE `user` DROP INDEX `user_email_unique`;--> statement-breakpoint
ALTER TABLE `user` MODIFY COLUMN `email` varchar(255);--> statement-breakpoint
ALTER TABLE `drivers` ADD `current_address` varchar(500);--> statement-breakpoint
ALTER TABLE `order_items` ADD `compare_price` decimal(10,2);--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_latitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_longitude` decimal(11,8);--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_instructions` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `order_type` varchar(20) DEFAULT 'delivery';--> statement-breakpoint
ALTER TABLE `orders` ADD `pickup_location_id` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_id` varchar(255);--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_code` varchar(64);--> statement-breakpoint
ALTER TABLE `orders` ADD `coupon_discount_amount` decimal(10,2) DEFAULT '0.00';--> statement-breakpoint
ALTER TABLE `product_variants` ADD `numeric_value_of_variation_attribute` decimal(10,2);--> statement-breakpoint
ALTER TABLE `product_variants` ADD `out_of_stock` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `products` ADD `video_url` varchar(500);--> statement-breakpoint
ALTER TABLE `products` ADD `out_of_stock` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `twilio_call_sessions` ADD `call_type` varchar(10) DEFAULT 'voice';--> statement-breakpoint
ALTER TABLE `user` ADD `latitude` decimal(10,8);--> statement-breakpoint
ALTER TABLE `user` ADD `longitude` decimal(11,8);--> statement-breakpoint
ALTER TABLE `user` ADD `status` varchar(20) DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `user` ADD `password` varchar(255);--> statement-breakpoint
ALTER TABLE `user` ADD `notify_order_updates` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_promotions` boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `notify_driver_messages` boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE `user` ADD `note` text;--> statement-breakpoint
ALTER TABLE `variation_attribute_values` ADD `numeric_value` decimal(10,2);