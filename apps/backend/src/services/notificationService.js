const admin = require('../config/firebase');
const { query } = require('../config/database');

const sendPush = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return;
  try {
    await admin.messaging().send({
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
      token: fcmToken,
      android: { priority: 'high', notification: { channelId: 'airride_notifications' } },
    });
  } catch (err) {
    console.error('FCM error:', err.message);
  }
};

const createNotification = async ({ userId, driverId, title, body, type, bookingId, fcmToken }) => {
  await query(
    `INSERT INTO notifications (user_id, driver_id, title, body, type, booking_id)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId || null, driverId || null, title, body, type, bookingId || null]
  );
  if (fcmToken) await sendPush(fcmToken, title, body, { type, bookingId: bookingId || '' });
};

module.exports = { sendPush, createNotification };
