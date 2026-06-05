/**
 * AIRRIDE – Earnings Controller
 * GET /api/driver/earnings         → today/week/month summary
 * GET /api/driver/earnings/history → paginated payout list
 * GET /api/driver/performance      → stats for dashboard
 * GET /api/driver/queue            → airport queue status
 */
const { query } = require('../config/database');

// ── Earnings Summary ──────────────────────────────────────────────────────────
const getEarningsSummary = async (req, res) => {
  try {
    const driverRes = await query('SELECT id FROM drivers WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!driverRes.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });
    const driverId = driverRes.rows[0].id;

    const [today, week, month, total] = await Promise.all([
      query(`SELECT COALESCE(SUM(net_payout),0) AS amount, COUNT(*) AS trips
             FROM driver_earnings WHERE driver_id=$1 AND period_date=CURRENT_DATE`, [driverId]),
      query(`SELECT COALESCE(SUM(net_payout),0) AS amount, COUNT(*) AS trips
             FROM driver_earnings WHERE driver_id=$1 AND period_date >= date_trunc('week', CURRENT_DATE)`, [driverId]),
      query(`SELECT COALESCE(SUM(net_payout),0) AS amount, COUNT(*) AS trips
             FROM driver_earnings WHERE driver_id=$1 AND period_date >= date_trunc('month', CURRENT_DATE)`, [driverId]),
      query(`SELECT COALESCE(SUM(net_payout),0) AS amount, COUNT(*) AS trips
             FROM driver_earnings WHERE driver_id=$1`, [driverId]),
    ]);

    res.json({
      success: true,
      earnings: {
        today:  { amount: parseFloat(today.rows[0].amount),  trips: parseInt(today.rows[0].trips) },
        week:   { amount: parseFloat(week.rows[0].amount),   trips: parseInt(week.rows[0].trips) },
        month:  { amount: parseFloat(month.rows[0].amount),  trips: parseInt(month.rows[0].trips) },
        total:  { amount: parseFloat(total.rows[0].amount),  trips: parseInt(total.rows[0].trips) },
      },
    });
  } catch (err) {
    console.error('getEarningsSummary:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Earnings History ──────────────────────────────────────────────────────────
const getEarningsHistory = async (req, res) => {
  try {
    const driverRes = await query('SELECT id FROM drivers WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!driverRes.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });

    const { limit = 30, offset = 0, from, to } = req.query;
    let q = `
      SELECT de.*, b.booking_ref, b.pickup_address, b.destination_address,
             u.full_name AS customer_name
      FROM driver_earnings de
      LEFT JOIN bookings b ON de.booking_id = b.id
      LEFT JOIN users u ON b.user_id = u.id
      WHERE de.driver_id = $1`;
    const params = [driverRes.rows[0].id];
    if (from) { params.push(from); q += ` AND de.period_date >= $${params.length}`; }
    if (to)   { params.push(to);   q += ` AND de.period_date <= $${params.length}`; }
    q += ` ORDER BY de.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);

    const result = await query(q, params);
    res.json({ success: true, history: result.rows, count: result.rowCount });
  } catch (err) {
    console.error('getEarningsHistory:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Performance Stats ─────────────────────────────────────────────────────────
const getPerformance = async (req, res) => {
  try {
    const driverRes = await query('SELECT id FROM drivers WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    if (!driverRes.rows.length) return res.status(404).json({ success: false, message: 'Driver not found' });

    const result = await query(
      `SELECT * FROM driver_performance WHERE driver_id = $1`,
      [driverRes.rows[0].id]
    );
    const perf = result.rows[0] || {
      accept_rate: 100, cancel_rate: 0, on_time_rate: 100,
      total_completed: 0, avg_rating: 5.0,
    };
    res.json({ success: true, performance: perf });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ── Airport Queue Status ──────────────────────────────────────────────────────
const getQueueStatus = async (req, res) => {
  try {
    const { airportCode = 'JFK' } = req.query;

    const total = await query(
      `SELECT COUNT(*) AS count FROM airport_queue WHERE airport_code = $1 AND status = 'waiting'`,
      [airportCode]
    );

    const driverRes = await query('SELECT id FROM drivers WHERE firebase_uid = $1', [req.firebaseUser.uid]);
    let myPosition = null;
    if (driverRes.rows.length) {
      const posRes = await query(
        `SELECT queue_position FROM airport_queue WHERE driver_id = $1 AND airport_code = $2`,
        [driverRes.rows[0].id, airportCode]
      );
      myPosition = posRes.rows[0]?.queue_position || null;
    }

    const queueCount = parseInt(total.rows[0].count);
    const waitMinutes = Math.max(0, queueCount * 2); // ~2 min per driver
    const density = queueCount < 10 ? 'Light' : queueCount < 25 ? 'Moderate' : 'Heavy';

    res.json({
      success: true,
      queue: {
        airportCode,
        count:      queueCount,
        myPosition,
        waitMinutes,
        density,
        label:  `${density} Queue`,
        waitStr: waitMinutes <= 5 ? `~${waitMinutes} min wait` : `~${waitMinutes} min wait`,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

module.exports = { getEarningsSummary, getEarningsHistory, getPerformance, getQueueStatus };
