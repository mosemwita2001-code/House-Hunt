-- Multi-room building support.
-- Review and apply manually to the intended local/staging/production database.
-- This file is not executed by the application.

ALTER TABLE properties
  ADD COLUMN listing_type ENUM('single','multi_room') NOT NULL DEFAULT 'single';

CREATE TABLE room_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  house_type ENUM(
    'Bedsitter',
    'Single Room',
    'One Bedroom',
    'Two Bedroom',
    'Three Bedroom',
    'Four Bedroom',
    'Penthouse',
    'Studio'
  ) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_room_types_property
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  KEY idx_room_types_property (property_id)
) ENGINE=InnoDB;

CREATE TABLE rooms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_type_id INT NOT NULL,
  room_label VARCHAR(100) NOT NULL,
  status ENUM('available','taken') NOT NULL DEFAULT 'available',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rooms_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE,
  UNIQUE KEY uq_rooms_room_type_label (room_type_id, room_label),
  KEY idx_rooms_room_type_status (room_type_id, status)
) ENGINE=InnoDB;

CREATE TABLE room_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_id INT NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_room_images_room
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  KEY idx_room_images_room_order (room_id, display_order, id)
) ENGINE=InnoDB;
