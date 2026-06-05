const admin = require('../config/firebase');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

/** Verify Firebase ID token (customers & drivers) */
const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authorization token provided' });
    }
    const idToken = authHeader.split('Bearer ')[1];

    req.firebaseUser = await admin.auth().verifyIdToken(idToken);
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/** Verify JWT for Admin Dashboard */
const verifyAdminToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No authorization token provided' });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const result = await query('SELECT * FROM admins WHERE id = $1 AND is_active = TRUE', [decoded.adminId]);
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Admin not found or inactive' });
    }
    req.admin = result.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired admin token' });
  }
};

module.exports = { verifyFirebaseToken, verifyAdminToken };
