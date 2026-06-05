const express = require('express');
const router  = express.Router();
const { distance, geocode, directions } = require('../controllers/mapsController');
const { verifyFirebaseToken } = require('../middleware/auth');

router.get('/distance',   verifyFirebaseToken, distance);
router.get('/geocode',    verifyFirebaseToken, geocode);
router.get('/directions', verifyFirebaseToken, directions);

module.exports = router;
