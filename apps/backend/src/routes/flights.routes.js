const express   = require('express');
const router    = express.Router();
const { getFlightStatus } = require('../services/flightService');
const { verifyFirebaseToken } = require('../middleware/auth');

/**
 * GET /api/flights/:flightNumber
 * Returns real-time flight status from AviationStack.
 */
router.get('/:flightNumber', verifyFirebaseToken, async (req, res) => {
  try {
    const result = await getFlightStatus(req.params.flightNumber);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
