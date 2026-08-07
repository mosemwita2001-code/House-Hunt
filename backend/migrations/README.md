# Database migration path

There are two supported database paths:

1. For a new local or staging database, load `datbase/house_hunting_fresh.sql`, then review and apply `007_multi_room_buildings.sql` to add multi-room support. The fresh schema already contains the base schema expected by the current Express server, including `payments.view_access_token_hash`.
2. For an existing database, take a backup and review the legacy reconciliation below against the actual columns and data. Then run `001`, `002`, `003`, `004`, `005`, `006`, and `007` once, in that order. These files are reviewable SQL only; this repository does not execute them against production.

The archived `datbase/house_hunting.sql` is not a valid direct starting point for `001`: its `properties.status` column means verification state (`pending/approved/rejected/rented`), while the current application uses `properties.verification_status` for moderation and `properties.status` for availability (`available/taken`). The existing inquiries table also stores a user id instead of the denormalized contact fields used by the current API. That is why the legacy-only preflight is required.

## Legacy-only preflight (review and adapt, do not run blindly)

Run these statements only when inspection confirms the archived schema is still present. Skip any statement for a column or constraint already reconciled, and preserve a backup before changing data.

```sql
ALTER TABLE properties
  CHANGE COLUMN status legacy_status ENUM('pending','approved','rejected','rented') NOT NULL DEFAULT 'pending';
```

The current `001` then creates `verification_status`, `status`, `payment_status`, image/payment/contact columns, the current user account fields, and inquiry contact/payment fields. It maps `legacy_status` to `verification_status`, copies inquiry names/emails from `users`, makes the old `inquiries.user_id` nullable for the current anonymous inquiry API, and leaves the old status in `legacy_status` for auditability. After the application is verified against the migrated data, the owner may decide whether that legacy column can be archived; none of these migrations drops it.

If the live schema is neither the archived schema nor the fresh schema, stop and produce a small schema-specific reconciliation first. Do not force these `ADD COLUMN` statements onto an already-current database.

## Ordered files

- `001_payments_and_visibility.sql`: reconciles the application columns and creates the payment/inquiry payment relationship. It intentionally does **not** create the view-token hash column.
- `002_backfill_existing_listing_payment_status.sql`: marks existing approved, available listings as paid so the pre-payment-gate inventory is not hidden.
- `003_query_performance_indexes.sql`: adds the public-listing and user-role indexes. It does not duplicate the payment index.
- `004_view_access_token.sql`: adds `payments.view_access_token_hash` and its lookup index. The backend hashes the random token before comparing it; the raw token is never stored in MySQL.
- `005_property_amenities.sql`: adds the nullable JSON `properties.amenities` column. Existing rows do not require a data migration.
- `006_terms_acceptance.sql`: adds the registration terms acceptance flag and timestamp. Existing users remain valid with the default `FALSE` flag and no acceptance timestamp.
- `007_multi_room_buildings.sql`: adds the `properties.listing_type` discriminator and the room-type, room, and legacy room-image tables. Existing properties remain `single` by default.
- `008_room_type_images.sql`: adds representative photos to room types and backfills them from the first room's legacy images. It intentionally leaves `room_images` in place for review and rollback planning; the application no longer writes or reads per-room photos.

The fresh schema already includes the terms acceptance columns, so migration `006` is only for existing databases.

Do not run `001`–`006` against `datbase/house_hunting_fresh.sql`; use the fresh schema as-is. Do not run either path against production without the human owner reviewing the actual Render database schema, backup, lock/maintenance timing, and rollback plan.
