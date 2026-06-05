import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const connection = await pool.getConnection();

    const [existing] = await connection.execute('SELECT id FROM users WHERE email = ?', [cleanEmail]);
    if (existing.length > 0) {
      connection.release();
      return res.status(400).json({ message: 'Email already registered' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userRole = role || 'tenant';

    const [result] = await connection.execute(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, cleanEmail, hashedPassword, userRole]
    );

    const token = jwt.sign({ id: result.insertId, role: userRole }, process.env.JWT_SECRET, { expiresIn: '7d' });

    connection.release();
    res.status(201).json({
      token,
      user: { id: result.insertId, name, email: cleanEmail, role: userRole }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const connection = await pool.getConnection();
    const [users] = await connection.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);

    if (users.length === 0) {
      connection.release();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      connection.release();
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    connection.release();
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(200).json({ user: null });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const connection = await pool.getConnection();
    const [users] = await connection.execute('SELECT id, name, email, role FROM users WHERE id = ?', [decoded.id]);
    connection.release();

    if (users.length === 0) {
      return res.status(200).json({ user: null });
    }

    res.json({ user: users[0] });
  } catch (err) {
    res.status(200).json({ user: null });
  }
});

export default router;
