const express = require('express');
const router = express.Router();
const { getFareEstimate } = require('../controllers/fareController');
const { calculateFare } = require('../controllers/mapsController');
const { verifyFirebaseToken } = require('../middleware/auth');

router.post('/estimate', verifyFirebaseToken, getFareEstimate);
router.get('/calculate', verifyFirebaseToken, calculateFare);

module.exports = router;
