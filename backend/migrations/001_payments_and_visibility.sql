-- Additive migration for payment gates and listing visibility.
-- Run once against the existing MySQL/MariaDB database.

ALTER TABLE properties
  ADD COLUMN status ENUM('available','taken') NOT NULL DEFAULT 'available',
  ADD COLUMN payment_status ENUM('pending','paid') NOT NULL DEFAULT 'pending';

ALTER TABLE users
  ADD COLUMN mpesa_number VARCHAR(32) NULL,
  ADD COLUMN active_plan ENUM('none','monthly','semester') NOT NULL DEFAULT 'none',
  ADD COLUMN plan_expires_at DATETIME NULL;

CREATE TABLE payments (
  id INT NOT NULL AUTO_INCREMENT,
  type ENUM('listing_fee','view_fee','landlord_plan') NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payer_phone VARCHAR(32) NOT NULL,
  related_property_id INT NULL,
  related_landlord_id INT NULL,
  pesapal_order_tracking_id VARCHAR(128) NULL,
  pesapal_merchant_reference VARCHAR(128) NOT NULL,
  confirmation_code VARCHAR(128) NULL,
  status ENUM('pending','success','failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_reference (pesapal_merchant_reference),
  KEY idx_payments_tracking (pesapal_order_tracking_id),
  KEY idx_payments_property (related_property_id),
  KEY idx_payments_landlord (related_landlord_id),
  CONSTRAINT fk_payments_property FOREIGN KEY (related_property_id) REFERENCES properties(id) ON DELETE SET NULL,
  CONSTRAINT fk_payments_landlord FOREIGN KEY (related_landlord_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE inquiries
  ADD COLUMN payment_id INT NULL,
  ADD KEY idx_inquiries_payment (payment_id),
  ADD CONSTRAINT fk_inquiries_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE SET NULL;
