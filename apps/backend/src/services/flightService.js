/**
 * AIRRIDE – Flight Data Service
 * Uses AviationStack API for real-time flight status.
 * Falls back to stored flight data if API unavailable.
 */
const axios = require('axios');
const { query } = require('../config/database');
require('dotenv').config();

const AVIATION_BASE = 'https://api.aviationstack.com/v1';

/**
 * Fetch flight status from AviationStack and cache in DB.
 */
const getFlightStatus = async (flightNumber) => {
  const clean = flightNumber.replace(/\s+/g, '').toUpperCase();

  // Check DB cache first (fresh within 5 minutes)
  const cached = await query(
    `SELECT * FROM flights WHERE flight_number = $1 AND last_synced > NOW() - INTERVAL '5 minutes'`,
    [clean]
  );
  if (cached.rows.length) return { source: 'cache', flight: cached.rows[0] };

  // Call AviationStack API
  if (!process.env.AVIATION_API_KEY) {
    throw new Error('AVIATION_API_KEY not configured');
  }

  const response = await axios.get(`${AVIATION_BASE}/flights`, {
    params: { access_key: process.env.AVIATION_API_KEY, flight_iata: clean, limit: 1 },
    timeout: 8000,
  });

  const data = response.data?.data?.[0];
  if (!data) throw new Error(`Flight ${clean} not found`);

  const flight = {
    flight_number:       data.flight?.iata || clean,
    airline:             data.airline?.name,
    origin_airport:      data.departure?.iata,
    destination_airport: data.arrival?.iata,
    scheduled_departure: data.departure?.scheduled,
    scheduled_arrival:   data.arrival?.scheduled,
    actual_departure:    data.departure?.actual,
    actual_arrival:      data.arrival?.actual,
    status:              data.flight_status || 'scheduled',
    terminal:            data.arrival?.terminal,
    gate:                data.arrival?.gate,
  };

  // Upsert into flights table
  const existing = await query(`SELECT id FROM flights WHERE flight_number = $1 LIMIT 1`, [clean]);
  let result;
  if (existing.rows.length) {
    result = await query(
      `UPDATE flights SET
         airline = $1, origin_airport = $2, destination_airport = $3,
         scheduled_departure = $4, scheduled_arrival = $5,
         actual_departure = $6, actual_arrival = $7,
         status = $8, terminal = $9, gate = $10, last_synced = NOW()
       WHERE id = $11 RETURNING *`,
      [flight.airline, flight.origin_airport, flight.destination_airport,
       flight.scheduled_departure, flight.scheduled_arrival, flight.actual_departure,
       flight.actual_arrival, flight.status, flight.terminal, flight.gate, existing.rows[0].id]
    );
  } else {
    result = await query(
      `INSERT INTO flights
         (flight_number, airline, origin_airport, destination_airport,
          scheduled_departure, scheduled_arrival, actual_departure, actual_arrival,
          status, terminal, gate, last_synced)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       RETURNING *`,
      [flight.flight_number, flight.airline, flight.origin_airport,
       flight.destination_airport, flight.scheduled_departure, flight.scheduled_arrival,
       flight.actual_departure, flight.actual_arrival, flight.status,
       flight.terminal, flight.gate]
    );
  }

  return { source: 'api', flight: result.rows[0] || flight };
};

module.exports = { getFlightStatus };
