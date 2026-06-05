const { query } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ─── CUSTOMER ────────────────────────────────────────────────────────────────

const verifyToken = async (req, res) => {
  try {
    const { fullName, fcmToken } = req.body;
    const { uid, phone_number } = req.firebaseUser;
    const result = await query(
      `INSERT INTO users (firebase_uid, phone_number, full_name, fcm_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid) DO UPDATE SET
         fcm_token = COALESCE($4, users.fcm_token),
         full_name = COALESCE($3, users.full_name),
         updated_at = NOW()
       RETURNING *`,
      [uid, phone_number, fullName || null, fcmToken || null]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('verifyToken:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { fullName, email, homeAddress, homeLat, homeLng } = req.body;
    const result = await query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         email = COALESCE($2, email),
         home_address = COALESCE($3, home_address),
         home_lat = COALESCE($4, home_lat),
         home_lng = COALESCE($5, home_lng),
         updated_at = NOW()
       WHERE firebase_uid = $6 RETURNING *`,
      [fullName, email, homeAddress, homeLat, homeLng, req.firebaseUser.uid]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── DRIVER ───────────────────────────────────────────────────────────────────

const verifyDriverToken = async (req, res) => {
  try {
    const { fullName, fcmToken } = req.body;
    const { uid, phone_number } = req.firebaseUser;
    const result = await query(
      `INSERT INTO drivers (firebase_uid, phone_number, full_name, fcm_token)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (firebase_uid) DO UPDATE SET
         fcm_token = COALESCE($4, drivers.fcm_token),
         updated_at = NOW()
       RETURNING *`,
      [uid, phone_number, fullName || 'Driver', fcmToken || null]
    );
    res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    console.error('verifyDriverToken:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required' });
    const result = await query('SELECT * FROM admins WHERE email = $1 AND is_active = TRUE', [email.toLowerCase()]);
    if (!result.rows.length) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    const admin = result.rows[0];
    if (!(await bcrypt.compare(password, admin.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    const token = jwt.sign({ adminId: admin.id, email: admin.email, role: admin.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
    res.json({ success: true, token, admin: { id: admin.id, email: admin.email, fullName: admin.full_name, role: admin.role } });
  } catch (err) {
    console.error('adminLogin:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const createAdmin = async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO admins (email, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role`,
      [email.toLowerCase(), hash, fullName, role || 'dispatcher']
    );
    res.status(201).json({ success: true, admin: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Admin already exists' });
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { verifyToken, getProfile, updateProfile, verifyDriverToken, adminLogin, createAdmin };
