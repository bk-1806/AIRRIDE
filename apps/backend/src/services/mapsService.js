/**
 * AIRRIDE – Map Service Abstraction Layer
 * Supports both Google Maps and OpenStreetMap (OSRM + Nominatim).
 * Controlled by MAP_PROVIDER env var (osm | google).
 */
const axios = require('axios');
require('dotenv').config();

const GOOGLE_MAPS_BASE = 'https://maps.googleapis.com/maps/api';
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const OSRM_BASE = 'http://router.project-osrm.org';

const getProvider = () => {
  return (process.env.MAP_PROVIDER || 'osm').toLowerCase();
};

/**
 * Get real road distance and duration between two points.
 */
const getDistance = async (originLat, originLng, destLat, destLng) => {
  const provider = getProvider();

  if (provider === 'google' && process.env.GOOGLE_MAPS_API_KEY) {
    const url = `${GOOGLE_MAPS_BASE}/distancematrix/json`;
    const response = await axios.get(url, {
      params: {
        origins:      `${originLat},${originLng}`,
        destinations: `${destLat},${destLng}`,
        mode:         'driving',
        units:        'metric',
        key:          process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const element = response.data?.rows?.[0]?.elements?.[0];
    if (!element || element.status !== 'OK') {
      throw new Error(`Google Maps Distance Matrix error: ${element?.status || 'no result'}`);
    }

    return {
      distanceKm:  parseFloat((element.distance.value / 1000).toFixed(2)),
      durationMin: Math.ceil(element.duration.value / 60),
      distanceText: element.distance.text,
      durationText: element.duration.text,
      source: 'google_maps',
    };
  } else {
    // Default to OpenStreetMap / OSRM
    const url = `${OSRM_BASE}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=false`;
    const response = await axios.get(url);
    const route = response.data?.routes?.[0];
    if (!route) {
      throw new Error('OSRM route not found');
    }

    const distM = route.distance; // meters
    const durS = route.duration;  // seconds
    const km = parseFloat((distM / 1000).toFixed(2));
    const min = Math.ceil(durS / 60);

    return {
      distanceKm: km,
      durationMin: min,
      distanceText: `${km} km`,
      durationText: `${min} mins`,
      source: 'osm_osrm',
    };
  }
};

/**
 * Geocode an address string → { lat, lng, formattedAddress }
 */
const geocodeAddress = async (address) => {
  const provider = getProvider();

  if (provider === 'google' && process.env.GOOGLE_MAPS_API_KEY) {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/geocode/json`, {
      params: { address, key: process.env.GOOGLE_MAPS_API_KEY },
    });

    const result = response.data?.results?.[0];
    if (!result) throw new Error('Address not found via Google Geocoding');

    return {
      lat:              result.geometry.location.lat,
      lng:              result.geometry.location.lng,
      formattedAddress: result.formatted_address,
      placeId:          result.place_id,
    };
  } else {
    // Default to Nominatim (OpenStreetMap)
    const response = await axios.get(`${NOMINATIM_BASE}/search`, {
      params: { q: address, format: 'json', limit: 1 },
      headers: {
        'User-Agent': 'AIRRIDE-App/1.0 (bhavankothalanka@projectwebsite.com)'
      }
    });

    const result = response.data?.[0];
    if (!result) throw new Error(`Address not found via Nominatim: ${address}`);

    return {
      lat:              parseFloat(result.lat),
      lng:              parseFloat(result.lon),
      formattedAddress: result.display_name,
      placeId:          result.place_id ? String(result.place_id) : null,
    };
  }
};

/**
 * Get turn-by-turn directions + encoded polyline.
 */
const getDirections = async (originLat, originLng, destLat, destLng) => {
  const provider = getProvider();

  if (provider === 'google' && process.env.GOOGLE_MAPS_API_KEY) {
    const response = await axios.get(`${GOOGLE_MAPS_BASE}/directions/json`, {
      params: {
        origin:      `${originLat},${originLng}`,
        destination: `${destLat},${destLng}`,
        mode:        'driving',
        key:         process.env.GOOGLE_MAPS_API_KEY,
      },
    });

    const route = response.data?.routes?.[0];
    if (!route) throw new Error('No route found via Google Directions');

    return {
      polyline:     route.overview_polyline.points,
      distanceKm:  parseFloat((route.legs[0].distance.value / 1000).toFixed(2)),
      durationMin: Math.ceil(route.legs[0].duration.value / 60),
      steps:        route.legs[0].steps.map(s => ({
        instruction:  s.html_instructions.replace(/<[^>]*>/g, ''),
        distanceM:    s.distance.value,
      })),
    };
  } else {
    // Default to OSRM (OpenStreetMap)
    const url = `${OSRM_BASE}/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=polyline&steps=true`;
    const response = await axios.get(url);
    const route = response.data?.routes?.[0];
    if (!route) throw new Error('No OSRM route found');

    const distM = route.distance;
    const durS = route.duration;
    const km = parseFloat((distM / 1000).toFixed(2));
    const min = Math.ceil(durS / 60);

    const steps = route.legs?.[0]?.steps?.map(s => ({
      instruction: s.maneuver?.instruction || (s.name ? `Drive on ${s.name}` : 'Continue driving'),
      distanceM: Math.round(s.distance)
    })) || [];

    return {
      polyline:     route.geometry, // precision 5 encoded polyline
      distanceKm:  km,
      durationMin: min,
      steps,
    };
  }
};

module.exports = { getDistance, geocodeAddress, getDirections };
