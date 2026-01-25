-- Create domain_verification table
CREATE TABLE IF NOT EXISTS `domain_verification` (
  `id` VARCHAR(255) NOT NULL PRIMARY KEY,
  `domain` VARCHAR(255) NOT NULL UNIQUE,
  `last_verified_at` DATETIME NOT NULL,
  `verification_status` VARCHAR(50) DEFAULT 'valid',
  `client_status` VARCHAR(50),
  `subscription_status` VARCHAR(50),
  `subscription_end_date` DATETIME,
  `verified_by` VARCHAR(255),
  `metadata` JSON,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_domain` (`domain`),
  INDEX `idx_last_verified_at` (`last_verified_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
