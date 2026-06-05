const express = require('express');
const router = express.Router();
const { verifyToken, getProfile, updateProfile, verifyDriverToken, adminLogin, createAdmin } = require('../controllers/authController');
const { verifyFirebaseToken, verifyAdminToken } = require('../middleware/auth');

// Customer
router.post('/verify-token', verifyFirebaseToken, verifyToken);
router.post('/verify', verifyFirebaseToken, verifyToken);
router.get('/profile', verifyFirebaseToken, getProfile);
router.put('/profile', verifyFirebaseToken, updateProfile);

// Driver
router.post('/driver/verify-token', verifyFirebaseToken, verifyDriverToken);
router.post('/driver/verify', verifyFirebaseToken, verifyDriverToken);

// Admin
router.post('/admin/login', adminLogin);
router.post('/admin/create', verifyAdminToken, createAdmin);

module.exports = router;
