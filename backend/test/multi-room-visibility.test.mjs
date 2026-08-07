import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations/007_multi_room_buildings.sql');
const migration = readFileSync(migrationPath, 'utf8');
const roomTypeImagesMigration = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations/008_room_type_images.sql'), 'utf8');

function createLocalSchema() {
  const database = new DatabaseSync(':memory:');
  database.exec(`
    CREATE TABLE properties (
      id INTEGER PRIMARY KEY
    );
    ALTER TABLE properties ADD COLUMN listing_type TEXT NOT NULL DEFAULT 'single';
    CREATE TABLE room_types (
      id INTEGER PRIMARY KEY,
      property_id INTEGER NOT NULL,
      house_type TEXT NOT NULL,
      price NUMERIC NOT NULL,
      description TEXT,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
    );
    CREATE TABLE rooms (
      id INTEGER PRIMARY KEY,
      room_type_id INTEGER NOT NULL,
      room_label TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available',
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    );
    CREATE TABLE room_images (
      id INTEGER PRIMARY KEY,
      room_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
    );
    CREATE TABLE room_type_images (
      id INTEGER PRIMARY KEY,
      room_type_id INTEGER NOT NULL,
      image_url TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE
    );
  `);
  return database;
}

function seedMixedBuilding(database) {
  database.exec(`
    INSERT INTO properties (id, listing_type) VALUES (1, 'multi_room'), (2, 'multi_room'), (3, 'single');
    INSERT INTO room_types (id, property_id, house_type, price, description)
      VALUES (11, 1, 'Bedsitter', 12000, 'Bedsitter block'),
             (12, 1, 'Single Room', 8000, 'Fully occupied block'),
             (21, 2, 'One Bedroom', 18000, 'Fully occupied building');
    INSERT INTO rooms (id, room_type_id, room_label, status)
      VALUES (111, 11, 'GS4', 'available'),
             (112, 11, 'GS5', 'taken'),
             (121, 12, 'Single 3', 'taken'),
             (211, 21, 'A1', 'taken');
    INSERT INTO room_type_images (room_type_id, image_url, display_order)
      VALUES (11, 'https://example.test/bedsitter.jpg', 0);
  `);
}

const publicFeedQuery = `
  SELECT p.id, p.listing_type
  FROM properties p
  WHERE (
    p.listing_type = 'single'
    OR EXISTS (
      SELECT 1
      FROM room_types rt
      JOIN rooms available_room
        ON available_room.room_type_id = rt.id
       AND available_room.status = 'available'
      WHERE rt.property_id = p.id
    )
  )
  ORDER BY p.id
`;

const availableDetailQuery = `
  SELECT rt.id AS room_type_id, rt.house_type, r.id AS room_id,
         r.room_label, r.status, rti.image_url
  FROM room_types rt
  JOIN rooms r ON r.room_type_id = rt.id AND r.status = 'available'
  LEFT JOIN room_type_images rti ON rti.id = (
    SELECT first_image.id
    FROM room_type_images first_image
    WHERE first_image.room_type_id = rt.id
    ORDER BY first_image.display_order, first_image.id
    LIMIT 1
  )
  WHERE rt.property_id = ?
    AND EXISTS (
      SELECT 1 FROM rooms available_room
      WHERE available_room.room_type_id = rt.id
        AND available_room.status = 'available'
    )
  ORDER BY rt.id, r.id, rti.display_order, rti.id
`;

test('migration declares the required multi-room schema', () => {
  assert.match(migration, /listing_type ENUM\('single','multi_room'\)/);
  assert.match(migration, /CREATE TABLE room_types/);
  assert.match(migration, /CREATE TABLE rooms/);
  assert.match(migration, /CREATE TABLE room_images/);
  assert.match(migration, /FOREIGN KEY \(property_id\) REFERENCES properties\(id\) ON DELETE CASCADE/);
  assert.match(migration, /FOREIGN KEY \(room_type_id\) REFERENCES room_types\(id\) ON DELETE CASCADE/);
  assert.match(roomTypeImagesMigration, /CREATE TABLE room_type_images/);
  assert.match(roomTypeImagesMigration, /INSERT INTO room_type_images/);
  assert.match(roomTypeImagesMigration, /JOIN room_images ri/);
});

test('SQL visibility rules keep only available rooms/types and available buildings', () => {
  const database = createLocalSchema();
  seedMixedBuilding(database);

  const feedRows = database.prepare(publicFeedQuery).all().map(row => ({ ...row }));
  const detailRows = database.prepare(availableDetailQuery).all(1).map(row => ({ ...row }));

  assert.deepEqual(feedRows, [
    { id: 1, listing_type: 'multi_room' },
    { id: 3, listing_type: 'single' },
  ]);
  assert.deepEqual(detailRows, [{
    room_type_id: 11,
    house_type: 'Bedsitter',
    room_id: 111,
    room_label: 'GS4',
    status: 'available',
    image_url: 'https://example.test/bedsitter.jpg',
  }]);

  database.prepare('UPDATE rooms SET status = ? WHERE id = ?').run('taken', 111);
  assert.deepEqual(database.prepare(publicFeedQuery).all().map(row => ({ ...row })), [{ id: 3, listing_type: 'single' }]);
  assert.deepEqual(database.prepare(availableDetailQuery).all(1).map(row => ({ ...row })), []);
  database.close();
});
