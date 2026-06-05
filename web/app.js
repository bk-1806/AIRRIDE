/**
 * AIRRIDE Customer App – Unified API & Maps Integration Layer
 * Supports both OpenStreetMap (Leaflet/OSRM/Nominatim) and Google Maps.
 */
'use strict';

// ─────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────
const API_BASE   = window.AIRRIDE_CONFIG?.API_BASE   || 'http://localhost:3000/api';
const WS_URL     = window.AIRRIDE_CONFIG?.WS_URL     || 'http://localhost:3000';
// Supabase Realtime removed — all real-time updates flow through Socket.IO
const GMAPS_KEY  = window.AIRRIDE_CONFIG?.GOOGLE_MAPS_KEY || '';
const MAP_PROVIDER = window.AIRRIDE_CONFIG?.MAP_PROVIDER || 'osm';

// ─────────────────────────────────────────────────────────
// AUTH & APP STATE
// ─────────────────────────────────────────────────────────
let _firebaseUser = null;
let _idToken      = null;
let _socket       = null;
// _supaChannel removed — Socket.IO handles all real-time subscriptions

const STATE = {
  currentScreen: 'splash',
  currentBooking: null,
  user: null,
  bookings: [],
  fareOptions: [],
  selectedFare: null,
  map: null,
  driverMarker: null,
  pickupMarker: null,
  destMarker: null,
  pickupCoords: null,
  destCoords:   null,
  scheduledAt:  null,
  flightNumber: null,
};
window.STATE = STATE;

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
// CLIENT-SIDE NOMINATIM SUGGEST DROPDOWN
// ─────────────────────────────────────────────────────────
function setupOsmAutocomplete(inputId, onSelect) {
  const inp = document.getElementById(inputId);
  if (!inp) return;

  const parent = inp.parentElement;
  if (!parent) return;

  if (window.getComputedStyle(parent).position === 'static') {
    parent.style.position = 'relative';
  }

  let dropdown = document.createElement('div');
  dropdown.style.cssText = `
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: #ffffff;
    border: 1px solid #e0e0e0;
    border-radius: 12px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.08);
    z-index: 9999;
    max-height: 220px;
    overflow-y: auto;
    margin-top: 4px;
    padding: 6px 0;
  `;
  dropdown.style.display = 'none';
  parent.appendChild(dropdown);

  let debounceTimer;
  inp.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearTimeout(debounceTimer);
    if (val.length < 3) {
      dropdown.style.display = 'none';
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5`;
        const res = await fetch(url, {
          headers: { 'User-Agent': 'AIRRIDE-App/1.0 (bhavankothalanka@projectwebsite.com)' }
        });
        const data = await res.json();
        
        dropdown.innerHTML = '';
        if (data.length === 0) {
          dropdown.style.display = 'none';
          return;
        }

        data.forEach(item => {
          const div = document.createElement('div');
          div.style.cssText = `
            padding: 10px 16px;
            font-family: inherit;
            font-size: 13px;
            color: #1a1a1a;
            cursor: pointer;
            border-bottom: 1px solid #f5f5f5;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            transition: background 0.15s;
          `;
          div.textContent = item.display_name;
          
          div.onmouseenter = () => div.style.background = '#f5f5f5';
          div.onmouseleave = () => div.style.background = 'transparent';
          
          div.onclick = () => {
            inp.value = item.display_name;
            dropdown.style.display = 'none';
            onSelect({
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
              address: item.display_name
            });
          };
          dropdown.appendChild(div);
        });
        dropdown.style.display = 'block';
      } catch (err) {
        console.error('Autocomplete error:', err);
      }
    }, 400);
  });

  document.addEventListener('click', (e) => {
    if (e.target !== inp && !dropdown.contains(e.target)) {
      dropdown.style.display = 'none';
    }
  });
}

// ─────────────────────────────────────────────────────────
// HTTP HELPER
// ─────────────────────────────────────────────────────────
async function apiRequest(method, endpoint, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (_idToken) headers['Authorization'] = `Bearer ${_idToken}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json();

  if (!res.ok) throw new Error(data.message || `API error ${res.status}`);
  return data;
}

const api = {
  get:    (ep)           => apiRequest('GET',    ep),
  post:   (ep, body)     => apiRequest('POST',   ep, body),
  put:    (ep, body)     => apiRequest('PUT',    ep, body),
  patch:  (ep, body)     => apiRequest('PATCH',  ep, body),
  delete: (ep)           => apiRequest('DELETE', ep),
};

// ─────────────────────────────────────────────────────────
// FIREBASE AUTH (phone OTP)
// ─────────────────────────────────────────────────────────
let _recaptchaVerifier = null;
let _confirmationResult = null;

function initFirebaseAuth() {
  if (!window.firebase) { console.warn('Firebase SDK not loaded'); return; }

  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      _firebaseUser = user;
      _idToken = await user.getIdToken();
      setInterval(async () => { _idToken = await user.getIdToken(true); }, 50 * 60 * 1000);
      await registerUserProfile();
      initSocketIO();
    } else {
      _firebaseUser = null;
      _idToken      = null;
      _socket?.disconnect();
    }
  });
}

async function sendPhoneOTP(phoneNumber) {
  if (!window.firebase) throw new Error('Firebase not loaded');

  _recaptchaVerifier = _recaptchaVerifier || new firebase.auth.RecaptchaVerifier(
    'recaptcha-container',
    { size: 'invisible', callback: () => {} }
  );

  _confirmationResult = await firebase.auth().signInWithPhoneNumber(
    phoneNumber,
    _recaptchaVerifier
  );
}

async function verifyPhoneOTP(code) {
  if (!_confirmationResult) throw new Error('No pending OTP – call sendPhoneOTP first');
  const result = await _confirmationResult.confirm(code);
  _firebaseUser = result.user;
  _idToken      = await result.user.getIdToken();
  return result.user;
}

async function handleSendOTP() {
  const phoneInp = document.getElementById('login-phone');
  const phone = phoneInp?.value?.trim().replace(/\D/g, '');
  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number');
    return;
  }

  const formatted = `+91${phone}`;
  STATE.pendingPhone = formatted;

  try {
    showToast('Sending OTP…');
    await sendPhoneOTP(formatted);
    const displayPhone = document.getElementById('otp-display-phone');
    if (displayPhone) displayPhone.textContent = formatted;
    navigateTo('otp');
  } catch (err) {
    showToast('Failed to send OTP: ' + err.message);
    console.error(err);
  }
}

async function handleVerifyOTP() {
  const cells = document.querySelectorAll('.otp-cell');
  const code = Array.from(cells).map(c => c.value).join('');
  if (code.length < 6) {
    showToast('Please enter the 6-digit OTP');
    return;
  }

  try {
    showToast('Verifying…');
    await verifyPhoneOTP(code);
    await registerUserProfile();
    initSocketIO();
    showToast('Logged in successfully!');
    navigateTo('home');
  } catch (err) {
    showToast('Invalid OTP – please try again');
    console.error(err);
  }
}

async function registerUserProfile() {
  try {
    const fcmToken = await getFCMToken();
    const data = await api.post('/auth/verify', {
      fullName: _firebaseUser.displayName || null,
      fcmToken,
    });
    STATE.user = data.user;
    updateProfileUI(STATE.user);
    return data.user;
  } catch (err) {
    console.error('registerUserProfile:', err.message);
  }
}

// ─────────────────────────────────────────────────────────
// FCM (Firebase Cloud Messaging)
// ─────────────────────────────────────────────────────────
async function getFCMToken() {
  try {
    if (!window.firebase?.messaging) return null;
    const messaging = firebase.messaging();
    return await messaging.getToken({ vapidKey: window.AIRRIDE_CONFIG?.FCM_VAPID_KEY });
  } catch {
    return null;
  }
}

function setupFCMMessageHandler() {
  if (!window.firebase?.messaging) return;
  const messaging = firebase.messaging();
  messaging.onMessage((payload) => {
    const { title, body } = payload.notification || {};
    const { type, bookingId } = payload.data || {};
    showToast(`${title}: ${body}`);

    const refreshTypes = ['driver_accepted','driver_arrived','trip_completed','ride_cancelled'];
    if (refreshTypes.includes(type) && bookingId) {
      refreshBooking(bookingId);
    }
  });
}

// ─────────────────────────────────────────────────────────
// SOCKET.IO (real-time GPS tracking)
// ─────────────────────────────────────────────────────────
function initSocketIO() {
  if (!window.io) { console.warn('Socket.IO not loaded'); return; }
  if (_socket?.connected) return;

  _socket = io(WS_URL, {
    auth: { token: _idToken },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  _socket.on('connect', () => {
    console.log('🔌 Socket connected:', _socket.id);
    if (STATE.currentBooking?.id) {
      _socket.emit('join_booking_room', { bookingId: STATE.currentBooking.id });
    }
  });

  _socket.on('driver_location_update', ({ lat, lng }) => {
    updateDriverMarker(lat, lng);
  });

  _socket.on('booking_status_update', ({ status, booking }) => {
    handleBookingStatusChange(status, booking);
  });

  _socket.on('ride_cancelled', () => {
    showToast('Your ride has been cancelled');
    navigateTo('home');
  });

  _socket.on('disconnect', () => console.log('🔌 Socket disconnected'));
}

function joinBookingRoom(bookingId) {
  _socket?.emit('join_booking_room', { bookingId });
}

// ─────────────────────────────────────────────────────────
// BOOKING ROOM — Socket.IO only (Supabase Realtime removed)
// All booking_status_update and driver_location_update events
// arrive via the authenticated Socket.IO connection.
// ─────────────────────────────────────────────────────────
function subscribeToBookingUpdates(bookingId) {
  // Delegate entirely to Socket.IO: join the booking room so
  // the backend can push booking_status_update events to this client.
  joinBookingRoom(bookingId);
}

function unsubscribeBookingUpdates() {
  // Leave booking room on the server side.
  // Socket.IO connection itself stays alive for the session.
  if (_socket?.connected && STATE.currentBooking?.id) {
    _socket.emit('leave_booking_room', { bookingId: STATE.currentBooking.id });
  }
}

// ─────────────────────────────────────────────────────────
// BOOKING STATUS HANDLER
// ─────────────────────────────────────────────────────────
const STATUS_MESSAGES = {
  driver_assigned:  { icon: '🚗', title: 'Driver Found!',       body: 'Your driver is on the way.' },
  driver_accepted:  { icon: '✅', title: 'Driver Confirmed!',    body: 'Your driver accepted the ride.' },
  driver_arrived:   { icon: '📍', title: 'Driver Arrived!',      body: 'Your driver is at the pickup point.' },
  in_progress:      { icon: '🛣️',  title: 'Trip Started!',        body: 'You are on your way.' },
  completed:        { icon: '🎉', title: 'Trip Completed!',      body: 'Hope you enjoyed the ride!' },
  cancelled:        { icon: '❌', title: 'Booking Cancelled',    body: 'Your booking was cancelled.' },
};

function handleBookingStatusChange(status, booking) {
  STATE.currentBooking = { ...STATE.currentBooking, ...booking, status };

  const msg = STATUS_MESSAGES[status];
  if (msg) showToast(`${msg.icon} ${msg.title} – ${msg.body}`);

  const screenMap = {
    driver_assigned:  'tracking',
    driver_accepted:  'tracking',
    driver_arrived:   'tracking',
    in_progress:      'tracking',
    completed:        'rating',
    cancelled:        'home',
  };
  const target = screenMap[status];
  if (target) {
    if (STATE.currentScreen !== target) navigateTo(target);
    updateTrackingUI(STATE.currentBooking, status);
  }
}

// ─────────────────────────────────────────────────────────
// ROUTE & LOCATION MAP DRAW
// ─────────────────────────────────────────────────────────
async function drawRouteOnMap(mapInstance, pickup, dest) {
  try {
    const data = await api.get(`/maps/directions?originLat=${pickup.lat}&originLng=${pickup.lng}&destLat=${dest.lat}&destLng=${dest.lng}`);
    mapInstance.drawRoute(data.polyline);
  } catch (err) {
    console.error('Failed to draw route:', err);
  }
}

function updateDriverMarker(lat, lng) {
  if (!STATE.map) return;
  const pos = { lat: +lat, lng: +lng };
  if (STATE.driverMarker) {
    STATE.driverMarker.setPosition(pos);
  } else {
    STATE.driverMarker = STATE.map.addMarker(pos, { isDriver: true, title: 'Your Driver' });
  }
  STATE.map.panTo(pos);
}

async function geocodeAndSetMarker(address, type) {
  try {
    const data = await api.get(`/maps/geocode?address=${encodeURIComponent(address)}`);
    const pos  = { lat: data.lat, lng: data.lng };

    if (type === 'pickup') {
      STATE.pickupCoords = pos;
      if (STATE.pickupMarker) STATE.pickupMarker.setPosition(pos);
      else STATE.pickupMarker = STATE.map?.addMarker(pos, { label: 'P', title: 'Pickup' });
    } else {
      STATE.destCoords = pos;
      if (STATE.destMarker) STATE.destMarker.setPosition(pos);
      else STATE.destMarker = STATE.map?.addMarker(pos, { label: 'D', title: 'Destination' });
    }

    STATE.map?.panTo(pos);
    return data;
  } catch (err) {
    showToast(`Could not locate: ${address}`);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────
// FARE CALCULATION
// ─────────────────────────────────────────────────────────
async function loadFareOptions(pickupLat, pickupLng, destLat, destLng, scheduledAt) {
  try {
    showLoadingOverlay('Calculating fares…');
    const params = new URLSearchParams({ pickupLat, pickupLng, destLat, destLng, scheduledAt }).toString();
    const data = await api.get(`/fare/calculate?${params}`);
    STATE.fareOptions   = data.fares;
    STATE.fareDistance  = data.distanceKm;
    STATE.fareDuration  = data.estimatedDurationMin;
    renderFareOptions(data);
    return data;
  } catch (err) {
    showToast('Failed to calculate fare: ' + err.message);
    throw err;
  } finally {
    hideLoadingOverlay();
  }
}

function renderFareOptions(data) {
  const container = document.getElementById('fare-options-list');
  if (!container) return;

  container.innerHTML = data.fares.map((f, i) => `
    <div class="fare-card ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="selectFare(${i})">
      <div class="fare-type">${f.vehicleType}</div>
      <div class="fare-capacity">${f.capacity} seats</div>
      <div class="fare-amount">₹${f.totalFare.toLocaleString()}</div>
      <div class="fare-desc">${f.description}</div>
      ${f.nightSurcharge > 0 ? `<span class="night-badge">Night +₹${f.nightSurcharge}</span>` : ''}
    </div>
  `).join('');

  selectFare(0);
}

function selectFare(index) {
  STATE.selectedFare = STATE.fareOptions[index];
  document.querySelectorAll('.fare-card').forEach((c, i) => {
    c.classList.toggle('active', i === index);
  });
  const btn = document.getElementById('confirm-booking-btn');
  if (btn) btn.textContent = `Book for ₹${STATE.selectedFare.totalFare.toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────
// BOOKING CREATION
// ─────────────────────────────────────────────────────────
async function createBooking() {
  if (!STATE.selectedFare) { showToast('Please select a vehicle type'); return; }
  if (!STATE.pickupCoords || !STATE.destCoords) { showToast('Please set pickup and destination'); return; }

  const pickupInput = document.getElementById('pickup-search')?.value || '';
  const destInput   = document.getElementById('dest-search')?.value   || '';

  try {
    showLoadingOverlay('Placing your booking…');

    const payload = {
      vehicleType:          STATE.selectedFare.vehicleKey,
      pickupAddress:        pickupInput,
      pickupLat:            STATE.pickupCoords.lat,
      pickupLng:            STATE.pickupCoords.lng,
      destinationAddress:   destInput,
      destinationLat:       STATE.destCoords.lat,
      destinationLng:       STATE.destCoords.lng,
      scheduledAt:          STATE.scheduledAt || new Date().toISOString(),
      flightNumber:         STATE.flightNumber || null,
      estimatedDistanceKm:  STATE.fareDistance,
      estimatedDurationMin: STATE.fareDuration,
      baseFare:             STATE.selectedFare.baseFare,
      distanceFare:         STATE.selectedFare.distanceFare,
      airportSurcharge:     STATE.selectedFare.airportSurcharge,
      totalFare:            STATE.selectedFare.totalFare,
      paymentMethod:        document.getElementById('payment-method')?.value || 'cash',
    };

    const data = await api.post('/bookings', payload);
    STATE.currentBooking = data.booking;

    joinBookingRoom(data.booking.id);
    subscribeToBookingUpdates(data.booking.id);

    hideLoadingOverlay();
    navigateTo('confirmed');
    renderBookingConfirmed(data.booking);

  } catch (err) {
    hideLoadingOverlay();
    showToast('Booking failed: ' + err.message);
  }
}

function renderBookingConfirmed(booking) {
  setTextById('booking-id', booking.booking_ref);
  setTextById('cd-pickup',  booking.pickup_address);
  setTextById('cd-dest',    booking.destination_address);
  setTextById('cd-time',    new Date(booking.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }));
  setTextById('cd-vehicle', `${booking.vehicle_type.toUpperCase()} · ₹${parseFloat(booking.total_fare).toLocaleString()}`);

  const card = document.getElementById('driver-card');
  if (card) card.style.display = 'none'; // hide until assigned
}

// ─────────────────────────────────────────────────────────
// TRACKING SHEET UI
// ─────────────────────────────────────────────────────────
function updateTrackingUI(booking, status) {
  const statusLabels = {
    driver_assigned:  'Finding your driver…',
    driver_accepted:  'Driver is on the way',
    driver_arrived:   'Driver arrived at pickup',
    in_progress:      'Trip in progress',
    completed:        'Trip completed',
  };
  setTextById('track-status', statusLabels[status] || status.replace(/_/g, ' '));
  setTextById('track-pickup', booking.pickup_address);
  setTextById('track-dest',   booking.destination_address);

  if (booking.driver_name) {
    setTextById('track-name', booking.driver_name);
    setTextById('track-rating', booking.driver_rating ? `★ ${booking.driver_rating}` : '★ 5.0');
    setTextById('track-plate', booking.license_plate || '');
    setTextById('track-car', `${booking.color || ''} ${booking.make || ''} ${booking.model || ''}`.trim() || 'Vehicle');

    const initials = booking.driver_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    setTextById('track-ava', initials);
  }
}

// ─────────────────────────────────────────────────────────
// TRIP HISTORY & PROFILE
// ─────────────────────────────────────────────────────────
async function loadBookingHistory() {
  try {
    const data = await api.get('/bookings');
    STATE.bookings = data.bookings;
    renderBookingHistory(data.bookings);
  } catch (err) {
    showToast('Failed to load bookings: ' + err.message);
  }
}

function renderBookingHistory(bookings) {
  const list = document.getElementById('bookings-list');
  if (!list) return;

  if (!bookings.length) {
    list.innerHTML = '<div class="empty-state">No bookings yet</div>';
    return;
  }

  list.innerHTML = bookings.map(b => {
    const date = new Date(b.scheduled_at).toLocaleDateString('en-IN', { dateStyle: 'medium' });
    const statusClass = b.status === 'completed' ? 'status-complete' : b.status === 'cancelled' ? 'status-cancel' : 'status-active';
    return `
      <div class="booking-card" onclick="viewBookingDetail('${b.id}')">
        <div class="bc-top">
          <span class="bc-ref">${b.booking_ref}</span>
          <span class="bc-status ${statusClass}">${b.status.replace(/_/g,' ')}</span>
        </div>
        <div class="bc-date">${date}</div>
        <div class="bc-route">
          <span class="bc-from">${b.pickup_address.split(',')[0]}</span>
          <span class="bc-arrow">→</span>
          <span class="bc-to">${b.destination_address.split(',')[0]}</span>
        </div>
        <div class="bc-fare">₹${parseFloat(b.total_fare || 0).toLocaleString()}</div>
      </div>`;
  }).join('');
}

async function viewBookingDetail(bookingId) {
  try {
    const data = await api.get(`/bookings/${bookingId}`);
    STATE.currentBooking = data.booking;
    navigateTo('booking-detail');
    renderBookingDetail(data.booking);
  } catch (err) {
    showToast('Failed to load booking: ' + err.message);
  }
}

function renderBookingDetail(b) {
  setTextById('detail-ref',     b.booking_ref);
  setTextById('detail-status',  b.status.replace(/_/g,' '));
  setTextById('detail-pickup',  b.pickup_address);
  setTextById('detail-dest',    b.destination_address);
  setTextById('detail-fare',    `₹${parseFloat(b.total_fare||0).toLocaleString()}`);
  setTextById('detail-vehicle', b.vehicle_type);
  setTextById('detail-driver',  b.driver_name || 'Not assigned');
  setTextById('detail-plate',   b.license_plate || '–');
}

async function refreshBooking(bookingId) {
  try {
    const data = await api.get(`/bookings/${bookingId}`);
    STATE.currentBooking = data.booking;
    updateTrackingUI(data.booking, data.booking.status);
  } catch { /* silent */ }
}

async function cancelCurrentBooking() {
  if (!STATE.currentBooking?.id) return;
  if (!confirm('Cancel this booking?')) return;
  try {
    await api.put(`/bookings/${STATE.currentBooking.id}/cancel`);
    unsubscribeBookingUpdates();
    showToast('Booking cancelled');
    navigateTo('home');
  } catch (err) {
    showToast('Cannot cancel: ' + err.message);
  }
}

async function submitDriverRating(score, comment = '') {
  if (!STATE.currentBooking?.id) return;
  try {
    await api.post(`/bookings/${STATE.currentBooking.id}/rate`, { score, comment });
    showToast('Rating submitted – thank you!');
    navigateTo('home');
  } catch (err) {
    showToast('Rating failed: ' + err.message);
  }
}

async function loadUserProfile() {
  try {
    const data = await api.get('/auth/profile');
    STATE.user = data.user;
    updateProfileUI(data.user);
  } catch (err) {
    console.error('loadUserProfile:', err.message);
  }
}

function updateProfileUI(user) {
  if (!user) return;
  setTextById('profile-name',    user.full_name || 'Guest');
  setTextById('profile-phone',   user.phone_number || '');
  setTextById('profile-email',   user.email || '');
  const initials = (user.full_name || 'G').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  setTextById('profile-initials', initials);
}

async function logout() {
  if (!confirm('Log out?')) return;
  try {
    unsubscribeBookingUpdates();
    _socket?.disconnect();
    if (window.firebase) await firebase.auth().signOut();
    STATE.user = null;
    STATE.currentBooking = null;
    navigateTo('splash');
    setTimeout(() => navigateTo('login'), 2500);
  } catch (err) {
    console.error('logout:', err);
  }
}

async function lookupFlight(flightNumber) {
  try {
    const data = await api.get(`/flights/${encodeURIComponent(flightNumber)}`);
    STATE.flightNumber = flightNumber;
    if (data.flight) {
      setTextById('flight-status-display', data.flight.status || 'Unknown');
      setTextById('flight-terminal-display', data.flight.terminal || '–');
      setTextById('flight-arrival-display', data.flight.actual_arrival
        ? new Date(data.flight.actual_arrival).toLocaleTimeString('en-IN',{timeStyle:'short'})
        : data.flight.scheduled_arrival
          ? new Date(data.flight.scheduled_arrival).toLocaleTimeString('en-IN',{timeStyle:'short'})
          : '–');
    }
    return data.flight;
  } catch (err) {
    showToast('Flight lookup failed: ' + err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────
// COMPLEMENTARY UI WORKFLOW HANDLERS (EXCEPT AUTOCOMPLETE)
// ─────────────────────────────────────────────────────────
async function selectDestination(address, code) {
  try {
    showLoadingOverlay('Selecting location…');
    let coords;
    if (code === 'JFK') {
      coords = { lat: 40.6413, lng: -73.7781 };
    } else if (code === 'LGA') {
      coords = { lat: 40.7769, lng: -73.8740 };
    } else if (code === 'EWR') {
      coords = { lat: 40.6895, lng: -74.1745 };
    } else {
      const data = await api.get(`/maps/geocode?address=${encodeURIComponent(address)}`);
      coords = { lat: data.lat, lng: data.lng };
    }
    STATE.destCoords = coords;
    const destInp = document.getElementById('dest-search');
    if (destInp) destInp.value = address;
    navigateTo('datetime');
  } catch (err) {
    showToast('Selection failed: ' + err.message);
  } finally {
    hideLoadingOverlay();
  }
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    showToast('Geolocation not supported');
    return;
  }
  showLoadingOverlay('Locating you…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      STATE.pickupCoords = coords;
      if (STATE.pickupMarker) STATE.pickupMarker.setPosition(coords);
      if (STATE.pickupMapInstance) {
        STATE.pickupMapInstance.panTo(coords);
        STATE.pickupMapInstance.setZoom(16);
      }
      
      const provider = window.AIRRIDE_CONFIG?.MAP_PROVIDER || 'osm';
      if (provider === 'google' && window.google?.maps) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: coords }, (results, status) => {
          hideLoadingOverlay();
          if (status === 'OK' && results[0]) {
            const addr = results[0].formatted_address;
            setTextById('pickup-address', addr);
            const searchInp = document.getElementById('pickup-search');
            if (searchInp) searchInp.value = addr;
          }
        });
      } else {
        fetch(`https://nominatim.openstreetmap.org/reverse?lat=${coords.lat}&lon=${coords.lng}&format=json`, {
          headers: { 'User-Agent': 'AIRRIDE-App/1.0 (bhavankothalanka@projectwebsite.com)' }
        })
        .then(res => res.json())
        .then(data => {
          hideLoadingOverlay();
          const addr = data.display_name || 'Current Location';
          setTextById('pickup-address', addr);
          const searchInp = document.getElementById('pickup-search');
          if (searchInp) searchInp.value = addr;
        })
        .catch(() => hideLoadingOverlay());
      }
    },
    () => {
      hideLoadingOverlay();
      showToast('Could not fetch current position');
    },
    { timeout: 8000 }
  );
}

async function setPickup(address) {
  try {
    showLoadingOverlay('Setting pickup…');
    const data = await api.get(`/maps/geocode?address=${encodeURIComponent(address)}`);
    const pos = { lat: data.lat, lng: data.lng };
    STATE.pickupCoords = pos;
    if (STATE.pickupMarker) STATE.pickupMarker.setPosition(pos);
    if (STATE.pickupMapInstance) {
      STATE.pickupMapInstance.panTo(pos);
      STATE.pickupMapInstance.setZoom(16);
    }
    setTextById('pickup-address', address);
    const searchInp = document.getElementById('pickup-search');
    if (searchInp) searchInp.value = address;
  } catch (err) {
    showToast('Failed to set pickup: ' + err.message);
  } finally {
    hideLoadingOverlay();
  }
}

function selectAirport(name, code, terminals, distance) {
  STATE.selectedAirport = { name, code };
  const destInp = document.getElementById('dest-search');
  if (destInp) destInp.value = name;
  
  const termLbl = document.getElementById('terminal-section-lbl');
  if (termLbl) {
    termLbl.style.display = 'block';
    termLbl.textContent = `${code} TERMINALS`;
  }
  
  const termList = document.getElementById('terminal-list');
  if (termList) {
    termList.style.display = 'flex';
    let terms = [];
    if (code === 'JFK') {
      terms = [
        { label: 'Terminal 1 – International Departures', val: 'JFK T1' },
        { label: 'Terminal 4 – American Airlines Hub', val: 'JFK T4' },
        { label: 'Terminal 8 – British Airways', val: 'JFK T8' }
      ];
    } else if (code === 'LGA') {
      terms = [
        { label: 'Terminal A – Marine Air Terminal', val: 'LGA TA' },
        { label: 'Terminal B – Main Terminal', val: 'LGA TB' },
        { label: 'Terminal C – Delta Air Lines', val: 'LGA TC' }
      ];
    } else {
      terms = [
        { label: 'Terminal A – Domestic Flights', val: 'EWR TA' },
        { label: 'Terminal B – International Arrivals', val: 'EWR TB' },
        { label: 'Terminal C – United Hub', val: 'EWR TC' }
      ];
    }
    
    termList.innerHTML = terms.map(t => `
      <div class="terminal-item" onclick="selectTerminal('${t.label}','${t.val}')">
        <svg width="14" height="14" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="#888"/></svg>
        <span>${t.label}</span>
        <svg width="8" height="14" viewBox="0 0 8 14"><path d="M1 1L7 7L1 13" stroke="#ccc" stroke-width="1.5" fill="none"/></svg>
      </div>
    `).join('');
  }
}

function selectTerminal(label, val) {
  const code = val.split(' ')[0];
  const fullAddress = `${STATE.selectedAirport?.name || 'Airport'} – ${label}`;
  const destInp = document.getElementById('dest-search');
  if (destInp) destInp.value = fullAddress;
  
  let coords = { lat: 40.6413, lng: -73.7781 };
  if (code === 'LGA') coords = { lat: 40.7769, lng: -73.8740 };
  if (code === 'EWR') coords = { lat: 40.6895, lng: -74.1745 };
  
  STATE.destCoords = coords;
  const btn = document.getElementById('btn-confirm-dest');
  if (btn) btn.disabled = false;
}

function confirmDestination() {
  if (!STATE.destCoords) { showToast('Please select a destination'); return; }
  const pickupInp = document.getElementById('pickup-search')?.value || 'Your Location';
  const showPickupEls = document.querySelectorAll('#dest-pickup-show, #time-pickup-show, #flight-pickup-show');
  showPickupEls.forEach(el => el.textContent = pickupInp.slice(0, 18) + '...');
  navigateTo('datetime');
}

let selectedDateTab = 'today';
function switchDateTab(tab, btn) {
  selectedDateTab = tab;
  document.querySelectorAll('.dt-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  const timePicker = document.getElementById('custom-time-picker');
  const datePicker = document.getElementById('custom-date-picker');
  if (tab === 'custom') {
    if (timePicker) timePicker.style.display = 'block';
    if (datePicker) datePicker.style.display = 'block';
  } else {
    if (timePicker) timePicker.style.display = 'none';
    if (datePicker) datePicker.style.display = 'none';
  }
}

function confirmDateTime() {
  let date = new Date();
  if (selectedDateTab === 'tomorrow') {
    date.setDate(date.getDate() + 1);
  } else if (selectedDateTab === 'custom') {
    const dVal = document.getElementById('custom-date-val')?.value;
    const tVal = document.getElementById('custom-time-val')?.value;
    if (!dVal || !tVal) { showToast('Please select custom date and time'); return; }
    date = new Date(`${dVal}T${tVal}`);
  }
  
  STATE.scheduledAt = date.toISOString();
  navigateTo('flight');
}

function fillAirline(code) {
  const flightInp = document.getElementById('flight-input');
  if (flightInp) {
    flightInp.value = code + ' ';
    flightInp.focus();
  }
}

async function confirmFlight() {
  const flightInp = document.getElementById('flight-input');
  const flightNum = flightInp?.value?.trim() || '';
  if (!flightNum) {
    skipFlight();
    return;
  }
  
  showLoadingOverlay('Verifying flight details…');
  await lookupFlight(flightNum);
  hideLoadingOverlay();
  
  STATE.flightNumber = flightNum;
  navigateTo('fare');
  loadFareOptions(STATE.pickupCoords.lat, STATE.pickupCoords.lng, STATE.destCoords.lat, STATE.destCoords.lng, STATE.scheduledAt);
}

function skipFlight() {
  STATE.flightNumber = null;
  navigateTo('fare');
  loadFareOptions(STATE.pickupCoords.lat, STATE.pickupCoords.lng, STATE.destCoords.lat, STATE.destCoords.lng, STATE.scheduledAt);
}

// ─────────────────────────────────────────────────────────
// NAVIGATION & SCREEN FLOWS
// ─────────────────────────────────────────────────────────
const SCREEN_HOOKS = {
  otp: () => {
    const cells = document.querySelectorAll('.otp-cell');
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
  },
  home: () => {
    loadUserProfile();
    setTimeout(() => {
      const homeMapEl = document.getElementById('home-map');
      if (homeMapEl) {
        const defaultCenter = { lat: 40.6413, lng: -73.7781 };
        const map = new AirrideMap('home-map', defaultCenter, 13, MAP_PROVIDER);
        
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              const currentPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
              map.panTo(currentPos);
              map.addMarker(currentPos, { label: 'P', title: 'Your Location' });
            },
            () => {},
            { timeout: 5000 }
          );
        }
      }
    }, 100);
  },
  pickup: () => {
    setTimeout(() => {
      const pickupMapEl = document.getElementById('pickup-map');
      if (pickupMapEl) {
        const defaultCenter = { lat: 40.6413, lng: -73.7781 };
        const centerPos = STATE.pickupCoords || defaultCenter;
        
        const map = new AirrideMap('pickup-map', centerPos, 15, MAP_PROVIDER);
        const marker = map.addMarker(centerPos, {
          draggable: true,
          title: 'Drag to set pickup location',
          onDragEnd: (coords) => {
            STATE.pickupCoords = coords;
            updateAddress(coords);
          }
        });
        
        const updateAddress = (pos) => {
          if (MAP_PROVIDER === 'google' && window.google?.maps) {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ location: pos }, (results, status) => {
              if (status === 'OK' && results[0]) {
                const addr = results[0].formatted_address;
                setTextById('pickup-address', addr);
                const searchInp = document.getElementById('pickup-search');
                if (searchInp) searchInp.value = addr;
              }
            });
          } else {
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${pos.lat}&lon=${pos.lng}&format=json`, {
              headers: { 'User-Agent': 'AIRRIDE-App/1.0 (bhavankothalanka@projectwebsite.com)' }
            })
            .then(res => res.json())
            .then(data => {
              const addr = data.display_name || 'Selected Location';
              setTextById('pickup-address', addr);
              const searchInp = document.getElementById('pickup-search');
              if (searchInp) searchInp.value = addr;
            })
            .catch(() => {});
          }
        };

        if (!STATE.pickupCoords) {
          updateAddress(centerPos);
          STATE.pickupCoords = centerPos;
        }

        STATE.pickupMapInstance = map;
        STATE.pickupMapMarker = marker;
      }
    }, 100);
  },
  history:  () => loadBookingHistory(),
  tracking: () => {
    if (STATE.currentBooking) {
      subscribeToBookingUpdates(STATE.currentBooking.id);
      joinBookingRoom(STATE.currentBooking.id);
    }
    setTimeout(() => {
      const trackingMapEl = document.getElementById('tracking-map');
      if (trackingMapEl && STATE.currentBooking) {
        const pickup = { lat: +STATE.currentBooking.pickup_lat, lng: +STATE.currentBooking.pickup_lng };
        const dest = { lat: +STATE.currentBooking.destination_lat, lng: +STATE.currentBooking.destination_lng };
        
        const map = new AirrideMap('tracking-map', pickup, 12, MAP_PROVIDER);
        STATE.map = map;

        STATE.pickupMarker = map.addMarker(pickup, { label: 'P', title: 'Pickup Location' });
        STATE.destMarker = map.addMarker(dest, { label: 'D', title: 'Drop-off Destination' });

        drawRouteOnMap(map, pickup, dest);

        if (STATE.currentBooking.driver_lat && STATE.currentBooking.driver_lng) {
          updateDriverMarker(STATE.currentBooking.driver_lat, STATE.currentBooking.driver_lng);
        }
      }
    }, 100);
  },
  rating: () => {
    let score = 5;
    const stars = document.querySelectorAll('#rating-stars .star');
    const updateStars = (val) => {
      score = val;
      stars.forEach((s, idx) => {
        s.style.color = idx < val ? '#f59e0b' : '#ccc';
      });
    };
    updateStars(5);

    stars.forEach((s, idx) => {
      s.onclick = () => updateStars(idx + 1);
    });

    const commentInput = document.getElementById('rating-comment');
    if (commentInput) commentInput.value = '';

    const btn = document.getElementById('submit-rating-btn');
    if (btn) {
      btn.onclick = async () => {
        const comment = commentInput ? commentInput.value.trim() : '';
        await submitDriverRating(score, comment);
      };
    }

    const b = STATE.currentBooking;
    if (b) {
      setTextById('rating-driver-name', b.driver_name || 'Driver');
      setTextById('rating-driver-plate', b.license_plate || '');
      setTextById('rating-driver-car', `${b.color || ''} ${b.make || ''} ${b.model || ''}`.trim() || 'Vehicle');
      const initials = (b.driver_name || 'D').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
      setTextById('rating-driver-ava', initials);
    }
  }
};

function navigateTo(screen) {
  const prev = document.querySelector('.screen.active');
  const next = document.getElementById(`s-${screen}`);
  if (!next) { console.warn('Screen not found:', screen); return; }

  prev?.classList.remove('active');
  prev?.classList.add('exit');
  setTimeout(() => prev?.classList.remove('exit'), 380);
  void next.offsetWidth;
  next.classList.add('active');
  STATE.currentScreen = screen;

  if (SCREEN_HOOKS[screen]) SCREEN_HOOKS[screen]();
}

// Expose navigation hooks to window for HTML inline callbacks
window.nav = navigateTo;
window.logout = logout;
window.cancelBooking = cancelCurrentBooking;
window.useCurrentLocation = useCurrentLocation;
window.setPickup = setPickup;
window.selectDestination = selectDestination;
window.selectAirport = selectAirport;
window.selectTerminal = selectTerminal;
window.confirmDestination = confirmDestination;
window.switchDateTab = switchDateTab;
window.confirmDateTime = confirmDateTime;
window.fillAirline = fillAirline;
window.confirmFlight = confirmFlight;
window.skipFlight = skipFlight;
window.selectFare = selectFare;
window.createBooking = createBooking;
window.submitDriverRating = submitDriverRating;
window.viewBookingDetail = viewBookingDetail;

// ─────────────────────────────────────────────────────────
// UI UTILITIES
// ─────────────────────────────────────────────────────────
function setTextById(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '';
}

let _toastTimer;
function showToast(msg) {
  let toast = document.getElementById('app-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:#0a0a0a;color:#fff;padding:10px 20px;border-radius:24px;font-size:13px;white-space:nowrap;z-index:9999;opacity:0;transition:opacity .3s;max-width:320px;text-align:center;line-height:1.4;';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

let _loadingEl = null;
function showLoadingOverlay(msg = 'Loading…') {
  if (!_loadingEl) {
    _loadingEl = document.createElement('div');
    _loadingEl.id = 'loading-overlay';
    _loadingEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9998;color:#fff;font-family:Space Mono,monospace;font-size:13px;letter-spacing:.1em;gap:12px;';
    _loadingEl.innerHTML = '<div class="spinner" style="width:32px;height:32px;border:3px solid rgba(255,255,255,.2);border-top-color:#fff;border-radius:50%;animation:spin 1s linear infinite;"></div><span id="loading-msg"></span>';
    const style = document.createElement('style');
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
    document.body.appendChild(_loadingEl);
  }
  document.getElementById('loading-msg').textContent = msg;
  _loadingEl.style.display = 'flex';
}

function hideLoadingOverlay() {
  if (_loadingEl) _loadingEl.style.display = 'none';
}

function updateClock() {
  const el = document.getElementById('status-time');
  if (!el) return;
  const n = new Date();
  let h = n.getHours() % 12 || 12;
  el.textContent = `${h}:${n.getMinutes().toString().padStart(2,'0')}`;
}
setInterval(updateClock, 1000);
updateClock();

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    if (STATE.currentScreen === 'splash') navigateTo('login');
  }, 3000);

  initFirebaseAuth();
  setupFCMMessageHandler();
  
  setTimeout(initPlacesAutocomplete, 500);

  const sendOTPBtn = document.getElementById('btn-send-otp');
  if (sendOTPBtn) sendOTPBtn.addEventListener('click', handleSendOTP);

  const phoneInp = document.getElementById('login-phone');
  if (phoneInp) phoneInp.addEventListener('keydown', e => { if (e.key === 'Enter') handleSendOTP(); });

  const verifyBtn = document.getElementById('btn-verify');
  if (verifyBtn) verifyBtn.addEventListener('click', handleVerifyOTP);
});

function initPlacesAutocomplete() {
  const provider = window.AIRRIDE_CONFIG?.MAP_PROVIDER || 'osm';

  if (provider === 'google' && window.google?.maps?.places) {
    const pickupInp = document.getElementById('pickup-search');
    if (pickupInp) {
      const autocomplete = new google.maps.places.Autocomplete(pickupInp);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const pos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
          STATE.pickupCoords = pos;
          if (STATE.pickupMarker) STATE.pickupMarker.setPosition(pos);
          if (STATE.map) {
            STATE.map.panTo(pos);
            STATE.map.setZoom(16);
          }
          const addrEl = document.getElementById('pickup-address');
          if (addrEl) addrEl.textContent = place.formatted_address;
        }
      });
    }

    const destInp = document.getElementById('dest-search');
    if (destInp) {
      const autocomplete = new google.maps.places.Autocomplete(destInp);
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place.geometry) {
          const pos = { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() };
          STATE.destCoords = pos;
          const btn = document.getElementById('btn-confirm-dest');
          if (btn) btn.disabled = false;
        }
      });
    }
  } else {
    // OSM / Nominatim autocomplete searchsuggest
    setupOsmAutocomplete('pickup-search', (selection) => {
      STATE.pickupCoords = { lat: selection.lat, lng: selection.lng };
      if (STATE.pickupMarker) STATE.pickupMarker.setPosition(STATE.pickupCoords);
      if (STATE.map) {
        STATE.map.panTo(STATE.pickupCoords);
        STATE.map.setZoom(16);
      }
      const addrEl = document.getElementById('pickup-address');
      if (addrEl) addrEl.textContent = selection.address;
    });

    setupOsmAutocomplete('dest-search', (selection) => {
      STATE.destCoords = { lat: selection.lat, lng: selection.lng };
      const btn = document.getElementById('btn-confirm-dest');
      if (btn) btn.disabled = false;
    });
  }
}
