import express from 'express';
import pool from '../config/db.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { county, town, house_type } = req.query;
    let sql = 'SELECT * FROM properties WHERE 1=1';
    const params = [];

    if (county && county.trim()) {
      sql += ' AND county LIKE ?';
      params.push(`%${county}%`);
    }
    if (town && town.trim()) {
      sql += ' AND town LIKE ?';
      params.push(`%${town}%`);
    }
    if (house_type && house_type.trim()) {
      sql += ' AND house_type = ?';
      params.push(house_type);
    }

    const connection = await pool.getConnection();
    const [properties] = await connection.execute(sql, params);
    connection.release();

    res.json(properties);
  } catch (err) {
    console.error('Properties fetch error:', err);
    res.status(500).json({ message: 'Failed to fetch properties' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    const [properties] = await connection.execute('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    connection.release();

    if (properties.length === 0) {
      return res.status(404).json({ message: 'Property not found' });
    }

    res.json(properties[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, async (req, res) => {
  try {
    const { title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, phone_number } = req.body;

    const connection = await pool.getConnection();
    await connection.execute(
      `INSERT INTO properties (title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, phone_number, landlord_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description, price, deposit, county, town, house_type, bedrooms, bathrooms, phone_number, req.user.id]
    );
    connection.release();

    res.status(201).json({ message: 'Property created successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

export default router;
