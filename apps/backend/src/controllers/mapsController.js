const { getDistance, geocodeAddress, getDirections } = require('../services/mapsService');
const { calculateAllFares } = require('../services/fareCalculator');

/**
 * GET /api/maps/distance?originLat=&originLng=&destLat=&destLng=
 */
const distance = async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ success: false, message: 'originLat, originLng, destLat, destLng required' });
    }
    const result = await getDistance(+originLat, +originLng, +destLat, +destLng);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/maps/geocode?address=
 */
const geocode = async (req, res) => {
  try {
    const { address } = req.query;
    if (!address) return res.status(400).json({ success: false, message: 'address required' });
    const result = await geocodeAddress(address);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/maps/directions?originLat=&originLng=&destLat=&destLng=
 */
const directions = async (req, res) => {
  try {
    const { originLat, originLng, destLat, destLng } = req.query;
    if (!originLat || !originLng || !destLat || !destLng) {
      return res.status(400).json({ success: false, message: 'All coordinates required' });
    }
    const result = await getDirections(+originLat, +originLng, +destLat, +destLng);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * GET /api/fare/calculate?pickupLat=&pickupLng=&destLat=&destLng=&scheduledAt=
 */
const calculateFare = async (req, res) => {
  try {
    const { pickupLat, pickupLng, destLat, destLng, scheduledAt } = req.query;
    if (!pickupLat || !pickupLng || !destLat || !destLng) {
      return res.status(400).json({ success: false, message: 'Coordinates required' });
    }

    // Use real distance if Maps key available
    let distanceKm;
    try {
      const dist = await getDistance(+pickupLat, +pickupLng, +destLat, +destLng);
      distanceKm = dist.distanceKm;
    } catch {
      // Fallback to haversine
      const { calculateAllFares: calc } = require('../services/fareCalculator');
      const fallback = calc(+pickupLat, +pickupLng, +destLat, +destLng, scheduledAt || new Date().toISOString());
      return res.json({ success: true, ...fallback });
    }

    const result = calculateAllFares(+pickupLat, +pickupLng, +destLat, +destLng, scheduledAt || new Date().toISOString());
    // Override distanceKm with real road distance
    result.distanceKm = distanceKm;
    result.estimatedDurationMin = Math.round(distanceKm * 3);
    result.fares = result.fares.map(f => ({
      ...f,
      distanceFare: Math.round(f.distanceFare * (distanceKm / result.distanceKm || 1)),
      totalFare:    Math.round((f.baseFare + Math.round(f.distanceFare * (distanceKm / result.distanceKm || 1)) + f.airportSurcharge) * (result.isNightTime ? 1.25 : 1)),
    }));

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('calculateFare:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { distance, geocode, directions, calculateFare };
