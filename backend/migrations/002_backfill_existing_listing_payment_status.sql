-- Run once after 001. Listings that existed before the payment gate were
-- already public; preserve that status without exposing future unpaid listings.
UPDATE properties
SET payment_status = 'paid'
WHERE verification_status = 'approved'
  AND status = 'available'
  AND payment_status = 'pending';
