CREATE DATABASE IF NOT EXISTS house_hunting;
USE house_hunting;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('tenant', 'landlord', 'admin') DEFAULT 'tenant',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS properties (
  id INT AUTO_INCREMENT PRIMARY KEY,
  landlord_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  deposit DECIMAL(10,2) NOT NULL,
  county VARCHAR(100) NOT NULL,
  town VARCHAR(100) NOT NULL,
  house_type VARCHAR(100) NOT NULL,
  bedrooms INT NOT NULL,
  bathrooms INT NOT NULL,
  status ENUM('pending', 'approved', 'rejected', 'rented') DEFAULT 'pending',
  latitude DECIMAL(10,8) DEFAULT NULL,
  longitude DECIMAL(11,8) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS property_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favorites (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  property_id INT NOT NULL,
  UNIQUE KEY unique_user_property (user_id, property_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  property_id INT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SEED DATA
INSERT INTO users (id, name, email, password, role) VALUES 
(1, 'Admin Tracker', 'admin@househunt.com', '$2b$10$wK3eG17I73fK08C1F4wWVu7S/z8B4YJ4zN96SjHUXwNenmZ.VlWia', 'admin'),
(2, 'Jane Landlord', 'jane@househunt.com', '$2b$10$wK3eG17I73fK08C1F4wWVu7S/z8B4YJ4zN96SjHUXwNenmZ.VlWia', 'landlord');