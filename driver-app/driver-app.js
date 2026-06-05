/**
 * AIRRIDE Driver App – Complete API & Maps Integration Layer
 * Supports both OpenStreetMap (Leaflet/OSRM/Nominatim) and Google Maps.
 */
'use strict';

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE     = window.AIRRIDE_CONFIG?.API_BASE        || 'http://localhost:3000/api';
const WS_URL       = window.AIRRIDE_CONFIG?.WS_URL          || 'http://localhost:3000';
const SUPABASE_URL = window.AIRRIDE_CONFIG?.SUPABASE_URL    || '';
const SUPABASE_KEY = window.AIRRIDE_CONFIG?.SUPABASE_ANON_KEY || '';
const MAP_PROVIDER = window.AIRRIDE_CONFIG?.MAP_PROVIDER    || 'osm';

// ─────────────────────────────────────────────────────────
// AUTH & APP STATE
// ─────────────────────────────────────────────────────────
let _firebaseUser = null;
let _idToken      = null;
let _socket       = null;
let _gpsWatchId   = null;
let _supaChannel  = null;

const DS = {
  currentScreen:   'splash',
  isOnline:        false,
  driver:          null,
  performance:     null,
  earnings:        { today: { amount: 0, trips: 0 }, week: { amount: 0, trips: 0 }, month: { amount: 0, trips: 0 }, total: { amount: 0, trips: 0 } },
  currentRequest:  null,
  currentTrip:     null,
  tripHistory:     [],
  queueStatus:     null,
  driverLat:       null,
  driverLng:       null,
};
window.DS = DS;

const SCREEN_ORDER = ['splash','login','otp','home','request','tripdetail','navigating','waiting','activetrip','completion','trips','earnings','profile'];

// ─────────────────────────────────────────────────────────
// MAP ABSTRACTION LAYER (AirrideMap)
// ─────────────────────────────────────────────────────────
class AirrideMap {
  constructor(elementId, center, zoom, provider = 'osm') {
    this.provider = provider;
    this.elementId = elementId;
    this.markers = [];
    this.routes = [];

    const el = document.getElementById(elementId);
    if (!el) {
      console.warn(`Map element #${elementId} not found`);
      return;
    }

    if (this.provider === 'google' && window.google?.maps) {
      this.map = new google.maps.Map(el, {
        center: center,
        zoom: zoom,
        disableDefaultUI: true,
        styles: [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        ]
      });
    } else if (window.L) {
      // Clear leaflet container if already initialized
      if (el._leaflet_id) {
        el.innerHTML = '';
        el.className = el.className.replace(/\bleaflet-[^\s]+\b/g, '');
      }
      this.map = L.map(elementId, { zoomControl: false }).setView([center.lat, center.lng], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(this.map);
    } else {
      console.warn('Neither Google Maps nor Leaflet loaded');
    }
  }

  panTo(coords) {
    if (!this.map) return;
    if (this.provider === 'google') {
      this.map.panTo(coords);
    } else {
      this.map.panTo([coords.lat, coords.lng]);
    }
  }

  setZoom(level) {
    if (!this.map) return;
    this.map.setZoom(level);
  }

  addMarker(coords, options = {}) {
    if (!this.map) return null;
    const { label, title, draggable, onDragEnd, isDriver } = options;

    if (this.provider === 'google') {
      const gMarkerOpts = {
        map: this.map,
        position: coords,
        draggable: !!draggable,
        title: title || ''
      };

      if (isDriver) {
        gMarkerOpts.icon = {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
            '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#0a0a0a"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/></svg>'
          ),
          scaledSize: new google.maps.Size(32, 32),
          anchor: new google.maps.Point(16, 16)
        };
      } else if (label) {
        gMarkerOpts.label = { text: label, color: label === 'P' ? '#ffffff' : '#0a0a0a', fontWeight: 'bold' };
        gMarkerOpts.icon = {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 14,
          fillColor: label === 'P' ? '#0a0a0a' : '#ffffff',
          fillOpacity: 1,
          strokeColor: label === 'P' ? '#ffffff' : '#0a0a0a',
          strokeWeight: 2
        };
      }

      const marker = new google.maps.Marker(gMarkerOpts);

      if (draggable && onDragEnd) {
        google.maps.event.addListener(marker, 'dragend', () => {
          const pos = marker.getPosition();
          onDragEnd({ lat: pos.lat(), lng: pos.lng() });
        });
      }

      const wrapper = {
        provider: 'google',
        marker,
        setPosition: (c) => marker.setPosition(c),
        remove: () => marker.setMap(null)
      };
      this.markers.push(wrapper);
      return wrapper;
    } else {
      const lMarkerOpts = {
        draggable: !!draggable,
        title: title || ''
      };

      if (isDriver) {
        lMarkerOpts.icon = L.divIcon({
          html: `<div style="font-size:24px;text-align:center;line-height:32px;">🚗</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });
      } else if (label) {
        const pinColor = label === 'P' ? '#0a0a0a' : '#ffffff';
        const textColor = label === 'P' ? '#ffffff' : '#0a0a0a';
        lMarkerOpts.icon = L.divIcon({
          html: `<div style="background:${pinColor};color:${textColor};border:2px solid ${textColor};border-radius:50%;width:24px;height:24px;line-height:20px;text-align:center;font-weight:bold;font-size:12px;">${label}</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
      }

      const marker = L.marker([coords.lat, coords.lng], lMarkerOpts).addTo(this.map);

      if (draggable && onDragEnd) {
        marker.on('dragend', () => {
          const pos = marker.getLatLng();
          onDragEnd({ lat: pos.lat, lng: pos.lng });
        });
      }

      const wrapper = {
        provider: 'osm',
        marker,
        setPosition: (c) => marker.setLatLng([c.lat, c.lng]),
        remove: () => this.map.removeLayer(marker)
      };
      this.markers.push(wrapper);
      return wrapper;
    }
  }

  drawRoute(polylineStr) {
    this.clearRoutes();
    if (!this.map) return;

    if (this.provider === 'google') {
      const directionsRenderer = new google.maps.DirectionsRenderer({
        map: this.map,
        suppressMarkers: true,
        polylineOptions: { strokeColor: '#0a0a0a', strokeWeight: 5, strokeOpacity: 0.8 }
      });
      const path = google.maps.geometry.encoding.decodePath(polylineStr);
      const directionsResult = {
        routes: [{
          overview_path: path,
          legs: [{ start_location: path[0], end_location: path[path.length - 1], steps: [] }],
          bounds: new google.maps.LatLngBounds()
        }]
      };
      path.forEach(p => directionsResult.routes[0].bounds.extend(p));
      directionsRenderer.setDirections(directionsResult);

      this.routes.push({
        provider: 'google',
        renderer: directionsRenderer,
        remove: () => directionsRenderer.setMap(null)
      });
    } else {
      const coordinates = this._decodePolyline(polylineStr);
      const polyline = L.polyline(coordinates, { color: '#0a0a0a', weight: 5, opacity: 0.8 }).addTo(this.map);
      this.map.fitBounds(polyline.getBounds(), { padding: [40, 40] });

      this.routes.push({
        provider: 'osm',
        layer: polyline,
        remove: () => this.map.removeLayer(polyline)
      });
    }
  }

  clearRoutes() {
    this.routes.forEach(r => r.remove());
    this.routes = [];
  }

  _decodePolyline(str) {
    let index = 0, len = str.length;
    let lat = 0, lng = 0;
    const coordinates = [];

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = str.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      coordinates.push([lat / 1e5, lng / 1e5]);
    }
    return coordinates;
  }
}

// ─────────────────────────────────────────────────────────
// HTTP HELPER
// ─────────────────────────────────────────────────────────
async function dApiRequest(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (_idToken) headers['Authorization'] = `Bearer ${_idToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `API error ${res.status}`);
  return data;
}

const dApi = {
  get:   (ep)        => dApiRequest('GET',   ep),
  post:  (ep, body)  => dApiRequest('POST',  ep, body),
  put:   (ep, body)  => dApiRequest('PUT',   ep, body),
  patch: (ep, body)  => dApiRequest('PATCH', ep, body),
};

// ─────────────────────────────────────────────────────────
// FIREBASE AUTH
// ─────────────────────────────────────────────────────────
let _recaptchaVerifier   = null;
let _confirmationResult  = null;

function dInitFirebaseAuth() {
  if (!window.firebase) { console.warn('Firebase SDK not loaded'); return; }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      _firebaseUser = user;
      _idToken = await user.getIdToken();
      setInterval(async () => { _idToken = await user.getIdToken(true); }, 50 * 60 * 1000);
      await dRegisterDriver();
      dInitSocket();
    } else {
      _firebaseUser = null;
      _idToken      = null;
      _socket?.disconnect();
    }
  });
}

async function dSendOTP() {
  const phoneInput = document.getElementById('d-phone-input');
  const phone = phoneInput?.value?.trim().replace(/\D/g,'');
  if (!phone || phone.length < 10) {
    dShakeEl(phoneInput?.parentElement);
    dShowToast('Enter a valid 10-digit phone number');
    return;
  }

  const formatted = `+91${phone}`;
  DS.pendingPhone = formatted;

  try {
    if (!window.firebase) throw new Error('Firebase not loaded');

    _recaptchaVerifier = _recaptchaVerifier || new firebase.auth.RecaptchaVerifier(
      'd-recaptcha-container',
      { size: 'invisible', callback: () => {} }
    );

    dShowToast('Sending OTP…');
    _confirmationResult = await firebase.auth().signInWithPhoneNumber(formatted, _recaptchaVerifier);
    const otpPhoneEl = document.getElementById('d-otp-phone');
    if (otpPhoneEl) otpPhoneEl.textContent = formatted;
    dNav('otp');
  } catch (err) {
    dShowToast('Failed to send OTP: ' + err.message);
    console.error('dSendOTP:', err);
  }
}

async function dVerifyOTP() {
  const cells = document.querySelectorAll('.d-otp-cell');
  const code  = Array.from(cells).map(c => c.value).join('');
  if (code.length < 6) {
    cells.forEach(c => { if (!c.value) c.style.borderColor = '#ef4444'; });
    setTimeout(() => cells.forEach(c => c.style.borderColor = ''), 1200);
    return;
  }

  try {
    if (!_confirmationResult) throw new Error('No pending OTP');
    dShowToast('Verifying…');

    const result = await _confirmationResult.confirm(code);
    _firebaseUser = result.user;
    _idToken      = await result.user.getIdToken();

    cells.forEach(c => { c.style.background = '#f0fdf4'; c.style.borderColor = '#22c55e'; });
    setTimeout(async () => {
      cells.forEach(c => { c.style.background = ''; c.style.borderColor = ''; });
      await dRegisterDriver();
      dInitSocket();
      dNav('home');
    }, 600);
  } catch (err) {
    cells.forEach(c => { c.style.borderColor = '#ef4444'; });
    setTimeout(() => cells.forEach(c => c.style.borderColor = ''), 1200);
    dShowToast('Invalid OTP – please try again');
    console.error('dVerifyOTP:', err);
  }
}

async function dRegisterDriver() {
  try {
    const fcmToken = await dGetFCMToken();
    const data = await dApi.post('/auth/driver/verify', {
      fullName: _firebaseUser.displayName || 'Driver',
      fcmToken,
    });
    DS.driver = data.driver;
    dUpdateProfileUI(data.driver);
    return data.driver;
  } catch (err) {
    console.error('dRegisterDriver:', err.message);
  }
}

async function dGetFCMToken() {
  try {
    if (!window.firebase?.messaging) return null;
    const messaging = firebase.messaging();
    return await messaging.getToken({ vapidKey: window.AIRRIDE_CONFIG?.FCM_VAPID_KEY });
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────
// SOCKET.IO
// ─────────────────────────────────────────────────────────
function dInitSocket() {
  if (!window.io) { console.warn('Socket.IO not loaded'); return; }
  if (_socket?.connected) return;

  _socket = io(WS_URL, {
    auth:               { token: _idToken },
    transports:         ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay:  2000,
  });

  _socket.on('connect', () => {
    console.log('🔌 Driver socket connected');
    if (DS.driver?.id) {
      _socket.emit('join_driver_room', { driverId: DS.driver.id });
    }
  });

  _socket.on('ride_request', ({ booking, driver, timeoutSec }) => {
    DS.currentRequest = {
      id:        booking.id,
      bookingRef: booking.booking_ref,
      passenger: { name: booking.customer_name || 'Passenger', initials: (booking.customer_name || 'P').charAt(0), rating: 4.8, rides: 2 },
      pickup:    booking.pickup_address,
      destination: booking.destination_address,
      payout:    parseFloat(booking.total_fare) * 0.92,
      eta:       `${driver.etaMinutes || '?'} min`,
      distance:  `${driver.distanceKm || '?'} km`,
      timeoutSec: timeoutSec || 30,
    };
    if (DS.isOnline && DS.currentScreen === 'home') {
      dShowIncomingBanner();
    }
  });

  _socket.on('booking_status_update', ({ status, booking }) => {
    DS.currentTrip = { ...(DS.currentTrip || {}), ...booking, status };
    dShowToast(`Trip status: ${status.replace(/_/g,' ')}`);
  });

  _socket.on('ride_cancelled', () => {
    dShowToast('Passenger cancelled the ride');
    DS.currentRequest = null;
    DS.currentTrip    = null;
    dNav('home');
  });

  _socket.on('disconnect', () => console.log('🔌 Driver socket disconnected'));
}

// ─────────────────────────────────────────────────────────
// GPS BROADCASTER & TELEMETRY
// ─────────────────────────────────────────────────────────
let _lastGPSEmit = 0;
const GPS_EMIT_INTERVAL = 5000;

let _driverNavMap = null;
let _driverActiveMap = null;
let _driverNavMarker = null;
let _driverActiveMarker = null;

function dStartGPS() {
  if (!navigator.geolocation) { dShowToast('Geolocation not supported'); return; }
  if (_gpsWatchId != null) return;

  _gpsWatchId = navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude: lat, longitude: lng, heading, speed, accuracy } = pos.coords;

      DS.driverLat = lat;
      DS.driverLng = lng;

      dUpdateNavMarker(lat, lng);

      const now = Date.now();
      if (now - _lastGPSEmit >= GPS_EMIT_INTERVAL) {
        _lastGPSEmit = now;
        const bookingId = DS.currentTrip?.id || null;

        _socket?.emit('driver_location', { driverId: DS.driver?.id, lat, lng, bookingId });
        dApi.put('/driver/location', { lat, lng, heading, speed, accuracy }).catch(() => {});
      }
    },
    (err) => console.error('GPS error:', err),
    { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
  );
}

function dStopGPS() {
  if (_gpsWatchId != null) {
    navigator.geolocation.clearWatch(_gpsWatchId);
    _gpsWatchId = null;
  }
}

function dUpdateNavMarker(lat, lng) {
  const pos = { lat: +lat, lng: +lng };

  if (DS.currentScreen === 'navigating') {
    if (_driverNavMarker) {
      _driverNavMarker.setPosition(pos);
    } else if (_driverNavMap) {
      _driverNavMarker = _driverNavMap.addMarker(pos, { isDriver: true, title: 'Your Vehicle' });
    }
    _driverNavMap?.panTo(pos);
  } else if (DS.currentScreen === 'activetrip') {
    if (_driverActiveMarker) {
      _driverActiveMarker.setPosition(pos);
    } else if (_driverActiveMap) {
      _driverActiveMarker = _driverActiveMap.addMarker(pos, { isDriver: true, title: 'Your Vehicle' });
    }
    _driverActiveMap?.panTo(pos);
  }
}

// ─────────────────────────────────────────────────────────
// ONLINE STATUS SWITCH (API call)
// ─────────────────────────────────────────────────────────
async function toggleOnlineStatus() {
  DS.isOnline = !DS.isOnline;
  dUpdateOnlineUI();

  try {
    let lat = null, lng = null;
    if (DS.isOnline && navigator.geolocation) {
      await new Promise(resolve => navigator.geolocation.getCurrentPosition(
        p => { lat = p.coords.latitude; lng = p.coords.longitude; resolve(); },
        () => resolve(), { timeout: 5000 }
      ));
    }

    await dApi.put('/driver/availability', { isOnline: DS.isOnline, lat, lng });
    dShowToast(DS.isOnline ? 'You are now ONLINE' : 'You are now OFFLINE');

    if (DS.isOnline) dStartGPS();
    else             dStopGPS();
  } catch (err) {
    DS.isOnline = !DS.isOnline;
    dUpdateOnlineUI();
    dShowToast('Failed to update status: ' + err.message);
  }
}

function dUpdateOnlineUI() {
  const toggle = document.getElementById('d-toggle-btn');
  const dot    = document.getElementById('d-status-dot');
  const text   = document.getElementById('d-status-text');
  if (toggle) {
    toggle.classList.toggle('on', DS.isOnline);
    toggle.setAttribute('aria-checked', DS.isOnline.toString());
  }
  if (dot)  dot.classList.toggle('online', DS.isOnline);
  if (text) text.textContent = DS.isOnline ? 'ONLINE' : 'OFFLINE';
}

// ─────────────────────────────────────────────────────────
// HOME & INCOMING BANNER
// ─────────────────────────────────────────────────────────
async function initDHome() {
  dUpdateGreeting();
  dUpdateOnlineUI();

  try {
    const [profileData, earningsData, perfData, queueData] = await Promise.all([
      dApi.get('/driver/profile').catch(() => null),
      dApi.get('/driver/earnings').catch(() => null),
      dApi.get('/driver/performance').catch(() => null),
      dApi.get('/driver/queue?airportCode=JFK').catch(() => null),
    ]);

    if (profileData?.driver) {
      DS.driver = profileData.driver;
      dUpdateProfileUI(DS.driver);
    }

    if (earningsData?.earnings) {
      DS.earnings = earningsData.earnings;
      dSetText('d-earn-today',  `₹${DS.earnings.today.amount.toFixed(0)}`);
      dSetText('d-rides-today', DS.earnings.today.trips);
    }

    if (perfData?.performance) {
      DS.performance = perfData.performance;
      dSetText('d-accept-rate', `${DS.performance.accept_rate}%`);
      dSetText('d-ontime-rate', `${DS.performance.on_time_rate}%`);
      dSetText('d-cancel-rate', `${DS.performance.cancel_rate}%`);
    }

    if (queueData?.queue) {
      DS.queueStatus = queueData.queue;
      dSetText('d-queue-status', DS.queueStatus.label);
      dSetText('d-queue-wait',   DS.queueStatus.waitStr);
      dSetText('d-queue-count',  `${DS.queueStatus.count} in queue`);
    }
  } catch (err) {
    console.error('initDHome:', err);
  }
}

let _bannerTimer = null;
function dShowIncomingBanner() {
  const banner = document.getElementById('d-incoming-banner');
  const cta    = document.getElementById('d-accept-cta');
  if (banner) banner.style.display = 'flex';
  if (cta)    cta.style.display    = 'none';

  let secs = DS.currentRequest?.timeoutSec || 30;
  dSetText('d-banner-timer', secs);
  clearInterval(_bannerTimer);
  _bannerTimer = setInterval(() => {
    secs--;
    const el = document.getElementById('d-banner-timer');
    if (el) el.textContent = secs;
    if (secs <= 0) {
      clearInterval(_bannerTimer);
      dHideBanner();
      DS.currentRequest = null;
    }
  }, 1000);
}

function dHideBanner() {
  const banner = document.getElementById('d-incoming-banner');
  const cta    = document.getElementById('d-accept-cta');
  if (banner) banner.style.display = 'none';
  if (cta)    cta.style.display    = '';
  clearInterval(_bannerTimer);
}

function handleAcceptCTA() {
  if (DS.currentRequest) {
    dNav('request');
  } else {
    dShowToast('Waiting for incoming rides...');
  }
}

// ─────────────────────────────────────────────────────────
// RIDE REQUEST
// ─────────────────────────────────────────────────────────
let _reqCountdown = null;
const RING_FULL = 213.6;

function initRideRequest() {
  const req = DS.currentRequest;
  if (!req) { dNav('home'); return; }

  dHideBanner();
  dSetText('d-pass-name',   req.passenger?.name   || 'Passenger');
  dSetText('d-pass-ava',    req.passenger?.initials || 'P');
  dSetText('d-pass-rides',  `· ${req.passenger?.rides || 0} rides`);
  dSetText('d-payout-val',  `₹${(req.payout||0).toFixed(2)}`);
  dSetText('d-req-pickup',  req.pickup);
  dSetText('d-req-dest',    req.destination);
  dSetText('d-req-eta',     req.eta || '–');
  dSetText('d-req-dist',    req.distance || '–');

  const ratingEl = document.getElementById('d-pass-rating');
  if (ratingEl) ratingEl.textContent = req.passenger?.rating || '5.0';

  clearInterval(_reqCountdown);
  let secs = req.timeoutSec || 30;
  dSetText('d-countdown-num', secs);
  setRingProgress(0);

  _reqCountdown = setInterval(() => {
    secs--;
    dSetText('d-countdown-num', secs);
    setRingProgress(1 - secs / (req.timeoutSec || 30));
    if (secs <= 0) {
      clearInterval(_reqCountdown);
      dShowToast('Request expired');
      DS.currentRequest = null;
      dNav('home');
    }
  }, 1000);
}

function setRingProgress(frac) {
  const ring = document.getElementById('d-ring-progress');
  if (ring) ring.style.strokeDashoffset = RING_FULL * frac;
}

async function acceptRide() {
  clearInterval(_reqCountdown);
  const req = DS.currentRequest;
  if (!req?.id) { dNav('home'); return; }

  try {
    const data = await dApi.post(`/driver/bookings/${req.id}/accept`);
    DS.currentTrip = { ...req, ...data.booking };
    dNav('tripdetail');
    dShowToast('Ride accepted!');
  } catch (err) {
    dShowToast('Failed to accept: ' + err.message);
  }
}

async function declineRide() {
  clearInterval(_reqCountdown);
  DS.currentRequest = null;
  dHideBanner();
  dShowToast('Ride declined');
  dNav('home');
}

// ─────────────────────────────────────────────────────────
// TRIP LIFECYCLE SCREENS
// ─────────────────────────────────────────────────────────
function initTripDetail() {
  const trip = DS.currentTrip;
  if (!trip) return;

  dSetText('d-td-name',    trip.customer_name  || trip.passenger?.name || 'Passenger');
  dSetText('d-td-ava',     (trip.customer_name || 'P').charAt(0).toUpperCase());
  dSetText('d-td-rating',  '★ 5.0');
  dSetText('d-td-pickup',  trip.pickup_address || trip.pickup);
  dSetText('d-td-dest',    trip.destination_address || trip.destination);
  dSetText('d-td-flight',  trip.flight_number  || trip.flight || '–');
  dSetText('d-td-terminal','–');
  dSetText('d-td-payout',  `₹${parseFloat(trip.total_fare || trip.payout || 0).toFixed(2)}`);

  if (trip.flight_number || trip.flight) {
    dApi.get(`/flights/${trip.flight_number || trip.flight}`).then(d => {
      if (d.flight) {
        dSetText('d-td-terminal', d.flight.terminal || '–');
        dSetText('d-td-arrives',  d.flight.actual_arrival
          ? new Date(d.flight.actual_arrival).toLocaleTimeString('en-IN',{timeStyle:'short'})
          : '–');
      }
    }).catch(() => {});
  }
}

async function dDrawRoute(mapInstance, origin, destination) {
  try {
    const data = await dApi.get(`/maps/directions?originLat=${origin.lat}&originLng=${origin.lng}&destLat=${destination.lat}&destLng=${destination.lng}`);
    mapInstance.drawRoute(data.polyline);
  } catch (err) {
    console.error('dDrawRoute error:', err);
  }
}

function initNavigating() {
  const trip = DS.currentTrip;
  if (!trip) return;

  dSetText('d-nav-name',   trip.customer_name || 'Passenger');
  dSetText('d-nav-ava',    (trip.customer_name || 'P').charAt(0).toUpperCase());
  dSetText('d-nav-addr',   (trip.pickup_address || '').split(',')[0]);
  dSetText('d-nav-status', 'Navigating to pickup…');

  dStartGPS();

  setTimeout(() => {
    const mapEl = document.getElementById('d-navigating-map');
    if (mapEl) {
      const pickup = { lat: +trip.pickup_lat, lng: +trip.pickup_lng };
      const driverPos = DS.driverLat ? { lat: DS.driverLat, lng: DS.driverLng } : { lat: 40.6420, lng: -73.7790 };

      const map = new AirrideMap('d-navigating-map', driverPos, 13, MAP_PROVIDER);
      _driverNavMap = map;

      map.addMarker(pickup, { label: 'P', title: 'Pickup Location' });
      
      dDrawRoute(map, driverPos, pickup);
      _driverNavMarker = map.addMarker(driverPos, { isDriver: true, title: 'Your Vehicle' });
    }
  }, 100);
}

async function markArrived() {
  if (!DS.currentTrip?.id) return;
  try {
    await dApi.post(`/driver/bookings/${DS.currentTrip.id}/arrive`);
    dNav('waiting');
  } catch (err) {
    dShowToast('Error: ' + err.message);
  }
}

function initWaiting() {
  const trip = DS.currentTrip;
  if (!trip) return;

  const flightNum = trip.flight_number || trip.flight;
  if (flightNum) {
    dApi.get(`/flights/${encodeURIComponent(flightNum)}`).then(d => {
      if (d.flight) {
        dSetText('d-ft-from',   d.flight.origin_airport      || '–');
        dSetText('d-ft-to',     d.flight.destination_airport || '–');
        dSetText('d-ft-num',    d.flight.flight_number       || flightNum);
        dSetText('d-ft-status', (d.flight.status || 'scheduled').toUpperCase());
      }
    }).catch(() => {
      dSetText('d-ft-from', '–');
      dSetText('d-ft-to',   '–');
      dSetText('d-ft-num',  flightNum);
    });
  }
}

async function passengerOnboard() {
  if (!DS.currentTrip?.id) return;
  try {
    await dApi.post(`/driver/bookings/${DS.currentTrip.id}/start`);
    dNav('activetrip');
  } catch (err) {
    dShowToast('Error: ' + err.message);
  }
}

let _tripInterval = null;
function initActiveTrip() {
  const trip = DS.currentTrip;
  if (!trip) return;

  dSetText('d-at-name',     trip.customer_name || 'Passenger');
  dSetText('d-at-ava',      (trip.customer_name || 'P').charAt(0).toUpperCase());
  dSetText('d-at-dest',     `→ ${(trip.destination_address || '').split(',')[0]}`);
  dSetText('d-trip-payout', `₹${parseFloat(trip.total_fare || trip.payout || 0).toFixed(2)}`);

  clearInterval(_tripInterval);
  let secs = (trip.estimated_duration_min || 25) * 60;
  const totalSecs = secs;

  updateActiveTripUI(secs, totalSecs, trip);
  _tripInterval = setInterval(() => {
    secs = Math.max(0, secs - 5);
    updateActiveTripUI(secs, totalSecs, trip);
    if (secs === 0) clearInterval(_tripInterval);
  }, 5000);

  setTimeout(() => {
    const mapEl = document.getElementById('d-activetrip-map');
    if (mapEl) {
      const pickup = { lat: +trip.pickup_lat, lng: +trip.pickup_lng };
      const dest = { lat: +trip.destination_lat, lng: +trip.destination_lng };
      const driverPos = DS.driverLat ? { lat: DS.driverLat, lng: DS.driverLng } : pickup;

      const map = new AirrideMap('d-activetrip-map', driverPos, 13, MAP_PROVIDER);
      _driverActiveMap = map;

      map.addMarker(dest, { label: 'D', title: 'Destination' });
      
      dDrawRoute(map, pickup, dest);
      _driverActiveMarker = map.addMarker(driverPos, { isDriver: true, title: 'Your Vehicle' });
    }
  }, 100);
}

function updateActiveTripUI(secs, totalSecs, trip) {
  const mins = Math.ceil(secs / 60);
  const pct  = Math.round(((totalSecs - secs) / totalSecs) * 100);
  const distEst = parseFloat(trip.estimated_distance_km || 0);
  const distRem = (distEst * (secs / totalSecs)).toFixed(1);

  dSetText('d-trip-eta',  `${mins} MIN`);
  dSetText('d-trip-dist', `${distRem} km`);
  dSetText('d-trip-dur',  `${Math.round((totalSecs - secs)/60)} min elapsed`);

  const fill = document.getElementById('d-trip-fill');
  if (fill) fill.style.width = `${pct}%`;
}

async function completeTrip() {
  if (!DS.currentTrip?.id) return;
  clearInterval(_tripInterval);

  try {
    dShowToast('Completing trip…');
    const data = await dApi.post(`/driver/bookings/${DS.currentTrip.id}/complete`);

    const earningsData = await dApi.get('/driver/earnings').catch(() => null);
    if (earningsData?.earnings) DS.earnings = earningsData.earnings;

    dNav('completion');
    initCompletion(data.booking);
    dStopGPS();
  } catch (err) {
    dShowToast('Error completing trip: ' + err.message);
  }
}

function initCompletion(booking) {
  const trip    = booking || DS.currentTrip;
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { dateStyle: 'medium' }) +
                  ' · ' + now.toLocaleTimeString('en-IN', { timeStyle: 'short' });

  dSetText('d-ts-id',     trip?.booking_ref || `Trip #${Date.now()}`);
  dSetText('d-ts-date',   dateStr);
  dSetText('d-ts-from',   (trip?.pickup_address      || '').split(',')[0]);
  dSetText('d-ts-to',     (trip?.destination_address || '').split(',')[0]);
  dSetText('d-ts-pass',   trip?.customer_name || 'Passenger');
  dSetText('d-ts-payout', `₹${parseFloat(trip?.total_fare || DS.currentTrip?.payout || 0).toFixed(2)}`);

  const stars = document.querySelectorAll('.d-star');
  stars.forEach((s, i) => {
    s.classList.remove('active');
    s.onclick = () => stars.forEach((st, j) => st.classList.toggle('active', j <= i));
  });

  DS.currentTrip    = null;
  DS.currentRequest = null;
}

function finishTrip() {
  DS.isOnline = true;
  dUpdateOnlineUI();
  dNav('home');
  setTimeout(initDHome, 100);
}

// ─────────────────────────────────────────────────────────
// TRIP HISTORY & PERFORMANCE
// ─────────────────────────────────────────────────────────
async function initDTrips() {
  await renderDTrips('all');
}

async function renderDTrips(filter) {
  const list = document.getElementById('d-trips-list');
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--g400);font-family:var(--mono);font-size:11px;">LOADING…</div>';

  try {
    const ep = filter === 'all' ? '/driver/bookings' : `/driver/bookings?status=${filter}`;
    const data = await dApi.get(ep);
    DS.tripHistory = data.bookings || [];

    if (!DS.tripHistory.length) {
      list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--g400);font-family:var(--mono);font-size:12px;">NO TRIPS FOUND</div>';
      return;
    }

    list.innerHTML = DS.tripHistory.map((b, idx) => {
      const date = new Date(b.scheduled_at).toLocaleDateString('en-IN', { dateStyle: 'medium' });
      const isComp = b.status === 'completed';
      const payout = parseFloat(b.net_payout || b.gross_fare || b.total_fare || 0);
      return `
        <div class="d-trip-card">
          <div class="d-tc-top">
            <div class="d-tc-date">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="#aaa" stroke-width="1.5"/><path d="M16 2v4M8 2v4M3 10h18" stroke="#aaa" stroke-width="1.5"/></svg>
              ${date}
            </div>
            <span class="d-tc-status ${isComp ? 'comp' : 'canc'}">${b.status.replace(/_/g,' ')}</span>
          </div>
          <p class="d-tc-name">${b.customer_name || 'Passenger'}</p>
          <div class="d-tc-route">
            <div class="d-tc-point"><div class="d-tc-dot blk"></div><span class="d-tc-addr">${(b.pickup_address||'').split(',')[0]}</span></div>
            <div class="d-tc-line"></div>
            <div class="d-tc-point"><div class="d-tc-dot wht"></div><span class="d-tc-addr">${(b.destination_address||'').split(',')[0]}</span></div>
          </div>
          <div class="d-tc-bottom">
            <div class="d-tc-fare">₹${payout.toFixed(2)}</div>
            <span class="d-tc-tripnum">${b.booking_ref || `#${idx+1}`}</span>
          </div>
        </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = '<div style="text-align:center;padding:40px;color:#ef4444;font-size:12px;">Failed to load trips</div>';
    console.error('renderDTrips:', err);
  }
}

function filterDTrips(filter, btn) {
  document.querySelectorAll('.d-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderDTrips(filter);
}

// ─────────────────────────────────────────────────────────
// EARNINGS
// ─────────────────────────────────────────────────────────
async function initEarnings() {
  try {
    const [earningsData, historyData] = await Promise.all([
      dApi.get('/driver/earnings').catch(() => null),
      dApi.get('/driver/earnings/history?limit=10').catch(() => null),
    ]);

    if (earningsData?.earnings) {
      DS.earnings = earningsData.earnings;
      dSetText('d-ec-today',  `₹${DS.earnings.today.amount.toFixed(0)}`);
      dSetText('d-ec-week',   `₹${DS.earnings.week.amount.toFixed(0)}`);
      dSetText('d-ec-month',  `₹${DS.earnings.month.amount.toFixed(0)}`);
      dSetText('d-te-total',  `₹${DS.earnings.total.amount.toFixed(2)}`);
    }

    if (historyData?.history) renderPayouts(historyData.history);
  } catch (err) {
    console.error('initEarnings:', err);
  }
}

function renderPayouts(history) {
  const list = document.getElementById('d-payout-list');
  if (!list) return;
  if (!history.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--g400);font-size:12px;">No payout history yet</div>';
    return;
  }
  list.innerHTML = history.map(p => {
    const date = new Date(p.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' });
    return `
      <div class="d-payout-item">
        <div class="d-payout-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="2" stroke="#555" stroke-width="1.5"/><path d="M2 10h20" stroke="#555" stroke-width="1.5"/><rect x="5" y="14" width="4" height="2" rx="1" fill="#555"/></svg>
        </div>
        <div class="d-payout-info">
          <p class="d-payout-date">${date}</p>
          <p class="d-payout-sub">${p.booking_ref || '–'}</p>
        </div>
        <p class="d-payout-amount">₹${parseFloat(p.net_payout||0).toFixed(2)}</p>
      </div>`;
  }).join('');
}

// ─────────────────────────────────────────────────────────
// PROFILE & LOGOUT
// ─────────────────────────────────────────────────────────
async function initProfile() {
  try {
    const data = await dApi.get('/driver/profile');
    if (data.driver) {
      DS.driver = data.driver;
      dUpdateProfileUI(data.driver);
    }
  } catch (err) {
    console.error('initProfile:', err);
  }
}

function dUpdateProfileUI(driver) {
  if (!driver) return;
  const initials = (driver.full_name || 'D').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  dSetText('d-profile-name',    driver.full_name    || 'Driver');
  dSetText('d-profile-ava',     initials);
  dSetText('d-pf-phone',        driver.phone_number || '–');
  dSetText('d-pf-email',        driver.email        || '–');
  dSetText('d-pf-vehicle',      `${driver.color||''} ${driver.make||''} ${driver.model||''}`.trim() || '–');
  dSetText('d-pf-plate',        driver.license_plate || '–');
  dSetText('d-greeting-name',   (driver.full_name || 'Driver').split(' ')[0]);
}

async function dLogout() {
  if (!confirm('Log out of AIRRIDE Driver App?')) return;
  try {
    DS.isOnline = false;
    dStopGPS();
    clearInterval(_tripInterval);
    clearInterval(_reqCountdown);
    clearInterval(_bannerTimer);
    _socket?.disconnect();
    _supaChannel?.unsubscribe();
    if (window.firebase) await firebase.auth().signOut();
    dNav('splash');
    setTimeout(() => dNav('login'), 3000);
  } catch (err) {
    console.error('dLogout:', err);
  }
}

function callPassenger() {
  const phone = DS.currentTrip?.customer_phone;
  if (phone) window.location.href = `tel:${phone}`;
  else dShowToast('No phone number available');
}

function msgPassenger() {
  const phone = DS.currentTrip?.customer_phone;
  if (phone) window.location.href = `sms:${phone}`;
  else dShowToast('No phone number available');
}

// ─────────────────────────────────────────────────────────
// NAVIGATION / SCREEN ROUTING
// ─────────────────────────────────────────────────────────
const SCREEN_LABELS = {
  splash:'Splash · 1/13', login:'Login · 2/13', otp:'OTP · 3/13',
  home:'Dashboard · 4/13', request:'Ride Request · 5/13', tripdetail:'Trip Detail · 6/13',
  navigating:'Navigating · 7/13', waiting:'Airport Pickup · 8/13', activetrip:'Active Trip · 9/13',
  completion:'Completed · 10/13', trips:'My Trips · 11/13',
  earnings:'Earnings · 12/13', profile:'Profile · 13/13',
};

const SCREEN_HOOKS = {
  otp:        initDOTPScreen,
  home:       initDHome,
  request:    initRideRequest,
  tripdetail: initTripDetail,
  navigating: initNavigating,
  waiting:    initWaiting,
  activetrip: initActiveTrip,
  completion: () => initCompletion(null),
  trips:      initDTrips,
  earnings:   initEarnings,
  profile:    initProfile,
};

function dNav(screen) {
  if (screen === DS.currentScreen) return;
  const prev = document.getElementById(`ds-${DS.currentScreen}`);
  const next = document.getElementById(`ds-${screen}`);
  if (!next) return;

  prev?.classList.remove('active');
  prev?.classList.add('exit');
  setTimeout(() => prev?.classList.remove('exit'), 380);
  void next.offsetWidth;
  next.classList.add('active');
  DS.currentScreen = screen;

  dUpdateStatusBar(screen);
  dUpdateNavDots(screen);
  dUpdateGreeting();

  const lbl = document.getElementById('d-nav-label');
  if (lbl) lbl.textContent = SCREEN_LABELS[screen] || screen;

  if (SCREEN_HOOKS[screen]) SCREEN_HOOKS[screen]();
}

// Expose handlers globally
window.dNav = dNav;
window.toggleOnlineStatus = toggleOnlineStatus;
window.handleAcceptCTA = handleAcceptCTA;
window.declineRide = declineRide;
window.acceptRide = acceptRide;
window.callPassenger = callPassenger;
window.msgPassenger = msgPassenger;
window.startNavigation = () => dNav('navigating');
window.markArrived = markArrived;
window.passengerOnboard = passengerOnboard;
window.completeTrip = completeTrip;
window.finishTrip = finishTrip;
window.filterTrips = filterDTrips;
window.dLogout = dLogout;

// ─────────────────────────────────────────────────────────
// OTP CELLS
// ─────────────────────────────────────────────────────────
let _dotpTimer = null, _dotpSecs = 42;

function initDOTPScreen() {
  const cells = document.querySelectorAll('.d-otp-cell');
  cells.forEach((cell, i) => {
    cell.value = '';
    cell.classList.remove('filled');
    cell.addEventListener('input', e => {
      const v = e.target.value.replace(/\D/g,'');
      cell.value = v.slice(0,1);
      cell.classList.toggle('filled', !!v);
      if (v && i < cells.length-1) cells[i+1].focus();
    });
    cell.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !cell.value && i > 0) {
        cells[i-1].value = ''; cells[i-1].classList.remove('filled'); cells[i-1].focus();
      }
    });
    cell.addEventListener('paste', e => {
      e.preventDefault();
      const txt = e.clipboardData.getData('text').replace(/\D/g,'').slice(0,6);
      txt.split('').forEach((c,j) => { if(cells[j]) { cells[j].value=c; cells[j].classList.add('filled'); } });
      const nxt = cells[Math.min(txt.length, cells.length-1)];
      if (nxt) nxt.focus();
    });
  });

  clearInterval(_dotpTimer);
  _dotpSecs = 42;
  const resendBtn = document.getElementById('d-resend-btn');
  if (resendBtn) { resendBtn.disabled = true; resendBtn.style.opacity = '0.5'; }

  _dotpTimer = setInterval(() => {
    _dotpSecs--;
    const el = document.getElementById('d-otp-timer');
    if (el) el.textContent = `${Math.floor(_dotpSecs/60)}:${(_dotpSecs%60).toString().padStart(2,'0')}`;
    if (_dotpSecs <= 0) {
      clearInterval(_dotpTimer);
      if (resendBtn) { resendBtn.disabled = false; resendBtn.style.opacity = '1'; }
    }
  }, 1000);

  const verifyBtn = document.getElementById('d-verify-btn');
  if (verifyBtn) verifyBtn.onclick = dVerifyOTP;
  if (cells[0]) setTimeout(() => cells[0].focus(), 200);
}

// ─────────────────────────────────────────────────────────
// STATUS BAR + NAV DOTS
// ─────────────────────────────────────────────────────────
function dUpdateStatusBar(screen) {
  const bar = document.getElementById('d-status-bar');
  if (!bar) return;
  const dark = ['splash','login'].includes(screen);
  bar.style.color      = dark ? '#fff' : '#0a0a0a';
  bar.style.background = dark ? 'transparent' : '#ffffff';
}

function dUpdateNavDots(screen) {
  document.querySelectorAll('.d-ndot').forEach((d, i) => {
    d.classList.toggle('active', SCREEN_ORDER[i] === screen);
  });
}

// ─────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────
function dUpdateClock() {
  const el = document.getElementById('d-status-time');
  if (!el) return;
  const n = new Date();
  const h = n.getHours() % 12 || 12;
  el.textContent = `${h}:${n.getMinutes().toString().padStart(2,'0')}`;
}
setInterval(dUpdateClock, 1000);
dUpdateClock();

function dUpdateGreeting() {
  const el = document.getElementById('d-greeting');
  if (!el) return;
  const h = new Date().getHours();
  el.textContent = h < 12 ? 'GOOD MORNING,' : h < 17 ? 'GOOD AFTERNOON,' : 'GOOD EVENING,';
}

function dSetText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '';
}

function dShakeEl(el) {
  if (!el) return;
  el.style.animation = 'none'; void el.offsetWidth;
  el.style.animation = 'dShake .4s ease';
  el.style.borderColor = '#ef4444';
  setTimeout(() => { el.style.borderColor = ''; el.style.animation = ''; }, 800);
}

let _toastTimer;
function dShowToast(msg) {
  let toast = document.getElementById('d-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'd-toast';
    toast.style.cssText = 'position:fixed;bottom:140px;left:50%;transform:translateX(-50%);background:#0a0a0a;color:#fff;padding:10px 20px;border-radius:24px;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.08em;white-space:nowrap;z-index:9999;opacity:0;transition:opacity .3s;max-width:340px;text-align:center;line-height:1.4;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => toast.style.opacity = '0', 2800);
}

const style = document.createElement('style');
style.textContent = '@keyframes dShake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-6px)}40%,80%{transform:translateX(6px)}}';
document.head.appendChild(style);

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  dUpdateStatusBar('splash');
  dUpdateNavDots('splash');
  dUpdateGreeting();
  dInitFirebaseAuth();

  const sendOTPBtn = document.getElementById('d-send-otp-btn');
  if (sendOTPBtn) sendOTPBtn.addEventListener('click', dSendOTP);

  const phoneInp = document.getElementById('d-phone-input');
  if (phoneInp) phoneInp.addEventListener('keydown', e => { if (e.key === 'Enter') dSendOTP(); });

  setTimeout(() => {
    if (DS.currentScreen === 'splash') {
      if (window.firebase && firebase.auth().currentUser) {
        dNav('home');
      } else {
        dNav('login');
      }
    }
  }, 3500);
});
