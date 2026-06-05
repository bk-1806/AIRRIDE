const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const driverController   = require('../controllers/driverController');
const earningsController = require('../controllers/earningsController');

module.exports = (io) => {
  const router = express.Router();

  // ── Profile ──────────────────────────────────────────────────────────
  router.get('/profile',           verifyFirebaseToken, driverController.getDriverProfile);

  // ── Availability & GPS ───────────────────────────────────────────────
  router.put('/availability',      verifyFirebaseToken, (req, res) => driverController.updateOnlineStatus(req, res, io));
  router.put('/location',          verifyFirebaseToken, (req, res) => driverController.updateLocation(req, res, io));

  // Alias for backwards compatibility
  router.put('/status',            verifyFirebaseToken, (req, res) => driverController.updateOnlineStatus(req, res, io));

  // ── Trip Lifecycle ───────────────────────────────────────────────────
  router.get('/bookings',          verifyFirebaseToken, driverController.getDriverBookings);
  router.put('/bookings/:id/status', verifyFirebaseToken, (req, res) => driverController.updateBookingStatus(req, res, io));

  // Semantic shortcut routes
  router.post('/bookings/:id/accept',   verifyFirebaseToken, (req, res) => {
    req.body.status = 'driver_accepted';
    return driverController.updateBookingStatus(req, res, io);
  });
  router.post('/bookings/:id/arrive',   verifyFirebaseToken, (req, res) => {
    req.body.status = 'driver_arrived';
    return driverController.updateBookingStatus(req, res, io);
  });
  router.post('/bookings/:id/start',    verifyFirebaseToken, (req, res) => {
    req.body.status = 'in_progress';
    return driverController.updateBookingStatus(req, res, io);
  });
  router.post('/bookings/:id/complete', verifyFirebaseToken, (req, res) => {
    req.body.status = 'completed';
    return driverController.updateBookingStatus(req, res, io);
  });

  // ── Earnings & Stats ─────────────────────────────────────────────────
  router.get('/earnings',          verifyFirebaseToken, earningsController.getEarningsSummary);
  router.get('/earnings/history',  verifyFirebaseToken, earningsController.getEarningsHistory);
  router.get('/performance',       verifyFirebaseToken, earningsController.getPerformance);
  router.get('/queue',             verifyFirebaseToken, earningsController.getQueueStatus);

  return router;
};
