-- Additive migration for registration terms acceptance.
-- Run once against the existing MySQL database.

ALTER TABLE users
  ADD COLUMN terms_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN terms_accepted_at TIMESTAMP NULL DEFAULT NULL;
