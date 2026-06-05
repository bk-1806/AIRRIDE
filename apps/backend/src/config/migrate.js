const { query } = require('./database');
require('dotenv').config();

const migrate = async () => {
  console.log('🚀 Running AIRRIDE database migrations...');

  await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(255),
      role VARCHAR(50) DEFAULT 'dispatcher',
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ admins');

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid VARCHAR(128) UNIQUE NOT NULL,
      phone_number VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(255),
      email VARCHAR(255),
      profile_photo_url TEXT,
      home_address TEXT,
      home_lat DECIMAL(10,8),
      home_lng DECIMAL(11,8),
      fcm_token TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ users');

  await query(`
    CREATE TABLE IF NOT EXISTS drivers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid VARCHAR(128) UNIQUE NOT NULL,
      phone_number VARCHAR(20) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      profile_photo_url TEXT,
      license_number VARCHAR(100),
      rating DECIMAL(3,2) DEFAULT 5.00,
      total_trips INTEGER DEFAULT 0,
      is_online BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      current_lat DECIMAL(10,8),
      current_lng DECIMAL(11,8),
      fcm_token TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ drivers');

  await query(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
      vehicle_type VARCHAR(50) NOT NULL,
      make VARCHAR(100),
      model VARCHAR(100),
      year INTEGER,
      color VARCHAR(50),
      license_plate VARCHAR(30) UNIQUE NOT NULL,
      capacity INTEGER DEFAULT 4,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ vehicles');

  await query(`
    CREATE TABLE IF NOT EXISTS flights (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      flight_number VARCHAR(20) NOT NULL,
      airline VARCHAR(100),
      origin_airport VARCHAR(10),
      destination_airport VARCHAR(10),
      scheduled_departure TIMESTAMPTZ,
      scheduled_arrival TIMESTAMPTZ,
      actual_departure TIMESTAMPTZ,
      actual_arrival TIMESTAMPTZ,
      status VARCHAR(50) DEFAULT 'scheduled',
      terminal VARCHAR(10),
      gate VARCHAR(10),
      last_synced TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ flights');

  await query(`
    CREATE TABLE IF NOT EXISTS bookings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_ref VARCHAR(20) UNIQUE NOT NULL,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
      vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
      flight_id UUID REFERENCES flights(id) ON DELETE SET NULL,
      vehicle_type VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      pickup_address TEXT NOT NULL,
      pickup_lat DECIMAL(10,8) NOT NULL,
      pickup_lng DECIMAL(11,8) NOT NULL,
      destination_address TEXT NOT NULL,
      destination_lat DECIMAL(10,8) NOT NULL,
      destination_lng DECIMAL(11,8) NOT NULL,
      scheduled_at TIMESTAMPTZ NOT NULL,
      pickup_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      estimated_distance_km DECIMAL(8,2),
      estimated_duration_min INTEGER,
      base_fare DECIMAL(10,2),
      distance_fare DECIMAL(10,2),
      airport_surcharge DECIMAL(10,2) DEFAULT 100,
      total_fare DECIMAL(10,2),
      payment_method VARCHAR(50) DEFAULT 'cash',
      payment_status VARCHAR(50) DEFAULT 'pending',
      special_instructions TEXT,
      admin_notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ bookings');

  await query(`
    CREATE TABLE IF NOT EXISTS payments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      amount DECIMAL(10,2) NOT NULL,
      currency VARCHAR(3) DEFAULT 'INR',
      payment_method VARCHAR(50),
      upi_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      paid_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ payments');

  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
      title VARCHAR(255) NOT NULL,
      body TEXT NOT NULL,
      type VARCHAR(50),
      booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  console.log('✅ notifications');

  await query(`
    CREATE TABLE IF NOT EXISTS ride_matches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
      driver_id UUID REFERENCES drivers(id) ON DELETE CASCADE,
      assigned_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
      status VARCHAR(30) DEFAULT 'offered',
      offered_at TIMESTAMPTZ DEFAULT NOW(),
      responded_at TIMESTAMPTZ
    );
  `);
  console.log('✅ ride_matches');

  // Performance indexes
  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_driver_id ON bookings(driver_id)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)`,
    `CREATE INDEX IF NOT EXISTS idx_bookings_created_at ON bookings(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_drivers_is_online ON drivers(is_online)`,
    `CREATE INDEX IF NOT EXISTS idx_drivers_firebase_uid ON drivers(firebase_uid)`,
    `CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid)`,
  ];
  for (const idx of indexes) await query(idx);
  console.log('✅ indexes created');

  console.log('\n🎉 All migrations completed successfully!');
  process.exit(0);
};

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
