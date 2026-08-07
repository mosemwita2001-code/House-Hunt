-- Room-type representative photos.
-- Review and apply manually after 007_multi_room_buildings.sql.
-- This file is not executed by the application or against production.

CREATE TABLE room_type_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  room_type_id INT NOT NULL,
  image_url VARCHAR(1000) NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  CONSTRAINT fk_room_type_images_room_type
    FOREIGN KEY (room_type_id) REFERENCES room_types(id) ON DELETE CASCADE,
  KEY idx_room_type_images_type_order (room_type_id, display_order, id)
) ENGINE=InnoDB;

-- Preserve the former tenant-facing sample images when moving from the
-- legacy per-room storage: use the first available room, falling back to the
-- first room. room_images remains available for rollback review.
INSERT INTO room_type_images (room_type_id, image_url, display_order)
SELECT rt.id, ri.image_url, ri.display_order
FROM room_types rt
JOIN rooms first_room
  ON first_room.id = COALESCE(
    (SELECT MIN(candidate_room.id)
     FROM rooms candidate_room
     WHERE candidate_room.room_type_id = rt.id
       AND candidate_room.status = 'available'),
    (SELECT MIN(candidate_room.id)
     FROM rooms candidate_room
     WHERE candidate_room.room_type_id = rt.id)
  )
JOIN room_images ri ON ri.room_id = first_room.id;
