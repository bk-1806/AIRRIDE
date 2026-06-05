const { query } = require('../config/database');
const { createNotification } = require('../services/notificationService');

const getAllBookings = async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    let q = `
      SELECT b.*,
        u.full_name AS customer_name, u.phone_number AS customer_phone,
        d.full_name AS driver_name, d.phone_number AS driver_phone,
        v.license_plate, v.make, v.model, v.color
      FROM bookings b
      LEFT JOIN users u ON b.user_id = u.id
      LEFT JOIN drivers d ON b.driver_id = d.id
      LEFT JOIN vehicles v ON b.vehicle_id = v.id`;
    const params = [];
    if (status) { params.push(status); q += ` WHERE b.status = $1`; }
    q += ` ORDER BY b.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    const result = await query(q, params);
    res.json({ success: true, bookings: result.rows, count: result.rowCount });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const assignDriver = async (req, res, io) => {
  try {
    const { driverId, vehicleId, adminNotes } = req.body;
    const { id: bookingId } = req.params;

    const driverResult = await query('SELECT * FROM drivers WHERE id = $1 AND is_active = TRUE', [driverId]);
    if (!driverResult.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });
    const driver = driverResult.rows[0];

    const result = await query(
      `UPDATE bookings SET
         driver_id = $1, vehicle_id = $2, status = 'admin_assigned',
         admin_notes = $3, updated_at = NOW()
       WHERE id = $4 AND status IN ('pending', 'admin_assigned')
       RETURNING *`,
      [driverId, vehicleId || null, adminNotes || null, bookingId]
    );
    if (!result.rows.length) return res.status(400).json({ success: false, message: 'Booking not found or cannot be assigned' });
    const booking = result.rows[0];

    // Log assignment
    await query(
      `INSERT INTO ride_matches (booking_id, driver_id, assigned_by_admin_id, status)
       VALUES ($1, $2, $3, 'offered')`,
      [bookingId, driverId, req.admin.id]
    );

    // Notify customer
    const userResult = await query('SELECT * FROM users WHERE id = $1', [booking.user_id]);
    const user = userResult.rows[0];
    await createNotification({
      userId: user?.id,
      title: 'Driver Assigned!',
      body: `${driver.full_name} is on the way to pick you up.`,
      type: 'driver_assigned',
      bookingId,
      fcmToken: user?.fcm_token,
    });

    // Notify driver
    await createNotification({
      driverId: driver.id,
      title: 'New Ride Assigned',
      body: `New pickup at: ${booking.pickup_address}`,
      type: 'ride_assigned',
      bookingId,
      fcmToken: driver.fcm_token,
    });

    // Socket.IO events
    if (io) {
      io.to(`driver_${driverId}`).emit('ride_assigned', { booking, message: 'You have been assigned a new ride' });
      io.to('admin_room').emit('booking_updated', { booking });
    }

    res.json({ success: true, booking });
  } catch (err) {
    console.error('assignDriver:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAllDrivers = async (req, res) => {
  try {
    const { is_online, is_active = 'true' } = req.query;
    let q = `
      SELECT d.*,
        v.license_plate, v.vehicle_type AS vehicle, v.make, v.model, v.color
      FROM drivers d
      LEFT JOIN vehicles v ON v.driver_id = d.id AND v.is_active = TRUE
      WHERE d.is_active = $1`;
    const params = [is_active === 'true'];
    if (is_online !== undefined) { params.push(is_online === 'true'); q += ` AND d.is_online = $${params.length}`; }
    q += ` ORDER BY d.full_name`;
    const result = await query(q, params);
    res.json({ success: true, drivers: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const result = await query(
      'SELECT * FROM users WHERE is_active = TRUE ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json({ success: true, users: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const getAnalytics = async (req, res) => {
  try {
    const [total, active, totalDrivers, online, revenue] = await Promise.all([
      query('SELECT COUNT(*) FROM bookings'),
      query(`SELECT COUNT(*) FROM bookings WHERE status NOT IN ('completed','cancelled')`),
      query('SELECT COUNT(*) FROM drivers WHERE is_active = TRUE'),
      query('SELECT COUNT(*) FROM drivers WHERE is_online = TRUE'),
      query(`SELECT COALESCE(SUM(total_fare),0) AS total FROM bookings WHERE status = 'completed'`),
    ]);
    res.json({
      success: true,
      analytics: {
        totalBookings: parseInt(total.rows[0].count),
        activeBookings: parseInt(active.rows[0].count),
        totalDrivers: parseInt(totalDrivers.rows[0].count),
        onlineDrivers: parseInt(online.rows[0].count),
        totalRevenue: parseFloat(revenue.rows[0].total),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const updateBookingStatus = async (req, res, io) => {
  try {
    const { status, adminNotes } = req.body;
    const result = await query(
      `UPDATE bookings SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [status, adminNotes || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (io) io.to('admin_room').emit('booking_updated', { booking: result.rows[0] });
    res.json({ success: true, booking: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getAllBookings, assignDriver, getAllDrivers, getAllUsers, getAnalytics, updateBookingStatus };
