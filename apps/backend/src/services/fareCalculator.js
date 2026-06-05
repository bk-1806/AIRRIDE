/**
 * AIRRIDE Fare Calculation Service
 * Vehicle types: Sedan, SUV, Premium Sedan, Innova
 */

const VEHICLE_CONFIG = {
  sedan: {
    displayName: 'Sedan',
    key: 'sedan',
    baseFare: 300,
    ratePerKm: 12,
    capacity: 4,
    description: 'Comfortable sedan for up to 4 passengers',
  },
  suv: {
    displayName: 'SUV',
    key: 'suv',
    baseFare: 450,
    ratePerKm: 16,
    capacity: 6,
    description: 'Spacious SUV with extra legroom',
  },
  premium_sedan: {
    displayName: 'Premium Sedan',
    key: 'premium_sedan',
    baseFare: 700,
    ratePerKm: 22,
    capacity: 4,
    description: 'Luxury sedan with premium comfort',
  },
  innova: {
    displayName: 'Innova',
    key: 'innova',
    baseFare: 550,
    ratePerKm: 18,
    capacity: 7,
    description: 'Toyota Innova — ideal for groups',
  },
};

const AIRPORT_SURCHARGE = 100;
const NIGHT_MULTIPLIER = 1.25; // 10pm–6am

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isNight = (date) => {
  const h = new Date(date).getHours();
  return h >= 22 || h < 6;
};

const calcFare = (vehicleKey, distanceKm, scheduledAt) => {
  const cfg = VEHICLE_CONFIG[vehicleKey];
  if (!cfg) throw new Error(`Unknown vehicle: ${vehicleKey}`);
  const distanceFare = Math.round(cfg.ratePerKm * distanceKm);
  const subtotal = cfg.baseFare + distanceFare + AIRPORT_SURCHARGE;
  const mult = isNight(scheduledAt) ? NIGHT_MULTIPLIER : 1.0;
  const nightSurcharge = mult > 1 ? Math.round(subtotal * (mult - 1)) : 0;
  const totalFare = Math.round(subtotal * mult);
  return {
    vehicleType: cfg.displayName,
    vehicleKey: cfg.key,
    baseFare: cfg.baseFare,
    distanceFare,
    airportSurcharge: AIRPORT_SURCHARGE,
    nightSurcharge,
    totalFare,
    capacity: cfg.capacity,
    description: cfg.description,
  };
};

const calculateAllFares = (pickupLat, pickupLng, destLat, destLng, scheduledAt) => {
  const distanceKm = haversineKm(pickupLat, pickupLng, destLat, destLng);
  const estimatedDurationMin = Math.round(distanceKm * 3);
  const fares = Object.keys(VEHICLE_CONFIG).map((k) => calcFare(k, distanceKm, scheduledAt));
  return {
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    estimatedDurationMin,
    fares,
    isNightTime: isNight(scheduledAt),
  };
};

module.exports = { calculateAllFares, calcFare, haversineKm, VEHICLE_CONFIG };
