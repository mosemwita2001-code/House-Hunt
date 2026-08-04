-- Add amenities stored as a JSON array. Existing rows remain NULL and are
-- treated as an empty array by the API and frontend.

ALTER TABLE properties
  ADD COLUMN amenities JSON NULL;
