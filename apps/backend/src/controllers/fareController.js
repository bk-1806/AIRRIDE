const { calculateAllFares } = require('../services/fareCalculator');

const getFareEstimate = async (req, res) => {
  try {
    const { pickupLat, pickupLng, destinationLat, destinationLng, scheduledAt } = req.body;
    if (!pickupLat || !pickupLng || !destinationLat || !destinationLng) {
      return res.status(400).json({ success: false, message: 'Pickup and destination coordinates required' });
    }
    const result = calculateAllFares(+pickupLat, +pickupLng, +destinationLat, +destinationLng, scheduledAt || new Date().toISOString());
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('getFareEstimate:', err);
    res.status(500).json({ success: false, message: 'Failed to calculate fare' });
  }
};

module.exports = { getFareEstimate };
