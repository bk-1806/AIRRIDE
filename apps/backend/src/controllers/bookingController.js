const { query, getClient } = require('../config/database');
const { createNotification }    = require('../services/notificationService');
const { assignDriver }          = require('../services/driverMatchingService');

const genRef = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const r = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `AIR-${new Date().getFullYear()}-${r}`;
};

// ── Create Booking ────────────────────────────────────────────────────────────
const createBooking = async (req, res, io) => {
  try {
    const {
      vehicleType, pickupAddress, pickupLat, pickupLng,
      destinationAddress, destinationLat, destinationLng,
      scheduledAt, flightId, estimatedDistanceKm, estimatedDurationMin,
      baseFare, distanceFare, airportSurcharge, totalFare,
      paymentMethod, specialInstructions,
    } = req.body;

    if (!vehicleType || !pickupAddress || !pickupLat || !pickupLng ||
        !destinationAddress || !destinationLat || !destinationLng ||
        !scheduledAt || !totalFare) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const userResult = await query('SELECT * FROM users WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!userResult.rows.length) {
      return res.status(404).json({ success: false, message: 'User not found. Please register first.' });
    }
    const user = userResult.rows[0];

    const ref = genRef();
    const result = await query(
      `INSERT INTO bookings (
         booking_ref, user_id, vehicle_type, status,
         pickup_address, pickup_lat, pickup_lng,
         destination_address, destination_lat, destination_lng,
         scheduled_at, flight_id,
         estimated_distance_km, estimated_duration_min,
         base_fare, distance_fare, airport_surcharge, total_fare,
         payment_method, special_instructions
       ) VALUES ($1,$2,$3,'pending',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [ref, user.id, vehicleType, pickupAddress, pickupLat, pickupLng,
       destinationAddress, destinationLat, destinationLng, scheduledAt,
       flightId || null, estimatedDistanceKm || null, estimatedDurationMin || null,
       baseFare || 0, distanceFare || 0, airportSurcharge || 0, totalFare,
       paymentMethod || 'cash', specialInstructions || null]
    );

    const booking = result.rows[0];

    // Notify customer that booking was received
    await createNotification({
      userId:    user.id,
      title:     '✅ Booking Received',
      body:      `Booking ${ref} placed. Finding your driver…`,
      type:      'booking_created',
      bookingId: booking.id,
      fcmToken:  user.fcm_token,
    });

    // Respond immediately – driver matching happens async
    res.status(201).json({ success: true, booking });

    // Auto-assign nearest driver (non-blocking)
    setImmediate(async () => {
      await assignDriver(booking, io);
    });

  } catch (err) {
    console.error('createBooking:', err);
    res.status(500).json({ success: false, message: 'Failed to create booking' });
  }
};

// ── Get User Bookings ─────────────────────────────────────────────────────────
const getUserBookings = async (req, res) => {
  try {
    const userResult = await query('SELECT id FROM users WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!userResult.rows.length) return res.status(404).json({ success: false, message: 'User not found' });

    const { status, limit = 20, offset = 0 } = req.query;
    let q = `
      SELECT b.*,
        d.full_name AS driver_name, d.phone_number AS driver_phone,
        d.rating AS driver_rating, d.profile_photo_url AS driver_photo,
        d.current_lat AS driver_lat, d.current_lng AS driver_lng,
        v.license_plate, v.make, v.model, v.color
      FROM bookings b
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id
      WHERE b.user_id = $1`;
    const params = [userResult.rows[0].id];
    if (status) { params.push(status); q += ` AND b.status = $${params.length}`; }
    q += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(q, params);
    res.json({ success: true, bookings: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('getUserBookings:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Single Booking ────────────────────────────────────────────────────────
const getBookingById = async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*,
         d.full_name AS driver_name, d.phone_number AS driver_phone,
         d.rating AS driver_rating, d.profile_photo_url AS driver_photo,
         d.current_lat AS driver_lat, d.current_lng AS driver_lng,
         v.license_plate, v.make, v.model, v.color
       FROM bookings b
       LEFT JOIN drivers d ON b.driver_id = d.id
       LEFT JOIN vehicles v ON b.vehicle_id = v.id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.json({ success: true, booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Cancel Booking ────────────────────────────────────────────────────────────
const cancelBooking = async (req, res, io) => {
  try {
    const userResult = await query('SELECT id FROM users WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    const result = await query(
      `UPDATE bookings SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending','driver_assigned','driver_accepted')
       RETURNING *`,
      [req.params.id, userResult.rows[0].id]
    );
    if (!result.rows.length) {
      return res.status(400).json({ success: false, message: 'Cannot cancel this booking' });
    }
    const booking = result.rows[0];

    // Notify driver if one was assigned
    if (booking.driver_id) {
      const driverRes = await query('SELECT fcm_token, id FROM drivers WHERE id = $1', [booking.driver_id]);
      if (driverRes.rows.length) {
        const driver = driverRes.rows[0];
        await createNotification({
          driverId:  driver.id,
          title:     '❌ Ride Cancelled',
          body:      `Passenger cancelled booking ${booking.booking_ref}.`,
          type:      'ride_cancelled',
          bookingId: booking.id,
          fcmToken:  driver.fcm_token,
        });
        if (io) io.to(`driver_${driver.id}`).emit('ride_cancelled', { bookingId: booking.id });
      }
    }

    if (io) io.to(`booking_${booking.id}`).emit('booking_status_update', { status: 'cancelled', booking });
    res.json({ success: true, booking });
  } catch (err) {
    console.error('cancelBooking:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Rate Driver ───────────────────────────────────────────────────────────────
const rateDriver = async (req, res) => {
  try {
    const { score, comment } = req.body;
    if (!score || score < 1 || score > 5) {
      return res.status(400).json({ success: false, message: 'Score must be 1–5' });
    }

    const userResult = await query('SELECT id FROM users WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    const bookingResult = await query(
      `SELECT * FROM bookings WHERE id = $1 AND user_id = $2 AND status = 'completed'`,
      [req.params.id, userResult.rows[0].id]
    );
    if (!bookingResult.rows.length) {
      return res.status(404).json({ success: false, message: 'Completed booking not found' });
    }
    const booking = bookingResult.rows[0];

    // Insert rating
    await query(
      `INSERT INTO ratings (booking_id, rater_id, rated_id, rater_role, score, comment)
       VALUES ($1, $2, $3, 'customer', $4, $5)
       ON CONFLICT (booking_id) DO UPDATE SET score = $4, comment = $5`,
      [booking.id, userResult.rows[0].id, booking.driver_id, score, comment || null]
    );

    // Update driver's rolling average rating
    await query(
      `UPDATE drivers SET rating = (
         SELECT ROUND(AVG(r.score)::NUMERIC, 2)
         FROM ratings r WHERE r.rated_id = $1
       ), updated_at = NOW()
       WHERE id = $1`,
      [booking.driver_id]
    );

    res.json({ success: true, message: 'Rating saved' });
  } catch (err) {
    console.error('rateDriver:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { createBooking, getUserBookings, getBookingById, cancelBooking, rateDriver };
