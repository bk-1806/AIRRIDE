const express = require('express');
const { verifyAdminToken } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

module.exports = (io) => {
  const router = express.Router();

  router.get('/bookings', verifyAdminToken, adminController.getAllBookings);
  router.post('/bookings/:id/assign', verifyAdminToken, (req, res) => adminController.assignDriver(req, res, io));
  router.put('/bookings/:id/status', verifyAdminToken, (req, res) => adminController.updateBookingStatus(req, res, io));
  router.get('/drivers', verifyAdminToken, adminController.getAllDrivers);
  router.get('/users', verifyAdminToken, adminController.getAllUsers);
  router.get('/analytics', verifyAdminToken, adminController.getAnalytics);

  return router;
};
