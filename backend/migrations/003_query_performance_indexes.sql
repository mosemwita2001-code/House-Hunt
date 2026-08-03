-- Run once after the earlier migrations.
-- users.email is already UNIQUE, which is the required login index.

CREATE INDEX idx_properties_public_listing
  ON properties (verification_status, payment_status, status, created_at);

CREATE INDEX idx_users_role_status_created
  ON users (role, account_status, created_at);
