/**
 * AIRRIDE – Migration v2
 * Adds: driver_locations, driver_earnings, driver_performance, airport_queue
 * Run: node src/config/migrate2.js
 */
const { query } = require('./database');
require('dotenv').config();

const migrate2 = async () => {
  console.log('🚀 Running AIRRIDE migration v2...');

  // ── driver_locations ────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS driver_locations (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id    UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
      lat          DECIMAL(10,8) NOT NULL,
      lng          DECIMAL(11,8) NOT NULL,
      heading      DECIMAL(5,2),
      speed        DECIMAL(6,2),
      accuracy     DECIMAL(8,2),
      booking_id   UUID REFERENCES bookings(id) ON DELETE SET NULL,
      recorded_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_dloc_driver ON driver_locations(driver_id, recorded_at DESC);`);
  console.log('✅ driver_locations');

  // ── driver_earnings ─────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS driver_earnings (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id        UUID REFERENCES drivers(id) ON DELETE CASCADE NOT NULL,
      booking_id       UUID REFERENCES bookings(id) ON DELETE SET NULL,
      gross_fare       DECIMAL(10,2) NOT NULL,
      commission_pct   DECIMAL(5,2)  DEFAULT 8.00,
      commission_amt   DECIMAL(10,2) NOT NULL,
      airport_surcharge DECIMAL(10,2) DEFAULT 0,
      net_payout       DECIMAL(10,2) NOT NULL,
      status           VARCHAR(30)   DEFAULT 'pending',
      paid_at          TIMESTAMPTZ,
      period_date      DATE          DEFAULT CURRENT_DATE,
      created_at       TIMESTAMPTZ   DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_earn_driver ON driver_earnings(driver_id, period_date DESC);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_earn_status ON driver_earnings(status);`);
  console.log('✅ driver_earnings');

  // ── driver_performance ──────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS driver_performance (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id        UUID REFERENCES drivers(id) ON DELETE CASCADE UNIQUE NOT NULL,
      total_offered    INTEGER     DEFAULT 0,
      total_accepted   INTEGER     DEFAULT 0,
      total_completed  INTEGER     DEFAULT 0,
      total_cancelled  INTEGER     DEFAULT 0,
      total_on_time    INTEGER     DEFAULT 0,
      accept_rate      DECIMAL(5,2) DEFAULT 100.00,
      cancel_rate      DECIMAL(5,2) DEFAULT 0.00,
      on_time_rate     DECIMAL(5,2) DEFAULT 100.00,
      avg_rating       DECIMAL(3,2) DEFAULT 5.00,
      updated_at       TIMESTAMPTZ  DEFAULT NOW()
    );
  `);
  console.log('✅ driver_performance');

  // ── airport_queue ───────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS airport_queue (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id      UUID REFERENCES drivers(id) ON DELETE CASCADE UNIQUE NOT NULL,
      airport_code   VARCHAR(10) NOT NULL,
      terminal       VARCHAR(10),
      queue_position INTEGER,
      joined_at      TIMESTAMPTZ DEFAULT NOW(),
      status         VARCHAR(30) DEFAULT 'waiting'
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_queue_airport ON airport_queue(airport_code, queue_position ASC NULLS LAST);`);
  console.log('✅ airport_queue');

  // ── extend bookings status check ────────────────────────────────
  // driver_arrived is a new status between driver_accepted and in_progress
  await query(`
    COMMENT ON COLUMN bookings.status IS
    'Values: pending | driver_assigned | driver_accepted | driver_arrived | in_progress | completed | cancelled';
  `);

  // ── ratings table ───────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS ratings (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id  UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
      rater_id    UUID NOT NULL,
      rated_id    UUID NOT NULL,
      rater_role  VARCHAR(20) NOT NULL,
      score       INTEGER CHECK (score BETWEEN 1 AND 5),
      comment     TEXT,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  await query(`CREATE INDEX IF NOT EXISTS idx_ratings_rated ON ratings(rated_id);`);
  console.log('✅ ratings');

  console.log('\n🎉 Migration v2 completed!');
  process.exit(0);
};

migrate2().catch((err) => {
  console.error('❌ Migration v2 failed:', err);
  process.exit(1);
});
