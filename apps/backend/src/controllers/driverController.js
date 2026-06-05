const { query }              = require('../config/database');
const { createNotification } = require('../services/notificationService');

// ── Update GPS Location ───────────────────────────────────────────────────────
const updateLocation = async (req, res, io) => {
  try {
    const { lat, lng, heading, speed, accuracy } = req.body;
    if (!lat || !lng) return res.status(400).json({ success: false, message: 'lat and lng required' });

    // Update driver current position
    const result = await query(
      `UPDATE drivers
         SET current_lat = $1, current_lng = $2, updated_at = NOW()
       WHERE firebase_uid = $3
       RETURNING *`,
      [lat, lng, req.firebaseUser.uid]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });
    const driver = result.rows[0];

    // Find active booking to broadcast to customer
    const bookingRes = await query(
      `SELECT id FROM bookings WHERE driver_id = $1 AND status IN ('driver_accepted','driver_arrived','in_progress')`,
      [driver.id]
    );

    if (bookingRes.rows.length) {
      const bookingId = bookingRes.rows[0].id;

      // Store GPS history (every call – frontend throttles to every 10s)
      await query(
        `INSERT INTO driver_locations (driver_id, lat, lng, heading, speed, accuracy, booking_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [driver.id, lat, lng, heading || null, speed || null, accuracy || null, bookingId]
      );

      // Broadcast to customer tracking the booking
      if (io) {
        io.to(`booking_${bookingId}`).emit('driver_location_update', {
          driverId: driver.id, lat: +lat, lng: +lng, heading, speed, bookingId
        });
      }
    }

    // Always broadcast to admin room
    if (io) io.to('admin_room').emit('driver_location_update', { driverId: driver.id, lat: +lat, lng: +lng });

    res.json({ success: true });
  } catch (err) {
    console.error('updateLocation:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Online / Offline Toggle ───────────────────────────────────────────────────
const updateOnlineStatus = async (req, res, io) => {
  try {
    const { isOnline, lat, lng } = req.body;
    const result = await query(
      `UPDATE drivers SET is_online = $1, current_lat = COALESCE($2, current_lat),
         current_lng = COALESCE($3, current_lng), updated_at = NOW()
       WHERE firebase_uid = $4 RETURNING *`,
      [isOnline, lat || null, lng || null, req.firebaseUser.uid]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });
    if (io) io.to('admin_room').emit('driver_status_update', { driverId: result.rows[0].id, isOnline });
    res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Driver Profile ────────────────────────────────────────────────────────
const getDriverProfile = async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*, v.make, v.model, v.color, v.license_plate, v.vehicle_type,
         dp.accept_rate, dp.cancel_rate, dp.on_time_rate, dp.avg_rating,
         dp.total_completed
       FROM drivers d
       LEFT JOIN vehicles v ON v.driver_id = d.id AND v.is_active = TRUE
       LEFT JOIN driver_performance dp ON dp.driver_id = d.id
       WHERE d.firebase_uid = $1`,
      [req.firebaseUser.uid]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });
    res.json({ success: true, driver: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Get Driver Bookings ───────────────────────────────────────────────────────
const getDriverBookings = async (req, res) => {
  try {
    const driverResult = await query('SELECT id FROM drivers WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!driverResult.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });

    const { status, limit = 50, offset = 0 } = req.query;
    let q = `
      SELECT b.*, u.full_name AS customer_name, u.phone_number AS customer_phone,
             de.net_payout, de.gross_fare
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN driver_earnings de ON de.booking_id = b.id
      WHERE b.driver_id = $1`;
    const params = [driverResult.rows[0].id];
    if (status) { params.push(status); q += ` AND b.status = $${params.length}`; }
    q += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(q, params);
    res.json({ success: true, bookings: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Update Booking Status (full lifecycle) ────────────────────────────────────
const updateBookingStatus = async (req, res, io) => {
  const client = await require('../config/database').getClient();
  try {
    const { status } = req.body;
    await client.query('BEGIN');

    const driverResult = await client.query(
      'SELECT * FROM drivers WHERE firebase_uid = $1', [req.firebaseUser.uid]
    );
    if (!driverResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Driver not found' });
    }
    const driver = driverResult.rows[0];

    const validTransitions = {
      driver_assigned:  ['driver_accepted', 'cancelled'],
      driver_accepted:  ['driver_arrived', 'cancelled'],
      driver_arrived:   ['in_progress'],
      in_progress:      ['completed'],
    };

    const bookingRes = await client.query(
      `SELECT b.*, u.fcm_token AS customer_fcm, u.id AS customer_id, u.full_name AS customer_name
       FROM bookings b
       LEFT JOIN users u ON b.user_id = u.id
       WHERE b.id = $1 AND b.driver_id = $2`,
      [req.params.id, driver.id]
    );
    if (!bookingRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const booking = bookingRes.rows[0];
    const current = booking.status;

    if (!validTransitions[current]?.includes(status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: `Cannot transition from ${current} to ${status}` });
    }

    // Build update fields
    const fields = { status, updated_at: 'NOW()' };
    if (status === 'driver_accepted') fields.driver_accepted_at = 'NOW()';
    if (status === 'driver_arrived')  fields.driver_arrived_at  = 'NOW()';
    if (status === 'in_progress')     fields.pickup_at          = 'NOW()';
    if (status === 'completed')       fields.completed_at       = 'NOW()';

    const updResult = await client.query(
      `UPDATE bookings SET
         status = $1,
         pickup_at    = CASE WHEN $2::text = 'in_progress' THEN NOW() ELSE pickup_at END,
         completed_at = CASE WHEN $2::text = 'completed'   THEN NOW() ELSE completed_at END,
         updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, status, booking.id]
    );
    const updBooking = updResult.rows[0];

    // ── Post-transition side effects ──────────────────────────────

    // 1. driver_accepted → update ride_matches, notify customer
    if (status === 'driver_accepted') {
      await client.query(
        `UPDATE ride_matches SET status = 'accepted', responded_at = NOW() WHERE booking_id = $1`,
        [booking.id]
      );
      await createNotification({
        userId:    booking.customer_id,
        title:     '🚖 Driver on the Way!',
        body:      `${driver.full_name} is heading to your pickup. ETA: ~${Math.ceil(parseFloat(booking.estimated_duration_min || 15))} min`,
        type:      'driver_accepted',
        bookingId: booking.id,
        fcmToken:  booking.customer_fcm,
      });
    }

    // 2. driver_arrived → notify customer
    if (status === 'driver_arrived') {
      await createNotification({
        userId:    booking.customer_id,
        title:     '📍 Driver Has Arrived!',
        body:      `${driver.full_name} is at your pickup location. Please head out.`,
        type:      'driver_arrived',
        bookingId: booking.id,
        fcmToken:  booking.customer_fcm,
      });
    }

    // 3. completed → save earnings, update performance, notify customer
    if (status === 'completed') {
      const grossFare = parseFloat(booking.total_fare);
      const commissionPct = 8.0;
      const commissionAmt = parseFloat((grossFare * commissionPct / 100).toFixed(2));
      const netPayout = parseFloat((grossFare - commissionAmt).toFixed(2));
      const airportSurcharge = parseFloat(booking.airport_surcharge || 0);

      await client.query(
        `INSERT INTO driver_earnings
           (driver_id, booking_id, gross_fare, commission_pct, commission_amt, airport_surcharge, net_payout, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [driver.id, booking.id, grossFare, commissionPct, commissionAmt, airportSurcharge, netPayout]
      );

      // Upsert performance stats
      await client.query(
        `INSERT INTO driver_performance (driver_id, total_offered, total_accepted, total_completed)
         VALUES ($1, 1, 1, 1)
         ON CONFLICT (driver_id) DO UPDATE SET
           total_completed = driver_performance.total_completed + 1,
           total_accepted  = driver_performance.total_accepted + 1,
           cancel_rate     = ROUND((driver_performance.total_cancelled::NUMERIC /
                               GREATEST(driver_performance.total_offered + 1, 1)) * 100, 2),
           accept_rate     = ROUND(((driver_performance.total_accepted + 1)::NUMERIC /
                               GREATEST(driver_performance.total_offered + 1, 1)) * 100, 2),
           updated_at      = NOW()`,
        [driver.id]
      );

      await client.query(
        `UPDATE drivers SET total_trips = total_trips + 1, updated_at = NOW() WHERE id = $1`,
        [driver.id]
      );

      await createNotification({
        userId:    booking.customer_id,
        title:     '✅ Trip Completed!',
        body:      `You've arrived. Total fare: ₹${grossFare}. Please rate your driver.`,
        type:      'trip_completed',
        bookingId: booking.id,
        fcmToken:  booking.customer_fcm,
      });
    }

    await client.query('COMMIT');

    // Broadcast real-time status update
    if (io) {
      io.to(`booking_${booking.id}`).emit('booking_status_update', { status, booking: updBooking });
      io.to('admin_room').emit('booking_updated', { booking: updBooking });
    }

    res.json({ success: true, booking: updBooking });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateBookingStatus:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
};

module.exports = { updateLocation, updateOnlineStatus, getDriverProfile, getDriverBookings, updateBookingStatus };
