const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.warn('⚠️  Supabase env vars not set – Realtime features will be disabled');
}

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'placeholder',
  {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 10 } },
  }
);

module.exports = supabase;
