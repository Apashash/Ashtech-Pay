-- Add the saved crypto withdrawal-address table to an existing MySQL install.
-- This is additive and idempotent: it creates only this table and never
-- changes or deletes existing rows.
-- No physical user foreign key is used because legacy Plesk users tables may
-- not match the current Drizzle type/collation; user deletion cleans this table
-- explicitly in the application.
CREATE TABLE IF NOT EXISTS `crypto_withdrawal_addresses` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `label` TEXT NOT NULL,
  `asset_code` TEXT NOT NULL,
  `address` TEXT NOT NULL,
  `memo` TEXT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `crypto_withdrawal_addresses_user_id_idx` (`user_id`)
) ENGINE=InnoDB;