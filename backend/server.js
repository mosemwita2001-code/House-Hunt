import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import mysql          from 'mysql2/promise';
import bcrypt         from 'bcrypt';
import jwt            from 'jsonwebtoken';
import multer         from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { handleIPN, registerIPN, submitOrder } from './pesapalService.js';

/* ── Cloudinary config ──────────────────────────────────────────────────── */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/* ── Cloudinary multer storage ──────────────────────────────────────────── */
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:          'house-hunting',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation:  [{ width: 1200, quality: 'auto' }],
  },
});

const upload = multer({ storage });

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── CORS ───────────────────────────────────────────────────────────────── */
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    process.env.FRONTEND_URL,        // add your frontend URL in env variables
  ].filter(Boolean),
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ── DB pool ────────────────────────────────────────────────────────────── */
const db = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'house_hunting_db',
  port:               Number(process.env.DB_PORT) || 3306,
  ssl:                { rejectUnauthorized: false },
  waitForConnections: true,
  // Keep this below the managed database's connection cap. Transactions below
  // release before any PesaPal network call, so checkout never holds a DB slot.
  connectionLimit:    Number(process.env.DB_POOL_SIZE) || 5,
  maxIdle:            Number(process.env.DB_POOL_SIZE) || 5,
  idleTimeout:        60000,
  queueLimit:         0,
  connectTimeout:     10000,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0,
});

const transientDbErrors = new Set(['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ETIMEDOUT', 'ECONNREFUSED']);
const PLAN_OPTIONS = {
  monthly: { amount: 1000, days: 30, label: 'Monthly subscription' },
  semester: { amount: 3000, days: 120, label: 'Semester subscription' },
  listing: { amount: 400, label: 'Pay-per-listing' },
};

async function executeReadWithRetry(sql, params) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.execute(sql, params);
    } catch (error) {
      if (!transientDbErrors.has(error.code) || attempt === 1) throw error;
      console.warn(`Transient MySQL error (${error.code}); retrying read query once.`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

const isTransientDbError = error => transientDbErrors.has(error?.code);

async function executePaymentWriteWithRetry(sql, params) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      return await db.execute(sql, params);
    } catch (error) {
      if (!isTransientDbError(error) || attempt === 1) throw error;
      console.warn(`Transient MySQL error during payment write (${error.code}); retrying once.`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
}

function respondPaymentError(res, error) {
  if (error?.code === 'PESAPAL_NETWORK_ERROR') {
    return res.status(502).json({ message: error.message, code: error.code });
  }
  if (isTransientDbError(error)) {
    return res.status(503).json({ message: 'The payment service temporarily lost its database connection. Please try again.', code: 'PAYMENT_DATABASE_CONNECTION_RESET' });
  }
  return res.status(502).json({ message: error.message || 'Unable to start payment. Please try again.', code: 'PAYMENT_INITIATION_FAILED' });
}

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

const optionalAuth = (req, res, next) => {
  const h = req.headers.authorization;
  if (h?.startsWith('Bearer ')) {
    try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); } catch { /* public request */ }
  }
  next();
};

const publicFields = 'p.id, p.title, p.county, p.town, p.house_type, p.price, p.payment_cycle, p.image_path, p.status, p.bedrooms, p.bathrooms, p.created_at';
const isAdmin = req => req.user?.role === 'admin';
const isOwner = (req, property) => req.user?.role === 'landlord' && Number(req.user.id) === Number(property.landlord_id);

async function hasPaidView(req, propertyId) {
  if (isAdmin(req)) return true;
  if (isOwner(req, { landlord_id: req.user?.id })) return true;
  const viewerPhone = req.headers['x-viewer-phone'] || req.body?.phone_number || req.query?.phone || '';
  const [rows] = await db.execute(
    `SELECT p.id FROM payments p
     WHERE p.type='view_fee' AND p.status='success' AND p.related_property_id=?
       AND p.payer_phone=?
     LIMIT 1`,
    [propertyId, viewerPhone]
  );
  return rows.length > 0;
}

async function activePlan(landlordId) {
  const [rows] = await db.execute(
    `SELECT active_plan, plan_expires_at FROM users WHERE id=? AND active_plan <> 'none' AND plan_expires_at > NOW()`,
    [landlordId]
  );
  return rows[0] || null;
}

async function getUserBillingAddress(userId) {
  const [[user]] = await db.execute('SELECT name, email FROM users WHERE id=?', [userId]);
  if (!user?.email) throw new Error('The account needs an email address before starting payment');
  const [firstName, ...lastNameParts] = user.name.trim().split(/\s+/);
  return { email: user.email, firstName, lastName: lastNameParts.join(' ') || firstName, countryCode: 'KE' };
}

async function createPayment({ type, amount, phone, propertyId = null, landlordId = null, description, billingAddress }) {
  const reference = `${type}-${propertyId || landlordId || 'platform'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const insertSql = `INSERT INTO payments (type, amount, payer_phone, related_property_id, related_landlord_id, pesapal_merchant_reference, status)
    VALUES (?,?,?,?,?,?, 'pending')`;
  const insertParams = [type, amount, phone, propertyId, landlordId, reference];
  let result;
  try {
    [result] = await db.execute(insertSql, insertParams);
  } catch (error) {
    if (!isTransientDbError(error)) throw error;
    console.warn(`Transient MySQL error while creating payment (${error.code}); checking the payment reference before retrying.`);
    const [existing] = await executeReadWithRetry('SELECT id FROM payments WHERE pesapal_merchant_reference=? LIMIT 1', [reference]);
    if (existing.length) result = { insertId: existing[0].id };
    else [result] = await executePaymentWriteWithRetry(insertSql, insertParams);
  }
  try {
    const order = await submitOrder({ amount, reference, phone, description, billingAddress });
    await executePaymentWriteWithRetry('UPDATE payments SET pesapal_order_tracking_id=? WHERE id=?', [order.order_tracking_id, result.insertId]);
    return { paymentId: result.insertId, reference, ...order };
  } catch (error) {
    console.error('[Payments] PesaPal order failed:', JSON.stringify({ type, amount, propertyId, landlordId, reference, error: error.message }));
    await executePaymentWriteWithRetry('UPDATE payments SET status=? WHERE id=?', ['failed', result.insertId]);
    throw error;
  }
}

async function createPendingPayment(connection, { type, amount, phone, propertyId = null, landlordId = null }) {
  const reference = `${type}-${propertyId || landlordId || 'platform'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [result] = await connection.execute(
    `INSERT INTO payments (type, amount, payer_phone, related_property_id, related_landlord_id, pesapal_merchant_reference, status)
     VALUES (?,?,?,?,?,?, 'pending')`,
    [type, amount, phone, propertyId, landlordId, reference]
  );
  return { id: result.insertId, reference };
}

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
    const [rows] = await executeReadWithRetry('SELECT id, name, email, password, role, account_status FROM users WHERE email = ?', [email.trim().toLowerCase()]);
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
    res.status(transientDbErrors.has(err.code) ? 503 : 500).json({ message: transientDbErrors.has(err.code) ? 'Database is temporarily unavailable. Please try again.' : err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PUBLIC PROPERTIES
══════════════════════════════════════════════════════════════════════════ */
app.get('/api/properties', optionalAuth, async (req, res) => {
  try {
    const { county, town, house_type, bedrooms, minPrice, maxPrice, sort } = req.query;
    let q = `
      SELECT ${publicFields}
      FROM properties p
      WHERE p.verification_status = 'approved'
    `;
    const params = [];
    if (!isAdmin(req)) q += ` AND p.status = 'available'`;
    if (county)     { q += ' AND p.county = ?';     params.push(county); }
    if (town)       { q += ' AND p.town LIKE ?';     params.push(`%${town}%`); }
    if (house_type) { q += ' AND p.house_type = ?';  params.push(house_type); }
    if (bedrooms)   { q += ' AND p.bedrooms = ?';    params.push(bedrooms); }
    if (minPrice)   { q += ' AND p.price >= ?';      params.push(minPrice); }
    if (maxPrice)   { q += ' AND p.price <= ?';      params.push(maxPrice); }
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

app.get('/api/properties/:id', optionalAuth, async (req, res) => {
  try {
    const [rows] = await db.execute(`
      SELECT p.*, u.name AS landlord_name, u.email AS landlord_email
      FROM properties p
      LEFT JOIN users u ON u.id = p.landlord_id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!rows.length) return res.status(404).json({ message: 'Property not found' });
    const property = rows[0];
    const privileged = isAdmin(req) || isOwner(req, property);
    if (!privileged && (property.status === 'taken' || property.verification_status !== 'approved'))
      return res.status(404).json({ message: 'Property not found' });
    const full = privileged || await hasPaidView(req, property.id);
    const safe = {
      id: property.id, title: property.title, county: property.county, town: property.town,
      house_type: property.house_type, price: property.price, payment_cycle: property.payment_cycle,
      image_path: property.image_path, status: property.status, full_access: full,
    };
    if (full) {
      safe.description = property.description;
      safe.phone_number = property.phone_number;
    }
    res.json(safe);
  } catch (err) {
    console.error('Database error:', err);
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
  let connection;
  try {
    const {
      title, county, town, house_type, price,
      description, deposit, bedrooms, bathrooms, payment_option = 'listing',
      payment_cycle, phone_number, mpesa_number,
    } = req.body;

    if (!title || !county || !town || !house_type || !price)
      return res.status(400).json({ message: 'title, county, town, house_type and price are required' });

    // Cloudinary returns full URLs in req.files[].path
    const imagePath = req.files?.length
      ? req.files.map(f => f.path).join(',')
      : null;

    if (!PLAN_OPTIONS[payment_option]) return res.status(400).json({ message: 'Invalid payment option' });
    const phone = mpesa_number || phone_number;
    if (!phone) return res.status(400).json({ message: 'An M-Pesa number is required for listing payment' });

    // Only DB work is inside this transaction. It is committed and released
    // before the remote PesaPal request, preventing checkout from exhausting
    // the MySQL pool or leaving a half-created payment record.
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [plans] = await connection.execute(
      `SELECT active_plan, plan_expires_at FROM users
       WHERE id=? AND active_plan <> 'none' AND plan_expires_at > NOW()`,
      [req.user.id]
    );
    const covered = plans.length > 0;
    const [result] = await connection.execute(
      `INSERT INTO properties
        (title, county, town, house_type, price, description, deposit,
         bedrooms, bathrooms, image_path, payment_cycle, phone_number,
         landlord_id, verification_status, status, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title, county, town, house_type, Number(price),
        description || '', Number(deposit) || 0,
        Number(bedrooms) || 1, Number(bathrooms) || 1,
        imagePath,
        payment_cycle || 'month',
        phone_number  || '',
        req.user.id,
        'approved',
        'available',
        covered ? 'paid' : 'pending',
      ]
    );
    if (mpesa_number) await connection.execute('UPDATE users SET mpesa_number=? WHERE id=?', [mpesa_number, req.user.id]);
    if (covered) {
      await connection.commit();
      return res.status(201).json({ message: 'Property created successfully', id: result.insertId, paymentRequired: false });
    }
    const option = PLAN_OPTIONS[payment_option];
    const payment = await createPendingPayment(connection, {
      type: payment_option === 'listing' ? 'listing_fee' : 'landlord_plan',
      amount: option.amount, phone, propertyId: result.insertId, landlordId: req.user.id,
    });
    await connection.commit();
    connection.release();
    connection = null;

    try {
      const order = await submitOrder({
        amount: option.amount, reference: payment.reference, phone,
        description: payment_option === 'listing' ? `Listing activation fee for property ${result.insertId}` : option.label,
        billingAddress: await getUserBillingAddress(req.user.id),
      });
      await executePaymentWriteWithRetry('UPDATE payments SET pesapal_order_tracking_id=? WHERE id=?', [order.order_tracking_id, payment.id]);
      return res.status(201).json({ message: 'Payment required to activate property', id: result.insertId, paymentRequired: true, payment: { paymentId: payment.id, reference: payment.reference, ...order } });
    } catch (error) {
      await executePaymentWriteWithRetry("UPDATE payments SET status='failed' WHERE id=?", [payment.id]);
      throw error;
    }
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    console.error('POST /landlord/properties error:', err);
    respondPaymentError(res, err);
  } finally {
    connection?.release();
  }
});

app.put('/api/landlord/properties/:id', protect, authorize('landlord', 'admin'), upload.array('images', 10), async (req, res) => {
  try {
    const {
      title, county, town, house_type, price,
      description, deposit, bedrooms, bathrooms,
      payment_cycle, phone_number, mpesa_number,
    } = req.body;

    // Cloudinary returns full URLs in req.files[].path
    const imagePath = req.files?.length
      ? req.files.map(f => f.path).join(',')
      : null;
    const plan = req.user.role === 'landlord' ? await activePlan(req.user.id) : null;

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
    if (req.user.role === 'landlord') {
      sql += ', payment_status=?';
      params.push(plan ? 'paid' : 'pending');
    }

    if (imagePath) { sql += ', image_path=?'; params.push(imagePath); }
    sql += req.user.role === 'admin' ? ' WHERE id=?' : ' WHERE id=? AND landlord_id=?';
    params.push(req.params.id);
    if (req.user.role === 'landlord') params.push(req.user.id);

    const [result] = await db.execute(sql, params);
    if (!result.affectedRows)
      return res.status(404).json({ message: 'Property not found or not yours' });
    if (mpesa_number && req.user.role === 'landlord') await db.execute('UPDATE users SET mpesa_number=? WHERE id=?', [mpesa_number, req.user.id]);
    if (req.user.role === 'admin') return res.json({ message: 'Property updated successfully' });
    if (plan) {
      await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [req.params.id]);
      return res.json({ message: 'Property updated successfully', paymentRequired: false });
    }
    const payment = await createPayment({
      type: 'listing_fee', amount: 400,
      phone: mpesa_number || phone_number, propertyId: req.params.id, landlordId: req.user.id,
      description: `Listing renewal fee for property ${req.params.id}`,
      billingAddress: await getUserBillingAddress(req.user.id),
    });
    res.json({ message: 'Payment required to activate property', paymentRequired: true, payment });
  } catch (err) {
    console.error('PUT /landlord/properties error:', err);
    respondPaymentError(res, err);
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

app.patch('/api/landlord/properties/:id/status', protect, async (req, res) => {
  const { status } = req.body;
  if (!['landlord', 'admin'].includes(req.user.role)) return res.status(403).json({ message: 'Landlord or admin access required' });
  if (!['available', 'taken'].includes(status)) return res.status(400).json({ message: 'status must be available or taken' });
  try {
    const condition = req.user.role === 'admin' ? 'id=?' : 'id=? AND landlord_id=?';
    const params = req.user.role === 'admin' ? [status, req.params.id] : [status, req.params.id, req.user.id];
    const [result] = await db.execute(`UPDATE properties SET status=? WHERE ${condition}`, params);
    if (!result.affectedRows) return res.status(404).json({ message: 'Property not found or not yours' });
    res.json({ message: `Property marked ${status}` });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.post('/api/payments/view', optionalAuth, async (req, res) => {
  const { property_id, phone, email, first_name, last_name, country_code = 'KE' } = req.body;
  if (!property_id || !phone || !email || !first_name || !last_name)
    return res.status(400).json({ message: 'property_id, phone, email, first_name, and last_name are required' });
  try {
    const [[property]] = await db.execute("SELECT id, title, status, verification_status, payment_status FROM properties WHERE id=?", [property_id]);
    if (!property || property.status !== 'available' || property.verification_status !== 'approved')
      return res.status(409).json({ message: 'This house has been taken or is not available' });
    const payment = await createPayment({ type: 'view_fee', amount: 40, phone, propertyId: property_id, description: `View fee for property ${property_id}`, billingAddress: { email, firstName: first_name, lastName: last_name, countryCode: country_code } });
    res.status(201).json(payment);
  } catch (err) { console.error('[Payments] view-fee order failed:', err); respondPaymentError(res, err); }
});

app.post('/api/landlord/properties/:id/payment', protect, authorize('landlord'), async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: 'phone is required' });
  try {
    const [[property]] = await db.execute('SELECT id, landlord_id, payment_status FROM properties WHERE id=? AND landlord_id=?', [req.params.id, req.user.id]);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.payment_status === 'paid') return res.json({ paymentRequired: false, message: 'Property is already paid and published' });
    if (await activePlan(req.user.id)) {
      await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [property.id]);
      return res.json({ paymentRequired: false });
    }
    const payment = await createPayment({ type: 'listing_fee', amount: 400, phone, propertyId: property.id, landlordId: req.user.id, description: `Listing activation fee for property ${property.id}`, billingAddress: await getUserBillingAddress(req.user.id) });
    res.status(201).json({ paymentRequired: true, payment });
  } catch (err) { console.error('[Payments] listing-fee order failed:', err); respondPaymentError(res, err); }
});

app.post('/api/payments/plans', protect, authorize('landlord'), async (req, res) => {
  const { plan, phone } = req.body;
  if (!['monthly', 'semester'].includes(plan) || !phone) return res.status(400).json({ message: 'plan and phone are required' });
  try {
    const amount = PLAN_OPTIONS[plan].amount;
    const payment = await createPayment({ type: 'landlord_plan', amount, phone, landlordId: req.user.id, description: `${plan} landlord plan`, billingAddress: await getUserBillingAddress(req.user.id) });
    res.status(201).json(payment);
  } catch (err) { console.error('[Payments] plan order failed:', err); respondPaymentError(res, err); }
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
      approvalRate: approvalRow.rate     || 0,
      avgRent:      avgRentRow.avg_price || 0,
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

app.patch('/api/admin/listings/:id/payment-status', protect, authorize('admin'), async (req, res) => {
  const { payment_status } = req.body;
  if (!['pending', 'paid'].includes(payment_status)) return res.status(400).json({ message: 'Invalid payment_status' });
  try {
    await db.execute('UPDATE properties SET payment_status=? WHERE id=?', [payment_status, req.params.id]);
    res.json({ message: 'Payment status updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
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
      WHERE f.user_id = ? AND p.payment_status='paid' AND p.status='available'
    `, [req.user.id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   INQUIRIES
══════════════════════════════════════════════════════════════════════════ */
app.post('/api/inquiries', async (req, res) => {
  const { property_id, user_name, user_email, message, phone, payment_id } = req.body;
  if (!property_id || !user_name || !user_email || !message || !phone)
    return res.status(400).json({ message: 'property_id, user_name, user_email, phone and message are required' });
  try {
    const [[property]] = await db.execute('SELECT status FROM properties WHERE id=?', [property_id]);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.status === 'taken') return res.status(409).json({ message: 'This house has been taken' });
    const [payments] = await db.execute(
      `SELECT id FROM payments WHERE type='view_fee' AND amount=? AND status='success' AND related_property_id=? AND payer_phone=?
       AND (? IS NULL OR id=?) ORDER BY id DESC LIMIT 1`,
      [Number(process.env.VIEW_FEE_AMOUNT || 40), property_id, phone, payment_id || null, payment_id || null]
    );
    if (!payments.length) return res.status(402).json({ message: 'A successful KSh 40 view payment is required first' });
    await db.execute(
      'INSERT INTO inquiries (property_id, user_name, user_email, message, payment_id) VALUES (?,?,?,?,?)',
      [property_id, user_name.trim(), user_email.trim(), message.trim(), payments[0].id]
    );
    res.status(201).json({ message: 'Inquiry sent successfully' });
  } catch (err) {
    console.error('POST /inquiries error:', err);
    res.status(500).json({ message: err.message });
  }
});

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

async function expirePlans() {
  await db.execute("UPDATE users SET active_plan='none', plan_expires_at=NULL WHERE active_plan <> 'none' AND plan_expires_at <= NOW()");
}

async function settlePayment(orderTrackingId) {
  const transaction = await handleIPN({ OrderTrackingId: orderTrackingId });
  const statusText = String(transaction.payment_status_description || transaction.status || '').toUpperCase();
  const statusCode = Number(transaction.status_code);
  const success = statusCode === 1 || statusText === 'COMPLETED' || statusText === 'SUCCESS';
  const failed = statusCode === 2 || statusCode === 3 || statusText === 'FAILED' || statusText === 'INVALID';
  const nextStatus = success ? 'success' : failed ? 'failed' : 'pending';
  const confirmation = transaction.confirmation_code || transaction.confirmationCode || transaction.merchant_reference || null;
  const [payments] = await db.execute('SELECT * FROM payments WHERE pesapal_order_tracking_id=? LIMIT 1', [orderTrackingId]);
  if (!payments.length) return { nextStatus, ignored: true };
  const payment = payments[0];
  if (payment.status === 'success' && nextStatus === 'success') return { nextStatus, paymentId: payment.id };
  await db.execute('UPDATE payments SET status=?, confirmation_code=? WHERE id=?', [nextStatus, confirmation, payment.id]);
  if (nextStatus !== 'success') return { nextStatus, paymentId: payment.id };

  if (payment.type === 'listing_fee') {
    await db.execute("UPDATE properties SET payment_status='paid' WHERE id=? AND landlord_id=?", [payment.related_property_id, payment.related_landlord_id]);
  } else if (payment.type === 'landlord_plan') {
    const plan = Number(payment.amount) === PLAN_OPTIONS.semester.amount ? 'semester' : 'monthly';
    const interval = PLAN_OPTIONS[plan].days;
    await db.execute(`UPDATE users SET active_plan=?, plan_expires_at=DATE_ADD(NOW(), INTERVAL ${interval} DAY) WHERE id=?`, [plan, payment.related_landlord_id]);
    // A subscription selected while saving a listing covers that listing as
    // soon as PesaPal confirms the subscription payment.
    if (payment.related_property_id) await db.execute("UPDATE properties SET payment_status='paid' WHERE id=? AND landlord_id=?", [payment.related_property_id, payment.related_landlord_id]);
  }
  return { nextStatus, paymentId: payment.id };
}

app.post(['/api/payments/ipn', '/payments/ipn'], async (req, res) => {
  const trackingId = req.body?.OrderTrackingId || req.query?.OrderTrackingId || req.body?.orderTrackingId;
  if (!trackingId) return res.status(400).json({ message: 'OrderTrackingId is required' });
  console.info('[PesaPal] IPN received:', JSON.stringify({ method: req.method, trackingId, query: req.query }));
  try { const result = await settlePayment(trackingId); console.info('[PesaPal] IPN settled:', JSON.stringify(result)); res.json(result); }
  catch (err) { console.error('PesaPal IPN error:', err); respondPaymentError(res, err); }
});

app.get(['/api/payments/ipn', '/payments/ipn'], async (req, res) => {
  const trackingId = req.query?.OrderTrackingId || req.query?.orderTrackingId;
  if (!trackingId) return res.status(400).json({ message: 'OrderTrackingId is required' });
  console.info('[PesaPal] IPN received:', JSON.stringify({ method: req.method, trackingId, query: req.query }));
  try { const result = await settlePayment(trackingId); console.info('[PesaPal] IPN settled:', JSON.stringify(result)); res.json(result); }
  catch (err) { console.error('PesaPal IPN error:', err); respondPaymentError(res, err); }
});

app.get(['/api/payments/callback', '/payments/callback'], async (req, res) => {
  const trackingId = req.query.OrderTrackingId || req.query.orderTrackingId;
  if (!trackingId) return res.status(400).send('Missing payment tracking ID');
  try {
    const [[payment]] = await db.execute('SELECT related_property_id FROM payments WHERE pesapal_order_tracking_id=?', [trackingId]);
    const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (payment?.related_property_id) return res.redirect(`${frontend}/property/${payment.related_property_id}?payment=pending`);
    return res.redirect(`${frontend}/landlord?payment=pending`);
  } catch { res.send('Payment received. We are confirming it with PesaPal.'); }
});

app.post('/api/admin/payments/register-ipn', protect, authorize('admin'), async (req, res) => {
  try { res.json(await registerIPN(process.env.PESAPAL_IPN_URL)); }
  catch (err) { respondPaymentError(res, err); }
});

app.get('/api/admin/payments', protect, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute(`SELECT p.*, pr.title AS property_title, u.name AS landlord_name
      FROM payments p LEFT JOIN properties pr ON pr.id=p.related_property_id LEFT JOIN users u ON u.id=p.related_landlord_id
      ORDER BY p.created_at DESC`);
    res.json(rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.patch('/api/admin/payments/:id/resolve', protect, authorize('admin'), async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM payments WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: 'Payment not found' });
    const payment = rows[0];
    await db.execute("UPDATE payments SET status='success', confirmation_code=COALESCE(?, confirmation_code) WHERE id=?", [req.body.confirmation_code || 'MANUAL-RESOLUTION', payment.id]);
    if (payment.type === 'listing_fee') await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [payment.related_property_id]);
    if (payment.type === 'landlord_plan') {
      const plan = Number(payment.amount) === PLAN_OPTIONS.semester.amount ? 'semester' : 'monthly';
      await db.execute(`UPDATE users SET active_plan=?, plan_expires_at=DATE_ADD(NOW(), INTERVAL ${PLAN_OPTIONS[plan].days} DAY) WHERE id=?`, [plan, payment.related_landlord_id]);
      if (payment.related_property_id) await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [payment.related_property_id]);
    }
    res.json({ message: 'Payment resolved' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

app.get('/api/admin/inquiries', protect, authorize('admin'), async (req, res) => {
  try { const [rows] = await db.execute('SELECT i.*, p.title AS property_title FROM inquiries i JOIN properties p ON p.id=i.property_id ORDER BY i.created_at DESC'); res.json(rows); }
  catch (err) { res.status(500).json({ message: err.message }); }
});

expirePlans().catch(err => console.error('Plan expiry error:', err.message));
setInterval(() => expirePlans().catch(err => console.error('Plan expiry error:', err.message)), 24 * 60 * 60 * 1000);

/* ── Health check ──────────────────────────────────────────────────────── */
app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date() }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (err.name === 'MulterError') {
    return res.status(400).json({ message: err.message });
  }
  res.status(500).json({ message: 'Internal server error' });
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
