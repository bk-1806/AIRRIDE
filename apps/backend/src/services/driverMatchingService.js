/**
 * AIRRIDE – Driver Matching Service
 * Finds the nearest available driver for a new booking,
 * creates a ride_match record, and notifies the driver via FCM + Socket.IO.
 */
const { query } = require('../config/database');
const { sendPush, createNotification } = require('./notificationService');

const SEARCH_RADIUS_KM = 25;
const OFFER_TIMEOUT_SEC = 30;

/**
 * Haversine distance in km between two lat/lng points.
 */
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/**
 * Find the nearest online driver who matches the vehicle type
 * and is not currently on an active booking.
 */
const findNearestDriver = async (pickupLat, pickupLng, vehicleType) => {
  // Get all online drivers with a vehicle of the right type
  const result = await query(
    `SELECT
       d.id, d.full_name, d.phone_number, d.fcm_token,
       d.current_lat, d.current_lng, d.rating,
       v.vehicle_type, v.license_plate, v.make, v.model, v.color
     FROM drivers d
     INNER JOIN vehicles v ON v.driver_id = d.id AND v.is_active = TRUE
     WHERE d.is_online   = TRUE
       AND d.is_active   = TRUE
       AND v.vehicle_type = $1
       AND d.current_lat IS NOT NULL
       AND d.current_lng IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM bookings b
         WHERE b.driver_id = d.id
           AND b.status IN ('driver_assigned','driver_accepted','driver_arrived','in_progress')
       )`,
    [vehicleType]
  );

  if (!result.rows.length) return null;

  // Calculate distance for each driver and filter by radius
  const candidates = result.rows
    .map((d) => ({
      ...d,
      distanceKm: haversineKm(
        parseFloat(d.current_lat), parseFloat(d.current_lng),
        pickupLat, pickupLng
      ),
    }))
    .filter((d) => d.distanceKm <= SEARCH_RADIUS_KM)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  return candidates[0] || null;
};

/**
 * Attempt to assign a booking to the nearest driver.
 * Inserts ride_matches row, sends FCM push, emits Socket.IO event.
 * @param {object} booking   - The newly created booking row
 * @param {object} io        - Socket.IO server instance
 * @returns {object|null}    - The matched driver or null
 */
const assignDriver = async (booking, io) => {
  try {
    const driver = await findNearestDriver(
      parseFloat(booking.pickup_lat),
      parseFloat(booking.pickup_lng),
      booking.vehicle_type
    );

    if (!driver) {
      console.log(`⚠️  No available driver found for booking ${booking.booking_ref}`);
      return null;
    }

    const etaMinutes = Math.ceil((driver.distanceKm / 30) * 60); // ~30 km/h in city

    // Record the match
    await query(
      `INSERT INTO ride_matches (booking_id, driver_id, status, offered_at)
       VALUES ($1, $2, 'offered', NOW())`,
      [booking.id, driver.id]
    );

    // Mark booking as driver_assigned
    await query(
      `UPDATE bookings SET status = 'driver_assigned', driver_id = $1, updated_at = NOW() WHERE id = $2`,
      [driver.id, booking.id]
    );

    // FCM push to driver
    const ridePayload = {
      bookingId:    booking.id,
      bookingRef:   booking.booking_ref,
      pickup:       booking.pickup_address,
      destination:  booking.destination_address,
      fare:         String(booking.total_fare),
      pickupLat:    String(booking.pickup_lat),
      pickupLng:    String(booking.pickup_lng),
      etaMinutes:   String(etaMinutes),
      timeoutSec:   String(OFFER_TIMEOUT_SEC),
      type:         'ride_request',
    };

    await createNotification({
      driverId:  driver.id,
      title:     '🚖 New Ride Request',
      body:      `Pickup: ${booking.pickup_address.slice(0, 50)} | ₹${booking.total_fare}`,
      type:      'ride_request',
      bookingId: booking.id,
      fcmToken:  driver.fcm_token,
    });

    // Real-time event to driver's Socket.IO room
    if (io) {
      io.to(`driver_${driver.id}`).emit('ride_request', {
        booking,
        driver: {
          id:          driver.id,
          distanceKm:  driver.distanceKm.toFixed(2),
          etaMinutes,
        },
        timeoutSec: OFFER_TIMEOUT_SEC,
      });
    }

    console.log(`✅ Assigned booking ${booking.booking_ref} → driver ${driver.full_name} (${driver.distanceKm.toFixed(1)} km)`);
    return driver;
  } catch (err) {
    console.error('❌ assignDriver error:', err.message);
    return null;
  }
};

module.exports = { findNearestDriver, assignDriver, haversineKm };
