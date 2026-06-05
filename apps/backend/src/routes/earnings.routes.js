const express = require('express');
const router  = express.Router();
const { verifyFirebaseToken } = require('../middleware/auth');
const {
  getEarningsSummary,
  getEarningsHistory,
  getPerformance,
  getQueueStatus,
} = require('../controllers/earningsController');

router.get('/summary',     verifyFirebaseToken, getEarningsSummary);
router.get('/history',     verifyFirebaseToken, getEarningsHistory);
router.get('/performance', verifyFirebaseToken, getPerformance);
router.get('/queue',       verifyFirebaseToken, getQueueStatus);

module.exports = router;
