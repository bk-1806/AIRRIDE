require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'airride_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    const plain = 'neeraj@123';
    const hash = bcrypt.hashSync(plain, 10);
    const res = await pool.query(
      "UPDATE admins SET password_hash = $1 WHERE email = $2",
      [hash, 'admin@airride.in']
    );
    console.log('✅ Password updated for admin@airride.in');
  } catch (err) {
    console.error('❌ Error updating password:', err);
  } finally {
    await pool.end();
  }
})();
