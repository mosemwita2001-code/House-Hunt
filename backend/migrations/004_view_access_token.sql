-- Required for databases that already ran migration 001 before the view-token
-- payment-gate change. Run once in local/staging first, then apply manually to
-- production during a planned deployment.

ALTER TABLE payments
  ADD COLUMN view_access_token_hash CHAR(64) NULL AFTER pesapal_merchant_reference,
  ADD KEY idx_payments_view_access (type, status, related_property_id, view_access_token_hash);
