const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth');
const { createBooking, getUserBookings, getBookingById, cancelBooking, rateDriver } = require('../controllers/bookingController');

// Booking routes need io injected for real-time broadcasts
module.exports = (io) => {
  const router = express.Router();

  router.post('/',             verifyFirebaseToken, (req, res) => createBooking(req, res, io));
  router.get('/',              verifyFirebaseToken, getUserBookings);
  router.get('/:id',           verifyFirebaseToken, getBookingById);
  router.put('/:id/cancel',    verifyFirebaseToken, (req, res) => cancelBooking(req, res, io));
  router.post('/:id/rate',     verifyFirebaseToken, rateDriver);

  return router;
};
