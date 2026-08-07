import 'dotenv/config';
import express        from 'express';
import cors           from 'cors';
import helmet         from 'helmet';
import rateLimit      from 'express-rate-limit';
import mysql          from 'mysql2/promise';
import bcrypt         from 'bcrypt';
import jwt            from 'jsonwebtoken';
import multer         from 'multer';
import { createHash, randomBytes } from 'node:crypto';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import { handleIPN, registerIPN, submitOrder } from './pesapalService.js';
import { pagination } from './pagination.js';
import { amenitiesForResponse, normalizeAmenities } from './utils/amenities.js';

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
    timeout:         Number(process.env.CLOUDINARY_UPLOAD_TIMEOUT_MS) || 120000,
  },
});

const upload = multer({
  storage,
  limits: {
    files: 10,
    fileSize: 8 * 1024 * 1024,
    fields: 30,
    fieldSize: 100 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) {
      return callback(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
    callback(null, true);
  },
});

const uploadRoomTypeImages = (req, res, next) => {
  upload.array('images', 10)(req, res, error => {
    if (!error) return next();
    console.error('Room image upload error:', error);
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Each room-type photo must be 8 MB or smaller.'
      : 'Room-type photo upload failed. The room type was not saved. Please try again.';
    res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 502).json({
      message,
      code: 'ROOM_TYPE_IMAGE_UPLOAD_FAILED',
    });
  });
};

const app  = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === 'production';
const PAYMENTS_ENABLED = String(process.env.PAYMENTS_ENABLED || 'false').toLowerCase() === 'true';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be configured');
}

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'none'"],
      baseUri: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'none'"],
    },
  },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  crossOriginResourcePolicy: false,
}));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many sign-in attempts. Please try again later.' },
});
const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many payment attempts. Please try again later.' },
});

/* ── CORS ───────────────────────────────────────────────────────────────── */
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    process.env.FRONTEND_URL,        // add your frontend URL in env variables
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-View-Access-Token'],
  maxAge: 86400,
  credentials: false,
}));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use('/api', apiLimiter);

/* ── DB pool ────────────────────────────────────────────────────────────── */
const db = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'house_hunting',
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
  monthly: { amount: Number(process.env.MONTHLY_PLAN_AMOUNT || 1000), days: 30, label: 'Monthly subscription' },
  semester: { amount: Number(process.env.SEMESTER_PLAN_AMOUNT || 3000), days: 120, label: 'Semester subscription' },
  listing: { amount: Number(process.env.LISTING_FEE_AMOUNT || 400), label: 'Pay-per-listing' },
};

const VIEW_FEE_AMOUNT = Number(process.env.VIEW_FEE_AMOUNT || 40);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const trimText = (value, maxLength) => String(value || '').trim().slice(0, maxLength);
const tokenHash = token => createHash('sha256').update(token).digest('hex');
const viewAccessToken = () => randomBytes(32).toString('base64url');
const paginated = (rows, page, limit) => ({ data: rows, pagination: { page, limit, hasMore: rows.length === limit } });
const signToken = user => jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: '7d', algorithm: 'HS256' },
);

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
    return res.status(502).json({ message: 'The payment provider is temporarily unavailable. Please try again.', code: error.code });
  }
  if (isTransientDbError(error)) {
    return res.status(503).json({ message: 'The payment service temporarily lost its database connection. Please try again.', code: 'PAYMENT_DATABASE_CONNECTION_RESET' });
  }
  return res.status(502).json({ message: 'Unable to start payment. Please try again.', code: 'PAYMENT_INITIATION_FAILED' });
}

/* test connection on startup */
db.getConnection()
  .then(c => { console.log('✅ MySQL connected'); c.release(); })
  .catch(e => console.error('❌ MySQL connection failed:', e.message));

/* ── Auth middleware ────────────────────────────────────────────────────── */
const protect = async (req, res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const [[user]] = await executeReadWithRetry('SELECT id, role, account_status FROM users WHERE id=? LIMIT 1', [decoded.id]);
    if (!user || user.account_status === 'suspended') return res.status(403).json({ message: 'Account suspended. Contact support.' });
    req.user = { id: user.id, role: user.role };
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
    try { req.user = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] }); } catch { /* public request */ }
  }
  next();
};

const setPublicCache = (req, res, cacheable) => {
  res.set('Vary', 'Authorization, X-View-Access-Token');
  res.set('Cache-Control', cacheable
    ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=30'
    : 'private, no-store');
};

const ROOM_HOUSE_TYPES = new Set([
  'Bedsitter', 'Single Room', 'One Bedroom', 'Two Bedroom',
  'Three Bedroom', 'Four Bedroom', 'Penthouse', 'Studio',
]);
const ROOM_STATUSES = new Set(['available', 'taken']);
const LISTING_TYPES = new Set(['single', 'multi_room']);
const publicFields = 'p.id, p.title, p.county, p.town, p.house_type, p.price, p.payment_cycle, p.image_path, p.amenities, p.status, p.bedrooms, p.bathrooms, p.listing_type, p.created_at';
const legacyPublicFields = publicFields.replace(', p.listing_type', '');
const multiRoomVisibility = `
        AND (
          p.listing_type = 'single'
          OR EXISTS (
            SELECT 1
            FROM room_types rt
            JOIN rooms available_room
              ON available_room.room_type_id = rt.id
             AND available_room.status = 'available'
            WHERE rt.property_id = p.id
          )
        )`;
const propertyWithAmenities = property => ({ ...property, amenities: amenitiesForResponse(property.amenities) });
const isAdmin = req => req.user?.role === 'admin';
const isOwner = (req, property) => req.user?.role === 'landlord' && Number(req.user.id) === Number(property.landlord_id);

function uploadedImageUrls(files = []) {
  const urls = files.map(file => file.path);
  if (urls.some(url => typeof url !== 'string' || !url.trim())) {
    const error = new Error('Image upload did not return a URL');
    error.code = 'ROOM_TYPE_IMAGE_UPLOAD_FAILED';
    throw error;
  }
  return urls;
}

function validRoomQuantity(value) {
  const quantity = Number(value ?? 1);
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 100 ? quantity : null;
}

async function getRoomTypes(propertyId, includeUnavailableRooms = false) {
  const roomJoin = includeUnavailableRooms
    ? 'LEFT JOIN rooms r ON r.room_type_id = rt.id'
    : "JOIN rooms r ON r.room_type_id = rt.id AND r.status = 'available'";
  const availabilityFilter = includeUnavailableRooms
    ? ''
    : `AND EXISTS (
         SELECT 1 FROM rooms available_room
         WHERE available_room.room_type_id = rt.id
           AND available_room.status = 'available'
       )`;
  const [rows] = await executeReadWithRetry(
    `SELECT rt.id AS room_type_id, rt.property_id, rt.house_type, rt.price,
            rt.description, rt.created_at AS room_type_created_at,
            (SELECT COUNT(*)
             FROM rooms available_room
             WHERE available_room.room_type_id = rt.id
               AND available_room.status = 'available') AS available_count,
            r.id AS room_id, r.room_label, r.status AS room_status,
            r.created_at AS room_created_at,
            rti.id AS type_image_id, rti.image_url AS type_image_url,
            rti.display_order AS type_image_display_order
     FROM room_types rt
     ${roomJoin}
     LEFT JOIN room_type_images rti ON rti.room_type_id = rt.id
     WHERE rt.property_id = ?
       ${availabilityFilter}
     ORDER BY rt.id ASC, r.id ASC, rti.display_order ASC, rti.id ASC`,
    [propertyId],
  );

  const roomTypes = new Map();
  for (const row of rows) {
    let roomType = roomTypes.get(row.room_type_id);
    if (!roomType) {
      roomType = {
        id: row.room_type_id,
        property_id: row.property_id,
        house_type: row.house_type,
        price: row.price,
        description: row.description,
        created_at: row.room_type_created_at,
        available_count: Number(row.available_count),
        images: [],
        rooms: [],
      };
      roomTypes.set(row.room_type_id, roomType);
    }

    let room = row.room_id === null ? null : roomType.rooms.find(item => item.id === row.room_id);
    if (row.room_id !== null && !room) {
      room = {
        id: row.room_id,
        room_label: row.room_label,
        status: row.room_status,
        created_at: row.room_created_at,
      };
      roomType.rooms.push(room);
    }
    if (row.type_image_id && !roomType.images.some(image => image.id === row.type_image_id)) {
      roomType.images.push({
        id: row.type_image_id,
        image_url: row.type_image_url,
        display_order: row.type_image_display_order,
      });
    }
  }
  return [...roomTypes.values()].map(roomType => ({
    ...roomType,
    sample_photo: roomType.images[0] || null,
  }));
}

async function getPublicRoomTypes(propertyId) {
  const [rows] = await executeReadWithRetry(
    `SELECT rt.id AS room_type_id, rt.property_id, rt.house_type, rt.price,
            rt.description, rt.created_at AS room_type_created_at,
            (SELECT COUNT(*)
             FROM rooms available_room
             WHERE available_room.room_type_id = rt.id
               AND available_room.status = 'available') AS available_count,
            rti.id AS sample_image_id, rti.image_url AS sample_image_url,
            rti.display_order AS sample_image_display_order
     FROM room_types rt
     LEFT JOIN room_type_images rti
       ON rti.id = (
         SELECT first_image.id
         FROM room_type_images first_image
         WHERE first_image.room_type_id = rt.id
         ORDER BY first_image.display_order ASC, first_image.id ASC
         LIMIT 1
       )
     WHERE rt.property_id = ?
       AND EXISTS (
         SELECT 1 FROM rooms available_room
         WHERE available_room.room_type_id = rt.id
           AND available_room.status = 'available'
       )
     ORDER BY rt.id ASC`,
    [propertyId],
  );

  return rows.map(row => ({
    id: row.room_type_id,
    property_id: row.property_id,
    house_type: row.house_type,
    price: row.price,
    description: row.description,
    created_at: row.room_type_created_at,
    available_count: Number(row.available_count),
    sample_photo: row.sample_image_id ? {
      id: row.sample_image_id,
      image_url: row.sample_image_url,
      display_order: row.sample_image_display_order,
    } : null,
  }));
}

async function getOwnedProperty(propertyId, user) {
  const [[property]] = await db.execute(
    `SELECT id, listing_type FROM properties
     WHERE id=?${user.role === 'admin' ? '' : ' AND landlord_id=?'}
     LIMIT 1`,
    user.role === 'admin' ? [propertyId] : [propertyId, user.id],
  );
  return property || null;
}

async function getOwnedRoomType(roomTypeId, user) {
  const [[roomType]] = await db.execute(
    `SELECT rt.id, rt.property_id, rt.house_type, rt.price, rt.description,
            p.listing_type
     FROM room_types rt
     JOIN properties p ON p.id = rt.property_id
     WHERE rt.id=?${user.role === 'admin' ? '' : ' AND p.landlord_id=?'}
     LIMIT 1`,
    user.role === 'admin' ? [roomTypeId] : [roomTypeId, user.id],
  );
  return roomType || null;
}

async function getOwnedRoom(roomId, user) {
  const [[room]] = await db.execute(
    `SELECT r.id, r.room_type_id, r.room_label, r.status,
            rt.property_id, p.listing_type
     FROM rooms r
     JOIN room_types rt ON rt.id = r.room_type_id
     JOIN properties p ON p.id = rt.property_id
     WHERE r.id=?${user.role === 'admin' ? '' : ' AND p.landlord_id=?'}
     LIMIT 1`,
    user.role === 'admin' ? [roomId] : [roomId, user.id],
  );
  return room || null;
}

function validRoomTypePrice(value) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

async function hasPaidView(req, propertyId) {
  if (!PAYMENTS_ENABLED) return true;
  if (isAdmin(req)) return true;
  const [[property]] = await db.execute('SELECT landlord_id FROM properties WHERE id=?', [propertyId]);
  if (property && req.user?.role === 'landlord' && Number(req.user.id) === Number(property.landlord_id)) return true;
  const accessToken = String(req.headers['x-view-access-token'] || req.query?.view_token || '');
  if (!accessToken || accessToken.length < 32) return false;
  const [rows] = await db.execute(
    `SELECT p.id FROM payments p
     WHERE p.type='view_fee' AND p.status='success' AND p.related_property_id=?
       AND p.view_access_token_hash=?
     LIMIT 1`,
    [propertyId, tokenHash(accessToken)]
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

async function createPayment({ type, amount, phone, propertyId = null, landlordId = null, description, billingAddress, viewAccessToken = null }) {
  const reference = `${type}-${propertyId || landlordId || 'platform'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const insertSql = `INSERT INTO payments (type, amount, payer_phone, related_property_id, related_landlord_id, pesapal_merchant_reference, view_access_token_hash, status)
    VALUES (?,?,?,?,?,?,?, 'pending')`;
  const insertParams = [type, amount, phone, propertyId, landlordId, reference, viewAccessToken ? tokenHash(viewAccessToken) : null];
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
    return { paymentId: result.insertId, reference, ...(viewAccessToken ? { view_access_token: viewAccessToken } : {}), ...order };
  } catch (error) {
    console.error('[Payments] PesaPal order failed:', JSON.stringify({ type, amount, propertyId, landlordId, reference, error: error.message }));
    await executePaymentWriteWithRetry('UPDATE payments SET status=? WHERE id=?', ['failed', result.insertId]);
    throw error;
  }
}

async function createPendingPayment(connection, { type, amount, phone, propertyId = null, landlordId = null }) {
  const reference = `${type}-${propertyId || landlordId || 'platform'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [result] = await connection.execute(
    `INSERT INTO payments (type, amount, payer_phone, related_property_id, related_landlord_id, pesapal_merchant_reference, view_access_token_hash, status)
     VALUES (?,?,?,?,?,?,?, 'pending')`,
    [type, amount, phone, propertyId, landlordId, reference, null]
  );
  return { id: result.insertId, reference };
}

/* ══════════════════════════════════════════════════════════════════════════
   AUTH
══════════════════════════════════════════════════════════════════════════ */
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const name = trimText(req.body.name, 100);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const role = req.body.role || 'tenant';
  const termsAccepted = req.body.terms_accepted === true;
  if (!name || !email || !password)
    return res.status(400).json({ message: 'Name, email and password are required' });
  if (!termsAccepted) return res.status(400).json({ message: 'You must accept the Terms & Conditions and Privacy Policy to create an account.' });
  if (!EMAIL_RE.test(email)) return res.status(400).json({ message: 'Enter a valid email address' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ message: 'Password must be between 10 and 128 characters' });
  if (!['tenant', 'landlord'].includes(role)) return res.status(400).json({ message: 'Invalid account role' });
  try {
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(400).json({ message: 'Email already registered' });

    const hashed   = await bcrypt.hash(password, 10);
    const safeRole = role;
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, role, account_status, terms_accepted, terms_accepted_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP)',
      [name, email, hashed, safeRole, 'active', true]
    );
    const token = signToken({ id: result.insertId, role: safeRole });
    res.status(201).json({ token, user: { id: result.insertId, name, email, role: safeRole } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Unable to create account' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required' });
  try {
    const [rows] = await executeReadWithRetry('SELECT id, name, email, password, role, account_status FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(401).json({ message: 'Invalid email or password' });

    const user    = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    if (user.account_status === 'suspended')
      return res.status(403).json({ message: 'Account suspended. Contact support.' });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(transientDbErrors.has(err.code) ? 503 : 500).json({ message: transientDbErrors.has(err.code) ? 'Database is temporarily unavailable. Please try again.' : 'Unable to sign in' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   PUBLIC PROPERTIES
══════════════════════════════════════════════════════════════════════════ */
app.get('/api/users/me', protect, async (req, res) => {
  try {
    const [[user]] = await db.execute(
      'SELECT id, name, email, role, mpesa_number AS phone FROM users WHERE id=? LIMIT 1',
      [req.user.id],
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user });
  } catch {
    res.status(500).json({ message: 'Unable to load profile' });
  }
});

app.patch('/api/users/me', protect, async (req, res) => {
  const name = trimText(req.body.name, 100);
  const email = normalizeEmail(req.body.email);
  const phone = trimText(req.body.phone, 32);
  if (!name || !EMAIL_RE.test(email)) return res.status(400).json({ message: 'A name and valid email address are required' });
  try {
    const [existing] = await db.execute('SELECT id FROM users WHERE email=? AND id<>? LIMIT 1', [email, req.user.id]);
    if (existing.length) return res.status(409).json({ message: 'Email already registered' });
    await db.execute('UPDATE users SET name=?, email=?, mpesa_number=? WHERE id=?', [name, email, phone || null, req.user.id]);
    res.json({ user: { id: req.user.id, name, email, phone, role: req.user.role } });
  } catch {
    res.status(500).json({ message: 'Unable to update profile' });
  }
});

app.post('/api/users/me/password', protect, authLimiter, async (req, res) => {
  const currentPassword = String(req.body.current_password || '');
  const newPassword = String(req.body.new_password || '');
  if (!currentPassword || newPassword.length < 10 || newPassword.length > 128) {
    return res.status(400).json({ message: 'Current password and a new 10–128 character password are required' });
  }
  try {
    const [[user]] = await db.execute('SELECT password FROM users WHERE id=? LIMIT 1', [req.user.id]);
    if (!user || !await bcrypt.compare(currentPassword, user.password)) return res.status(401).json({ message: 'Current password is incorrect' });
    await db.execute('UPDATE users SET password=? WHERE id=?', [await bcrypt.hash(newPassword, 10), req.user.id]);
    res.json({ message: 'Password updated' });
  } catch {
    res.status(500).json({ message: 'Unable to update password' });
  }
});

app.get('/api/properties', optionalAuth, async (req, res) => {
  try {
    const { county, town, house_type, bedrooms, minPrice, maxPrice, sort, search } = req.query;
    let q = `
      SELECT ${publicFields}
      FROM properties p
      WHERE p.verification_status = 'approved' AND p.payment_status = 'paid'
        ${multiRoomVisibility}
    `;
    const params = [];
    if (!isAdmin(req)) q += ` AND p.status = 'available'`;
    if (search) {
      q += ` AND (
        p.title LIKE ? OR p.town LIKE ? OR p.county LIKE ? OR p.house_type LIKE ?
        OR EXISTS (
          SELECT 1
          FROM room_types rt
          JOIN rooms available_room
            ON available_room.room_type_id = rt.id
           AND available_room.status = 'available'
          WHERE rt.property_id = p.id
            AND rt.house_type LIKE ?
        )
      )`;
      const searchTerm = `%${trimText(search, 100)}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }
    if (county)     { q += ' AND p.county = ?';     params.push(county); }
    if (town)       { q += ' AND p.town LIKE ?';     params.push(`%${town}%`); }
    if (house_type) {
      q += ` AND (
        p.house_type = ?
        OR EXISTS (
          SELECT 1
          FROM room_types rt
          JOIN rooms available_room
            ON available_room.room_type_id = rt.id
           AND available_room.status = 'available'
          WHERE rt.property_id = p.id
            AND rt.house_type = ?
        )
      )`;
      params.push(house_type, house_type);
    }
    if (bedrooms)   { q += ' AND p.bedrooms = ?';    params.push(bedrooms); }
    if (minPrice)   { q += ' AND p.price >= ?';      params.push(minPrice); }
    if (maxPrice)   { q += ' AND p.price <= ?';      params.push(maxPrice); }
    const { page, limit, offset } = pagination(req.query);
    q += sort === 'lowest'  ? ' ORDER BY p.price ASC'
       : sort === 'highest' ? ' ORDER BY p.price DESC'
       : ' ORDER BY p.created_at DESC';
    q += ` LIMIT ${limit} OFFSET ${offset}`;
    let rows;
    try {
      [rows] = await executeReadWithRetry(q, params);
    } catch (err) {
      if (!['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(err.code)) throw err;
      const legacyQuery = q
        .replace(`SELECT ${publicFields}`, `SELECT ${legacyPublicFields}`)
        .replace(multiRoomVisibility, '');
      [rows] = await executeReadWithRetry(legacyQuery, params);
    }
    setPublicCache(req, res, !req.user);
    res.json(paginated(rows.map(property => ({
      ...propertyWithAmenities(property),
      payments_enabled: PAYMENTS_ENABLED,
    })), page, limit));
  } catch (err) {
    console.error('GET /properties error:', err);
    res.status(500).json({ message: 'Unable to load properties' });
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
    if (!privileged && (property.status === 'taken' || property.verification_status !== 'approved' || property.payment_status !== 'paid'))
      return res.status(404).json({ message: 'Property not found' });
    if (!privileged && property.listing_type === 'multi_room') {
      const [[visible]] = await executeReadWithRetry(
        `SELECT p.id
         FROM properties p
         WHERE p.id=?
           AND EXISTS (
             SELECT 1
             FROM room_types rt
             JOIN rooms available_room
               ON available_room.room_type_id = rt.id
              AND available_room.status = 'available'
             WHERE rt.property_id = p.id
           )`,
        [property.id],
      );
      if (!visible) return res.status(404).json({ message: 'Property not found' });
    }
    const full = privileged || await hasPaidView(req, property.id);
    const safe = {
      id: property.id, title: property.title, county: property.county, town: property.town,
      house_type: property.house_type, price: property.price, payment_cycle: property.payment_cycle,
      image_path: property.image_path, amenities: amenitiesForResponse(property.amenities),
      status: property.status, listing_type: property.listing_type, full_access: full,
      payments_enabled: PAYMENTS_ENABLED,
    };
    if (full) {
      safe.description = property.description;
      safe.phone_number = property.phone_number;
    }
    if (property.listing_type === 'multi_room') {
      safe.room_types = privileged
        ? await getRoomTypes(property.id, true)
        : await getPublicRoomTypes(property.id);
    }
    setPublicCache(req, res, !req.user && !req.headers['x-view-access-token'] && !req.query.view_token && !full);
    res.json(safe);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).json({ message: 'Unable to load this property' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   LANDLORD
══════════════════════════════════════════════════════════════════════════ */
app.get('/api/landlord/dashboard', protect, authorize('landlord'), async (req, res) => {
  try {
    const [[propertyStats]] = await db.execute(
      `SELECT COUNT(*) AS total,
              SUM(verification_status='approved') AS active,
              SUM(verification_status='pending') AS pending
       FROM properties WHERE landlord_id = ?`,
      [req.user.id]
    );
    const [properties] = await db.execute(
      'SELECT * FROM properties WHERE landlord_id = ? ORDER BY created_at DESC LIMIT 3',
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
        total:     Number(propertyStats.total || 0),
        active:    Number(propertyStats.active || 0),
        pending:   Number(propertyStats.pending || 0),
        inquiries: inquiries.length,
      },
      properties: properties.map(propertyWithAmenities),
      inquiries,
    });
  } catch (err) {
    console.error('Landlord dashboard error:', err);
    res.status(500).json({ message: 'Error loading dashboard' });
  }
});

app.get('/api/landlord/my-properties', protect, authorize('landlord', 'admin'), async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const propertyFilter = req.user.role === 'admin' ? '' : ' WHERE landlord_id = ?';
    const propertyParams = req.user.role === 'admin' ? [] : [req.user.id];
    const [rows] = await db.execute(
      `SELECT * FROM properties${propertyFilter} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      propertyParams,
    );
    res.json(paginated(rows.map(property => ({
      ...propertyWithAmenities(property),
      payments_enabled: PAYMENTS_ENABLED,
    })), page, limit));
  } catch (err) {
    console.error('My-properties error:', err);
    res.status(500).json({ message: 'Unable to load properties' });
  }
});

app.post('/api/landlord/properties', protect, authorize('landlord', 'admin'), upload.array('images', 10), async (req, res) => {
  let connection;
  try {
    const {
      title, county, town, house_type, price,
      description, deposit, bedrooms, bathrooms, payment_option = 'listing',
      payment_cycle, phone_number, mpesa_number, listing_type = 'single', amenities: rawAmenities = [],
    } = req.body;

    const amenities = normalizeAmenities(rawAmenities);
    if (amenities === null)
      return res.status(400).json({ message: 'amenities must be an array of strings' });

    if (!title || !county || !town || !house_type || !price)
      return res.status(400).json({ message: 'title, county, town, house_type and price are required' });
    if (!LISTING_TYPES.has(listing_type))
      return res.status(400).json({ message: 'listing_type must be single or multi_room' });

    // Cloudinary returns full URLs in req.files[].path
    const imagePath = req.files?.length
      ? req.files.map(f => f.path).join(',')
      : null;

    if (!PLAN_OPTIONS[payment_option]) return res.status(400).json({ message: 'Invalid payment option' });
    const phone = mpesa_number || phone_number;
    if (PAYMENTS_ENABLED && req.user.role !== 'admin' && !phone) return res.status(400).json({ message: 'An M-Pesa number is required for listing payment' });

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
    const covered = req.user.role === 'admin'
      || !PAYMENTS_ENABLED
      || plans.length > 0;
    const [result] = await connection.execute(
      `INSERT INTO properties
        (title, county, town, house_type, listing_type, price, description, deposit,
         bedrooms, bathrooms, image_path, payment_cycle, phone_number,
         amenities, landlord_id, verification_status, status, payment_status)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        title, county, town, house_type, listing_type, Number(price),
        description || '', Number(deposit) || 0,
        Number(bedrooms) || 1, Number(bathrooms) || 1,
        imagePath,
        payment_cycle || 'month',
        phone_number  || '',
        JSON.stringify(amenities),
        req.user.id,
        PAYMENTS_ENABLED ? 'approved' : 'pending',
        'available',
        covered ? 'paid' : 'pending',
      ]
    );
    if (mpesa_number) await connection.execute('UPDATE users SET mpesa_number=? WHERE id=?', [mpesa_number, req.user.id]);
    if (covered) {
      await connection.commit();
      return res.status(201).json({
        message: PAYMENTS_ENABLED ? 'Property created successfully' : 'Property submitted for admin approval',
        id: result.insertId,
        paymentRequired: false,
        paymentsEnabled: PAYMENTS_ENABLED,
      });
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
      return res.status(201).json({ message: 'Payment required to activate property', id: result.insertId, paymentRequired: true, paymentsEnabled: PAYMENTS_ENABLED, payment: { paymentId: payment.id, reference: payment.reference, ...order } });
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
      payment_cycle, phone_number, mpesa_number, listing_type,
    } = req.body;
    const hasAmenities = Object.prototype.hasOwnProperty.call(req.body, 'amenities');
    const hasListingType = Object.prototype.hasOwnProperty.call(req.body, 'listing_type');
    const amenities = hasAmenities ? normalizeAmenities(req.body.amenities) : null;
    if (hasAmenities && amenities === null)
      return res.status(400).json({ message: 'amenities must be an array of strings' });
    if (hasListingType && !LISTING_TYPES.has(listing_type))
      return res.status(400).json({ message: 'listing_type must be single or multi_room' });

    // Cloudinary returns full URLs in req.files[].path
    const imagePath = req.files?.length
      ? req.files.map(f => f.path).join(',')
      : null;
    const plan = PAYMENTS_ENABLED && req.user.role === 'landlord' ? await activePlan(req.user.id) : null;

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
      params.push(!PAYMENTS_ENABLED || plan ? 'paid' : 'pending');
    }

    if (hasListingType) { sql += ', listing_type=?'; params.push(listing_type); }
    if (imagePath) { sql += ', image_path=?'; params.push(imagePath); }
    if (hasAmenities) { sql += ', amenities=?'; params.push(JSON.stringify(amenities)); }
    sql += req.user.role === 'admin' ? ' WHERE id=?' : ' WHERE id=? AND landlord_id=?';
    params.push(req.params.id);
    if (req.user.role === 'landlord') params.push(req.user.id);

    const [result] = await db.execute(sql, params);
    if (!result.affectedRows)
      return res.status(404).json({ message: 'Property not found or not yours' });
    if (mpesa_number && req.user.role === 'landlord') await db.execute('UPDATE users SET mpesa_number=? WHERE id=?', [mpesa_number, req.user.id]);
    if (req.user.role === 'admin') return res.json({ message: 'Property updated successfully' });
    if (!PAYMENTS_ENABLED) return res.json({ message: 'Property updated successfully', paymentRequired: false });
    if (plan) {
      await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [req.params.id]);
      return res.json({ message: 'Property updated successfully', paymentRequired: false });
    }
    const payment = await createPayment({
      type: 'listing_fee', amount: PLAN_OPTIONS.listing.amount,
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
    console.error('Delete property error:', err);
    res.status(500).json({ message: 'Unable to delete property' });
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
  } catch (err) { console.error('Property status error:', err); res.status(500).json({ message: 'Unable to update property status' }); }
});

/* ── MULTI-ROOM BUILDINGS ───────────────────────────────────────────────── */
app.post('/api/properties/:id/room-types', protect, authorize('landlord', 'admin'), uploadRoomTypeImages, async (req, res) => {
  let connection;
  try {
    const property = await getOwnedProperty(req.params.id, req.user);
    if (!property) return res.status(404).json({ message: 'Property not found or not yours' });
    if (property.listing_type !== 'multi_room')
      return res.status(400).json({ message: 'Room types require a multi_room property' });

    const houseType = trimText(req.body.house_type, 50);
    const price = validRoomTypePrice(req.body.price);
    if (!ROOM_HOUSE_TYPES.has(houseType))
      return res.status(400).json({ message: 'Invalid room type house_type' });
    if (price === null) return res.status(400).json({ message: 'A positive room type price is required' });

    const description = req.body.description === undefined || req.body.description === null || req.body.description === ''
      ? null
      : trimText(req.body.description, 5000);
    const imageUrls = uploadedImageUrls(req.files || []);
    connection = await db.getConnection();
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO room_types (property_id, house_type, price, description)
       VALUES (?,?,?,?)`,
      [property.id, houseType, price, description],
    );
    if (imageUrls.length) {
      const values = imageUrls.map(() => '(?,?,?)').join(',');
      const params = imageUrls.flatMap((image_url, display_order) => [result.insertId, image_url, display_order]);
      await connection.execute(`INSERT INTO room_type_images (room_type_id, image_url, display_order) VALUES ${values}`, params);
    }
    await connection.commit();
    res.status(201).json({
      message: 'Room type created',
      room_type: { id: result.insertId, property_id: property.id, house_type: houseType, price, description, images: imageUrls.map((image_url, display_order) => ({ image_url, display_order })), rooms: [] },
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    if (err.code === 'ROOM_TYPE_IMAGE_UPLOAD_FAILED') {
      return res.status(502).json({ message: 'Room-type photo upload failed. The room type was not saved. Please try again.', code: err.code });
    }
    console.error('Create room type error:', err);
    res.status(500).json({ message: 'Unable to create room type' });
  } finally {
    connection?.release();
  }
});

app.patch('/api/properties/:id/room-types/:roomTypeId', protect, authorize('landlord', 'admin'), uploadRoomTypeImages, async (req, res) => {
  let connection;
  try {
    const roomType = await getOwnedRoomType(req.params.roomTypeId, req.user);
    if (!roomType || Number(roomType.property_id) !== Number(req.params.id))
      return res.status(404).json({ message: 'Room type not found or not yours' });
    if (roomType.listing_type !== 'multi_room')
      return res.status(400).json({ message: 'Room types require a multi_room property' });

    const hasPrice = Object.prototype.hasOwnProperty.call(req.body, 'price');
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
    const hasImages = (req.files || []).length > 0;
    if (!hasPrice && !hasDescription && !hasImages)
      return res.status(400).json({ message: 'price, description, or photos are required' });

    const updates = [];
    const params = [];
    if (hasPrice) {
      const price = validRoomTypePrice(req.body.price);
      if (price === null) return res.status(400).json({ message: 'A positive room type price is required' });
      updates.push('price=?');
      params.push(price);
    }
    if (hasDescription) {
      updates.push('description=?');
      params.push(req.body.description === null || req.body.description === '' ? null : trimText(req.body.description, 5000));
    }
    params.push(roomType.id);
    const imageUrls = hasImages ? uploadedImageUrls(req.files || []) : [];
    connection = await db.getConnection();
    await connection.beginTransaction();
    if (updates.length) await connection.execute(`UPDATE room_types SET ${updates.join(', ')} WHERE id=?`, params);
    if (hasImages) {
      await connection.execute('DELETE FROM room_type_images WHERE room_type_id=?', [roomType.id]);
      const values = imageUrls.map(() => '(?,?,?)').join(',');
      const imageParams = imageUrls.flatMap((image_url, display_order) => [roomType.id, image_url, display_order]);
      await connection.execute(`INSERT INTO room_type_images (room_type_id, image_url, display_order) VALUES ${values}`, imageParams);
    }
    await connection.commit();
    res.json({ message: 'Room type updated' });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    if (err.code === 'ROOM_TYPE_IMAGE_UPLOAD_FAILED') {
      return res.status(502).json({ message: 'Room-type photo upload failed. The room type was not updated. Please try again.', code: err.code });
    }
    console.error('Update room type error:', err);
    res.status(500).json({ message: 'Unable to update room type' });
  } finally {
    connection?.release();
  }
});

app.delete('/api/properties/:id/room-types/:roomTypeId', protect, authorize('landlord', 'admin'), async (req, res) => {
  try {
    const roomType = await getOwnedRoomType(req.params.roomTypeId, req.user);
    if (!roomType || Number(roomType.property_id) !== Number(req.params.id))
      return res.status(404).json({ message: 'Room type not found or not yours' });
    const [result] = await db.execute('DELETE FROM room_types WHERE id=?', [roomType.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Room type not found or not yours' });
    res.json({ message: 'Room type deleted' });
  } catch (err) {
    console.error('Delete room type error:', err);
    res.status(500).json({ message: 'Unable to delete room type' });
  }
});

app.post('/api/room-types/:roomTypeId/rooms', protect, authorize('landlord', 'admin'), async (req, res) => {
  let connection;
  try {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Room creation accepts JSON only; add photos to the room type.' });
    const roomType = await getOwnedRoomType(req.params.roomTypeId, req.user);
    if (!roomType) return res.status(404).json({ message: 'Room type not found or not yours' });
    if (roomType.listing_type !== 'multi_room')
      return res.status(400).json({ message: 'Rooms require a multi_room property' });

    const quantity = validRoomQuantity(req.body.quantity);
    if (quantity === null) return res.status(400).json({ message: 'quantity must be an integer between 1 and 100' });
    const requestedLabel = trimText(req.body.room_label, 100);

    connection = await db.getConnection();
    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      'SELECT room_label FROM rooms WHERE room_type_id=? FOR UPDATE',
      [roomType.id],
    );
    const usedLabels = new Set(existingRows.map(row => row.room_label));
    const labels = [];
    if (quantity === 1 && requestedLabel) labels.push(requestedLabel);
    while (labels.length < quantity) {
      let suffix = 1;
      let label;
      do {
        label = `${roomType.house_type} ${suffix}`;
        suffix += 1;
      } while (usedLabels.has(label) || labels.includes(label));
      labels.push(label);
      usedLabels.add(label);
    }
    const values = labels.map(() => '(?,?)').join(',');
    await connection.execute(
      `INSERT INTO rooms (room_type_id, room_label) VALUES ${values}`,
      labels.flatMap(roomLabel => [roomType.id, roomLabel]),
    );
    const placeholders = labels.map(() => '?').join(',');
    const [createdRooms] = await connection.execute(
      `SELECT id, room_type_id, room_label, status FROM rooms WHERE room_type_id=? AND room_label IN (${placeholders}) ORDER BY id ASC`,
      [roomType.id, ...labels],
    );
    await connection.commit();
    res.status(201).json({
      message: `${createdRooms.length} room${createdRooms.length === 1 ? '' : 's'} created`,
      rooms: createdRooms,
    });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'room_label is already used in this room type' });
    console.error('Create room error:', err);
    res.status(500).json({ message: 'Unable to create room' });
  } finally {
    connection?.release();
  }
});

app.patch('/api/rooms/:roomId', protect, authorize('landlord', 'admin'), async (req, res) => {
  let connection;
  try {
    if (!req.is('application/json')) return res.status(415).json({ message: 'Room updates accept JSON only; room photos belong to the room type.' });
    const room = await getOwnedRoom(req.params.roomId, req.user);
    if (!room) return res.status(404).json({ message: 'Room not found or not yours' });
    if (room.listing_type !== 'multi_room')
      return res.status(400).json({ message: 'Rooms require a multi_room property' });

    const hasLabel = Object.prototype.hasOwnProperty.call(req.body, 'room_label');
    if (!hasLabel) return res.status(400).json({ message: 'room_label is required' });
    const roomLabel = trimText(req.body.room_label, 100);
    if (!roomLabel) return res.status(400).json({ message: 'room_label is required' });

    connection = await db.getConnection();
    await connection.beginTransaction();
    await connection.execute('UPDATE rooms SET room_label=? WHERE id=?', [roomLabel, room.id]);
    await connection.commit();
    res.json({ message: 'Room updated' });
  } catch (err) {
    if (connection) await connection.rollback().catch(() => {});
    if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'room_label is already used in this room type' });
    console.error('Update room error:', err);
    res.status(500).json({ message: 'Unable to update room' });
  } finally {
    connection?.release();
  }
});

app.patch('/api/rooms/:roomId/status', protect, authorize('landlord', 'admin'), async (req, res) => {
  try {
    const room = await getOwnedRoom(req.params.roomId, req.user);
    if (!room) return res.status(404).json({ message: 'Room not found or not yours' });
    if (room.listing_type !== 'multi_room')
      return res.status(400).json({ message: 'Rooms require a multi_room property' });
    if (!ROOM_STATUSES.has(req.body.status))
      return res.status(400).json({ message: 'status must be available or taken' });
    await db.execute('UPDATE rooms SET status=? WHERE id=?', [req.body.status, room.id]);
    res.json({ message: `Room marked ${req.body.status}`, status: req.body.status });
  } catch (err) {
    console.error('Room status error:', err);
    res.status(500).json({ message: 'Unable to update room status' });
  }
});

app.delete('/api/rooms/:roomId', protect, authorize('landlord', 'admin'), async (req, res) => {
  try {
    const room = await getOwnedRoom(req.params.roomId, req.user);
    if (!room) return res.status(404).json({ message: 'Room not found or not yours' });
    const [result] = await db.execute('DELETE FROM rooms WHERE id=?', [room.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Room not found or not yours' });
    res.json({ message: 'Room deleted' });
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ message: 'Unable to delete room' });
  }
});

app.post('/api/payments/view', paymentLimiter, optionalAuth, async (req, res) => {
  const { property_id, phone, email, first_name, last_name, country_code = 'KE' } = req.body;
  if (!property_id || !phone || !email || !first_name || !last_name)
    return res.status(400).json({ message: 'property_id, phone, email, first_name, and last_name are required' });
  try {
    const [[property]] = await db.execute("SELECT id, title, status, verification_status, payment_status FROM properties WHERE id=?", [property_id]);
    if (!property || property.status !== 'available' || property.verification_status !== 'approved')
      return res.status(409).json({ message: 'This house has been taken or is not available' });
    const payment = await createPayment({ type: 'view_fee', amount: VIEW_FEE_AMOUNT, phone, propertyId: property_id, description: `View fee for property ${property_id}`, billingAddress: { email, firstName: first_name, lastName: last_name, countryCode: country_code }, viewAccessToken: viewAccessToken() });
    res.status(201).json(payment);
  } catch (err) { console.error('[Payments] view-fee order failed:', err); respondPaymentError(res, err); }
});

app.post('/api/landlord/properties/:id/payment', paymentLimiter, protect, authorize('landlord'), async (req, res) => {
  const { phone } = req.body;
  try {
    const [[property]] = await db.execute('SELECT id, landlord_id, payment_status FROM properties WHERE id=? AND landlord_id=?', [req.params.id, req.user.id]);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (!PAYMENTS_ENABLED) {
      await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [property.id]);
      return res.json({ paymentRequired: false, message: 'Payments are temporarily disabled; the listing is free.' });
    }
    if (!phone) return res.status(400).json({ message: 'phone is required' });
    if (property.payment_status === 'paid') return res.json({ paymentRequired: false, message: 'Property is already paid and published' });
    if (await activePlan(req.user.id)) {
      await db.execute("UPDATE properties SET payment_status='paid' WHERE id=?", [property.id]);
      return res.json({ paymentRequired: false });
    }
    const payment = await createPayment({ type: 'listing_fee', amount: 400, phone, propertyId: property.id, landlordId: req.user.id, description: `Listing activation fee for property ${property.id}`, billingAddress: await getUserBillingAddress(req.user.id) });
    res.status(201).json({ paymentRequired: true, payment });
  } catch (err) { console.error('[Payments] listing-fee order failed:', err); respondPaymentError(res, err); }
});

app.post('/api/payments/plans', paymentLimiter, protect, authorize('landlord'), async (req, res) => {
  const { plan, phone, property_id } = req.body;
  if (!['monthly', 'semester'].includes(plan) || !phone) return res.status(400).json({ message: 'plan and phone are required' });
  try {
    if (property_id) {
      const [[property]] = await db.execute('SELECT id FROM properties WHERE id=? AND landlord_id=?', [property_id, req.user.id]);
      if (!property) return res.status(404).json({ message: 'Property not found or not yours' });
    }
    const amount = PLAN_OPTIONS[plan].amount;
    const payment = await createPayment({ type: 'landlord_plan', amount, phone, propertyId: property_id || null, landlordId: req.user.id, description: `${plan} landlord plan`, billingAddress: await getUserBillingAddress(req.user.id) });
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
    res.status(500).json({ message: 'Unable to load dashboard statistics' });
  }
});

app.get('/api/admin/users', protect, authorize('admin'), async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rows] = await db.execute(`
      SELECT u.id, u.name, u.email, u.role,
             u.account_status AS status,
             DATE_FORMAT(u.created_at,'%Y-%m-%d') AS created_at,
             COUNT(p.id) AS properties
      FROM users u
      LEFT JOIN properties p ON p.landlord_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    res.json(paginated(rows, page, limit));
  } catch (err) {
    console.error('Admin users error:', err);
    res.status(500).json({ message: 'Unable to load users' });
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
    console.error('User status error:', err);
    res.status(500).json({ message: 'Unable to update user status' });
  }
});

app.delete('/api/admin/users/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await db.execute('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ message: 'Unable to delete user' });
  }
});

app.get('/api/admin/listings', protect, authorize('admin'), async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rows] = await db.execute(`
      SELECT p.*, u.name AS landlord,
             DATE_FORMAT(p.created_at,'%Y-%m-%d') AS created_at
      FROM properties p
      LEFT JOIN users u ON u.id = p.landlord_id
      ORDER BY p.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);
    res.json(paginated(rows.map(propertyWithAmenities), page, limit));
  } catch (err) {
    console.error('Admin listings error:', err);
    res.status(500).json({ message: 'Unable to load listings' });
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
    console.error('Listing status error:', err);
    res.status(500).json({ message: 'Unable to update listing status' });
  }
});

app.patch('/api/admin/listings/:id/payment-status', protect, authorize('admin'), async (req, res) => {
  const { payment_status } = req.body;
  if (!['pending', 'paid'].includes(payment_status)) return res.status(400).json({ message: 'Invalid payment_status' });
  try {
    await db.execute('UPDATE properties SET payment_status=? WHERE id=?', [payment_status, req.params.id]);
    res.json({ message: 'Payment status updated' });
  } catch (err) { console.error('Listing payment status error:', err); res.status(500).json({ message: 'Unable to update payment status' }); }
});

app.delete('/api/admin/listings/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await db.execute('DELETE FROM properties WHERE id=?', [req.params.id]);
    res.json({ message: 'Listing deleted' });
  } catch (err) {
    console.error('Delete listing error:', err);
    res.status(500).json({ message: 'Unable to delete listing' });
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
    console.error('Favorites update error:', err);
    res.status(500).json({ message: 'Unable to update favorites' });
  }
});

app.get('/api/favorites', protect, async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rows] = await db.execute(`
      SELECT p.* FROM favorites f
      JOIN properties p ON f.property_id = p.id
      WHERE f.user_id = ? AND p.payment_status='paid' AND p.status='available'
      ORDER BY f.id DESC LIMIT ${limit} OFFSET ${offset}
    `, [req.user.id]);
    res.json(paginated(rows.map(propertyWithAmenities), page, limit));
  } catch (err) {
    console.error('GET /favorites error:', err);
    res.status(500).json({ message: 'Unable to load favorites' });
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   INQUIRIES
══════════════════════════════════════════════════════════════════════════ */
app.post('/api/inquiries', async (req, res) => {
  const { property_id, user_name, user_email, message } = req.body;
  const accessToken = String(req.headers['x-view-access-token'] || '');
  if (!property_id || !user_name || !user_email || !message || (PAYMENTS_ENABLED && accessToken.length < 32))
    return res.status(400).json({ message: 'property_id, user_name, user_email, message, and a valid view access token are required' });
  try {
    const [[property]] = await db.execute('SELECT status FROM properties WHERE id=?', [property_id]);
    if (!property) return res.status(404).json({ message: 'Property not found' });
    if (property.status === 'taken') return res.status(409).json({ message: 'This house has been taken' });
    let paymentId = null;
    if (PAYMENTS_ENABLED) {
      const [payments] = await db.execute(
        `SELECT id FROM payments WHERE type='view_fee' AND amount=? AND status='success' AND related_property_id=? AND view_access_token_hash=?
         ORDER BY id DESC LIMIT 1`,
         [VIEW_FEE_AMOUNT, property_id, tokenHash(accessToken)]
      );
      if (!payments.length) return res.status(402).json({ message: 'A successful view payment is required first' });
      paymentId = payments[0].id;
    }
    await db.execute(
      'INSERT INTO inquiries (property_id, user_name, user_email, message, payment_id) VALUES (?,?,?,?,?)',
      [property_id, user_name.trim(), user_email.trim(), message.trim(), paymentId]
    );
    res.status(201).json({ message: 'Inquiry sent successfully' });
  } catch (err) {
    console.error('POST /inquiries error:', err);
    res.status(500).json({ message: 'Unable to send inquiry' });
  }
});

app.get('/api/landlord/inquiries', protect, authorize('landlord'), async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rows] = await db.execute(`
      SELECT i.*, p.title AS property_title
      FROM inquiries i
      JOIN properties p ON i.property_id = p.id
      WHERE p.landlord_id = ?
      ORDER BY i.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, [req.user.id]);
    res.json(paginated(rows, page, limit));
  } catch (err) {
    console.error('GET /landlord/inquiries error:', err);
    res.status(500).json({ message: 'Unable to load inquiries' });
  }
});

app.delete('/api/landlord/inquiries/:id', protect, authorize('landlord'), async (req, res) => {
  try {
    const [result] = await db.execute(`DELETE i FROM inquiries i
      JOIN properties p ON p.id=i.property_id
      WHERE i.id=? AND p.landlord_id=?`, [req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ message: 'Inquiry not found' });
    res.json({ message: 'Inquiry deleted' });
  } catch (err) {
    console.error('DELETE /landlord/inquiries error:', err);
    res.status(500).json({ message: 'Unable to delete inquiry' });
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
    const { page, limit, offset } = pagination(req.query);
    const [rows] = await db.execute(`SELECT p.*, pr.title AS property_title, u.name AS landlord_name
      FROM payments p LEFT JOIN properties pr ON pr.id=p.related_property_id LEFT JOIN users u ON u.id=p.related_landlord_id
      ORDER BY p.created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    res.json(paginated(rows, page, limit));
  } catch (err) { console.error('Admin payments error:', err); res.status(500).json({ message: 'Unable to load payments' }); }
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
  } catch (err) { console.error('Payment resolution error:', err); res.status(500).json({ message: 'Unable to resolve payment' }); }
});

app.get('/api/admin/inquiries', protect, authorize('admin'), async (req, res) => {
  try {
    const { page, limit, offset } = pagination(req.query);
    const [rows] = await db.execute(`SELECT i.*, p.title AS property_title FROM inquiries i JOIN properties p ON p.id=i.property_id ORDER BY i.created_at DESC LIMIT ${limit} OFFSET ${offset}`);
    res.json(paginated(rows, page, limit));
  } catch (err) { console.error('Admin inquiries error:', err); res.status(500).json({ message: 'Unable to load inquiries' }); }
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
