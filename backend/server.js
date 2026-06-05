import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import mysql          from 'mysql2/promise';
import bcrypt         from 'bcrypt';
import jwt            from 'jsonwebtoken';
import multer         from 'multer';
import path           from 'path';
import fs             from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── CORS ───────────────────────────────────────────────────────────────── */
app.use(cors({
  origin: ['http://localhost:5173','http://localhost:5174','http://127.0.0.1:5173','http://127.0.0.1:5174'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── Uploads ────────────────────────────────────────────────────────────── */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

/* ── DB pool ────────────────────────────────────────────────────────────── */
const db = mysql.createPool({
  host:            process.env.DB_HOST     || 'localhost',
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || '',
  database:        process.env.DB_NAME     || 'house_hunting_db',
  waitForConnections: true,
  connectionLimit: 10,
});

/* test connection on startup */
db.getConnection()
  .then(c => { console.log('✅ MySQL connected'); c.release(); })
  .catch(e => console.error('❌ MySQL connection failed:', e.message));

/* ── Auth middleware ────────────────────────────────────────────────────── */
const protect = (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });
  try {
    req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Token invalid or expired' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ message: `Access denied. Required role: ${roles.join(' or ')}` });
  next();
};

/* ══════════════════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════════════════ */
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });
  try {
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ message: 'Email already registered' });

    const hashed   = await bcrypt.hash(password, 10);
    const safeRole = ['tenant','landlord','admin'].includes(role) ? role : 'tenant';
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, account_status) VALUES (?,?,?,?,?)',
      [name, email, hashed, safeRole, 'active']
    );
    const token = jwt.sign({ id: result.insertId, role: safeRole }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: result.insertId, name, email, role: safeRole } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });
  try {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid email or password' });

    const user    = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    if (user.account_status === 'suspended')
      return res.status(403).json({ message: 'Account suspended. Contact support.' });

    const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PUBLIC PROPERTIES
══════════════════════════════════════════════════════════════════════════ */
app.get('/api/properties', async (req, res) => {
  try {
    const { county, town, house_type, bedrooms, minPrice, maxPrice, sort } = req.query;
    let q = `
      SELECT p.*, u.name AS landlord_name, u.email AS landlord_email
      FROM properties p
      JOIN users u ON u.id = p.landlord_id
      WHERE p.verification_status = 'approved'
    `;
    const params = [];
    if (county)    { q += ' AND p.county = ?';     params.push(county); }
    if (town)      { q += ' AND p.town LIKE ?';     params.push(`%${town}%`); }
    if (house_type){ q += ' AND p.house_type = ?';  params.push(house_type); }
    if (bedrooms)  { q += ' AND p.bedrooms = ?';    params.push(bedrooms); }
    if (minPrice)  { q += ' AND p.price >= ?';      params.push(minPrice); }
    if (maxPrice)  { q += ' AND p.price <= ?';      params.push(maxPrice); }
    q += sort === 'lowest'  ? ' ORDER BY p.price ASC'
       : sort === 'highest' ? ' ORDER BY p.price DESC'
       : ' ORDER BY p.created_at DESC';
    const [rows] = await db.execute(q, params);
    res.json(rows);
  } catch (err) {
    console.error('GET /properties error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/properties/:id', async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, u.name AS landlord_name, u.email AS landlord_email
      FROM properties p
      LEFT JOIN users u ON u.id = p.landlord_id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ message: 'Property not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   LANDLORD
══════════════════════════════════════════════════════════════════════════ */
app.get('/api/landlord/dashboard', protect, authorize('landlord'), async (req, res) => {
  try {
    const [properties] = await db.execute(
      'SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    const [inquiries] = await db.execute(`
      SELECT i.*, p.title as property_title
      FROM inquiries i
      JOIN properties p ON i.property_id = p.id
      WHERE p.landlord_id = ?
      ORDER BY i.created_at DESC
      LIMIT 5
    `, [req.user.id]);

    res.json({
      stats: {
        total:     properties.length,
        active:    properties.filter(p => p.verification_status === 'approved').length,
        pending:   properties.filter(p => p.verification_status === 'pending').length,
        inquiries: inquiries.length,
      },
      properties: properties.slice(0, 3),
      inquiries,
    });
  } catch (err) {
    console.error('Landlord dashboard error:', err);
    res.status(500).json({ message: 'Error loading dashboard' });
  }
});

app.get('/api/landlord/my-properties', protect, authorize('landlord'), async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('My-properties error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/landlord/properties', protect, authorize('landlord'), upload.array('images', 10), async (req, res) => {
  try {
    const {
      title, county, town, house_type, price,
      description, deposit, bedrooms, bathrooms,
      payment_cycle, phone_number,
    } = req.body;

    if (!title || !county || !town || !house_type || !price)
      return res.status(400).json({ message: 'title, county, town, house_type and price are required' });

    const imagePath = req.files?.length
      ? req.files.map(f => f.filename).join(',')
      : null;

    const [result] = await db.execute(
      `INSERT INTO properties
        (title, county, town, house_type, price, description, deposit,
         bedrooms, bathrooms, image_path, payment_cycle, phone_number,
         landlord_id, verification_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title, county, town, house_type, Number(price),
        description || '', Number(deposit) || 0,
        Number(bedrooms) || 1, Number(bathrooms) || 1,
        imagePath,
        payment_cycle || 'month',
        phone_number  || '',
        req.user.id,
        'approved',
      ]
    );
    res.status(201).json({ message: 'Property created successfully', id: result.insertId });
  } catch (err) {
    console.error('POST /landlord/properties error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/landlord/properties/:id', protect, authorize('landlord'), upload.array('images', 10), async (req, res) => {
  try {
    const {
      title, county, town, house_type, price,
      description, deposit, bedrooms, bathrooms,
      payment_cycle, phone_number,
    } = req.body;

    const imagePath = req.files?.length
      ? req.files.map(f => f.filename).join(',')
      : null;

    const params = [
      title, county, town, house_type, Number(price),
      description || '', Number(deposit) || 0,
      Number(bedrooms) || 1, Number(bathrooms) || 1,
      payment_cycle || 'month', phone_number || '',
    ];
    let sql = `UPDATE properties SET
      title=?, county=?, town=?, house_type=?, price=?,
      description=?, deposit=?, bedrooms=?, bathrooms=?,
      payment_cycle=?, phone_number=?`;

    if (imagePath) { sql += ', image_path=?'; params.push(imagePath); }
    sql += ' WHERE id=? AND landlord_id=?';
    params.push(req.params.id, req.user.id);

    const [result] = await db.execute(sql, params);
    if (!result.affectedRows)
      return res.status(404).json({ message: 'Property not found or not yours' });
    res.json({ message: 'Property updated successfully' });
  } catch (err) {
    console.error('PUT /landlord/properties error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/landlord/properties/:id', protect, authorize('landlord'), async (req, res) => {
  try {
    await db.execute('DELETE FROM properties WHERE id=? AND landlord_id=?', [req.params.id, req.user.id]);
    res.json({ message: 'Property deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN
══════════════════════════════════════════════════════════════════════════ */
app.get('/api/admin/stats', protect, authorize('admin'), async (req, res) => {
  try {
    const [[{ total: totalUsers }]]        = await db.execute('SELECT COUNT(*) AS total FROM users');
    const [[{ total: totalHouses }]]       = await db.execute('SELECT COUNT(*) AS total FROM properties');
    const [[{ total: activeListings }]]    = await db.execute("SELECT COUNT(*) AS total FROM properties WHERE verification_status='approved'");
    const [[{ total: pendingListings }]]   = await db.execute("SELECT COUNT(*) AS total FROM properties WHERE verification_status='pending'");
    const [[{ total: totalLandlords }]]    = await db.execute("SELECT COUNT(*) AS total FROM users WHERE role='landlord'");
    const [[{ total: suspendedUsers }]]    = await db.execute("SELECT COUNT(*) AS total FROM users WHERE account_status='suspended'");
    const [[{ total: newUsersThisMonth }]] = await db.execute("SELECT COUNT(*) AS total FROM users WHERE MONTH(created_at)=MONTH(NOW()) AND YEAR(created_at)=YEAR(NOW())");

    const [monthlyRegistrations] = await db.execute(`
      SELECT DATE_FORMAT(created_at,'%b') AS month, COUNT(*) AS total
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at,'%b')
      ORDER BY YEAR(created_at), MONTH(created_at)
    `);
    const [[approvalRow]] = await db.execute(`
      SELECT ROUND(
        COUNT(CASE WHEN verification_status='approved' THEN 1 END)*100.0 / NULLIF(COUNT(*),0), 1
      ) AS rate FROM properties
    `);
    const [[avgRentRow]]  = await db.execute('SELECT ROUND(AVG(price),0) AS avg_price FROM properties');
    const [countyStats]   = await db.execute('SELECT county, COUNT(*) AS total FROM properties GROUP BY county ORDER BY total DESC LIMIT 10');
    const [roles]         = await db.execute('SELECT role, COUNT(*) AS total FROM users GROUP BY role');

    res.json({
      totalUsers, totalHouses, activeListings, pendingListings,
      totalLandlords, suspendedUsers, newUsersThisMonth,
      monthlyRegistrations,
      approvalRate: approvalRow.rate      || 0,
      avgRent:      avgRentRow.avg_price  || 0,
      countyStats,
      roles,
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/users', protect, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT u.id, u.name, u.email, u.role,
             u.account_status AS status,
             DATE_FORMAT(u.created_at,'%Y-%m-%d') AS created_at,
             COUNT(p.id) AS properties
      FROM users u
      LEFT JOIN properties p ON p.landlord_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/admin/users/:id/status', protect, authorize('admin'), async (req, res) => {
  const { status } = req.body;
  if (!['active','suspended'].includes(status))
    return res.status(400).json({ message: 'status must be active or suspended' });
  try {
    await db.execute('UPDATE users SET account_status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: `User ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await db.execute('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/admin/listings', protect, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, u.name AS landlord,
             DATE_FORMAT(p.created_at,'%Y-%m-%d') AS created_at
      FROM properties p
      LEFT JOIN users u ON u.id = p.landlord_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error('Admin listings error:', err);
    res.status(500).json({ message: err.message });
  }
});

app.patch('/api/admin/listings/:id/status', protect, authorize('admin'), async (req, res) => {
  const { status } = req.body;
  const vs = status === 'active' ? 'approved' : status;
  if (!['approved','pending','rejected'].includes(vs))
    return res.status(400).json({ message: 'Invalid status' });
  try {
    await db.execute('UPDATE properties SET verification_status=? WHERE id=?', [vs, req.params.id]);
    res.json({ message: 'Listing updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/admin/listings/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await db.execute('DELETE FROM properties WHERE id=?', [req.params.id]);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   FAVOURITES
══════════════════════════════════════════════════════════════════════════ */
app.post('/api/favorites', protect, async (req, res) => {
  const { property_id } = req.body;
  try {
    const [exists] = await db.execute(
      'SELECT id FROM favorites WHERE user_id=? AND property_id=?',
      [req.user.id, property_id]
    );
    if (exists.length) {
      await db.execute('DELETE FROM favorites WHERE user_id=? AND property_id=?', [req.user.id, property_id]);
      return res.json({ favorited: false });
    }
    await db.execute('INSERT INTO favorites (user_id,property_id) VALUES (?,?)', [req.user.id, property_id]);
    res.json({ favorited: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get('/api/favorites', protect, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.* FROM favorites f
      JOIN properties p ON f.property_id = p.id
      WHERE f.user_id = ?
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   INQUIRIES
══════════════════════════════════════════════════════════════════════════ */

/* POST /api/inquiries — any visitor can send an inquiry (no auth needed) */
app.post('/api/inquiries', async (req, res) => {
  const { property_id, user_name, user_email, message } = req.body;
  if (!property_id || !user_name || !user_email || !message)
    return res.status(400).json({ message: 'property_id, user_name, user_email and message are required' });
  try {
    await db.execute(
      'INSERT INTO inquiries (property_id, user_name, user_email, message) VALUES (?,?,?,?)',
      [property_id, user_name.trim(), user_email.trim(), message.trim()]
    );
    res.status(201).json({ message: 'Inquiry sent successfully' });
  } catch (err) {
    console.error('POST /inquiries error:', err);
    res.status(500).json({ message: err.message });
  }
});

/* GET /api/landlord/inquiries — landlord sees all inquiries for their properties */
app.get('/api/landlord/inquiries', protect, authorize('landlord'), async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT i.*, p.title AS property_title
      FROM inquiries i
      JOIN properties p ON i.property_id = p.id
      WHERE p.landlord_id = ?
      ORDER BY i.created_at DESC
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    console.error('GET /landlord/inquiries error:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ── Health check ──────────────────────────────────────────────────────── */
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));