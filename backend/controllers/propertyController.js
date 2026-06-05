const db = require('../config/db');
const { cloudinary } = require('../config/cloudinary');
const fs = require('fs');

exports.getAllProperties = async (req, res) => {
  try {
    const { county, town, house_type, bedrooms, minPrice, maxPrice, sort } = req.query;
    let query = `
      SELECT p.*, u.name as landlord_name, u.email as landlord_email,
      (SELECT image_url FROM property_images WHERE property_id = p.id LIMIT 1) as main_image
      FROM properties p
      JOIN users u ON p.landlord_id = u.id
      WHERE p.status = 'approved'
    `;
    let params = [];

    if (county) { query += ' AND p.county = ?'; params.push(county); }
    if (town) { query += ' AND p.town = ?'; params.push(town); }
    if (house_type) { query += ' AND p.house_type = ?'; params.push(house_type); }
    if (bedrooms) { query += ' AND p.bedrooms = ?'; params.push(bedrooms); }
    if (minPrice) { query += ' AND p.price >= ?'; params.push(minPrice); }
    if (maxPrice) { query += ' AND p.price <= ?'; params.push(maxPrice); }

    if (sort === 'lowest') query += ' ORDER BY p.price ASC';
    else if (sort === 'highest') query += ' ORDER BY p.price DESC';
    else query += ' ORDER BY p.created_at DESC';

    const [properties] = await db.execute(query, params);
    res.json(properties);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPropertyById = async (req, res) => {
  try {
    const [properties] = await db.execute(
      'SELECT p.*, u.name as landlord_name, u.email as landlord_email FROM properties p JOIN users u ON p.landlord_id = u.id WHERE p.id = ?',
      [req.params.id]
    );
    if (properties.length === 0) return res.status(404).json({ message: 'Property not found' });

    const [images] = await db.execute('SELECT image_url FROM property_images WHERE property_id = ?', [req.params.id]);
    res.json({ ...properties[0], images: images.map(img => img.image_url) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createProperty = async (req, res) => {
  const { title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, latitude, longitude } = req.body;
  try {
    const [result] = await db.execute(
      `INSERT INTO properties (landlord_id, title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, latitude || null, longitude || null]
    );

    const propertyId = result.insertId;

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const uploaded = await cloudinary.uploader.upload(file.path);
        await db.execute('INSERT INTO property_images (property_id, image_url) VALUES (?, ?)', [propertyId, uploaded.secure_url]);
        fs.unlinkSync(file.path);
      }
    }

    res.status(201).json({ message: 'Property created and pending verification approvals.', propertyId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateProperty = async (req, res) => {
  const { title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, status } = req.body;
  try {
    const [prop] = await db.execute('SELECT landlord_id FROM properties WHERE id = ?', [req.params.id]);
    if (prop.length === 0) return res.status(404).json({ message: 'Property identity missing' });

    if (req.user.role !== 'admin' && prop[0].landlord_id !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized execution modifier' });
    }

    const updatedStatus = req.user.role === 'admin' ? (status || 'approved') : 'pending';

    await db.execute(
      `UPDATE properties SET title=?, description=?, price=?, deposit=?, county=?, town=?, house_type=?, bedrooms=?, bathrooms=?, status=? WHERE id=?`,
      [title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, updatedStatus, req.params.id]
    );

    res.json({ message: 'Property fields synced cleanly.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteProperty = async (req, res) => {
  try {
    const [prop] = await db.execute('SELECT landlord_id FROM properties WHERE id = ?', [req.params.id]);
    if (prop.length === 0) return res.status(404).json({ message: 'Target operational row clean' });

    if (req.user.role !== 'admin' && prop[0].landlord_id !== req.user.id) {
      return res.status(403).json({ message: 'Action execution forbidden' });
    }

    await db.execute('DELETE FROM properties WHERE id = ?', [req.params.id]);
    res.json({ message: 'Listing permanently removed from servers.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};