const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
require('dotenv').config();

const authRoutes    = require('./routes/auth.routes');
const bookingRoutes = require('./routes/booking.routes');
const fareRoutes    = require('./routes/fare.routes');
const mapsRoutes    = require('./routes/maps.routes');
const earningsRoutes = require('./routes/earnings.routes');
const flightRoutes  = require('./routes/flights.routes');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const createApp = (io) => {
  const app = express();

  // ── Security & Performance ──────────────────────────────────────────
  app.use(helmet());
  app.use(compression());

  const isProd = process.env.NODE_ENV === 'production';

  const productionOrigins = [
    process.env.CUSTOMER_APP_URL,
    process.env.DRIVER_APP_URL,
    process.env.ADMIN_DASHBOARD_URL,
  ].filter(Boolean);

  const developmentOrigins = [
    'http://localhost:3456',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    ...productionOrigins,
  ];

  const allowedOrigins = isProd ? productionOrigins : developmentOrigins;

  app.use(cors({
    origin: (origin, cb) => {
      // In production, block no-origin requests (mobile/curl must use production domain)
      if (!origin && isProd) return cb(new Error('CORS blocked: origin required in production'));
      // Allow no-origin in dev (curl / file:// testing)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  }));

  app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // ── Health Check ────────────────────────────────────────────────────
  app.get('/health', (_req, res) => res.json({
    status:    'healthy',
    service:   'AIRRIDE API v2',
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV || 'development',
  }));

  // ── Routes ──────────────────────────────────────────────────────────
  app.use('/api/auth',      authRoutes);
  app.use('/api/bookings',  bookingRoutes(io));   // io injected for real-time
  app.use('/api/fare',      fareRoutes);
  app.use('/api/maps',      mapsRoutes);
  app.use('/api/flights',   flightRoutes);
  app.use('/api/driver',    require('./routes/driver.routes')(io));
  app.use('/api/admin',     require('./routes/admin.routes')(io));
  app.use('/api/earnings',  earningsRoutes);

  // ── Error Handlers ──────────────────────────────────────────────────
  app.use(notFound);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
