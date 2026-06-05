# AIRRIDE – Backend Setup & Credentials Guide

## Step 1: Create Your Supabase Project

1. Go to **[supabase.com](https://supabase.com)** → New Project
2. Note your **Project URL** and **Project Ref** (e.g. `abcxyz`)
3. Go to **Project Settings → Database → Connection string (URI)**
4. Copy the URI → this is your `DATABASE_URL`
5. Go to **Project Settings → API**
6. Copy **URL** → `SUPABASE_URL`
7. Copy **service_role** key → `SUPABASE_SERVICE_KEY`

## Step 2: Create Your Firebase Project

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)** → New Project
2. Enable **Authentication → Phone** sign-in method
3. Go to **Project Settings → Service Accounts → Generate new private key**
4. Download the JSON file
5. From the JSON, copy:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key_id` → `FIREBASE_PRIVATE_KEY_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `client_id` → `FIREBASE_CLIENT_ID`

## Step 3: Get Google Maps API Key

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)** → APIs & Services
2. Enable these APIs:
   - Maps JavaScript API
   - Geocoding API
   - Distance Matrix API
   - Directions API
3. Create credentials → API Key → copy it → `GOOGLE_MAPS_API_KEY`

## Step 4: Get AviationStack API Key

1. Go to **[aviationstack.com](https://aviationstack.com)** → free tier signup
2. Copy your API access key → `AVIATION_API_KEY`

## Step 5: Create the .env File

```bash
cd "/Users/bhavankothalanka/project website/airport taxi/apps/backend"
cp .env.example .env
# Now edit .env and fill in all your credentials
nano .env
```

## Step 6: Run Database Migrations

```bash
# Creates all 8 original tables
npm run db:migrate

# Creates 4 new tables (driver_locations, driver_earnings, driver_performance, airport_queue, ratings)
npm run db:migrate2
```

## Step 7: Start the Backend Server

```bash
npm run dev
# Server runs on http://localhost:3000
# API health check: http://localhost:3000/health
```

## Step 8: Wire Frontend Apps

Add this config block to the `<head>` of both HTML files:

### `/web/index.html`
```html
<script>
  window.AIRRIDE_CONFIG = {
    API_BASE:         'http://localhost:3000/api',
    WS_URL:           'http://localhost:3000',
    SUPABASE_URL:     'https://YOUR-REF.supabase.co',
    SUPABASE_ANON_KEY: 'your-supabase-anon-key',   // NOT service key
    GOOGLE_MAPS_KEY:  'your-google-maps-api-key',
    FCM_VAPID_KEY:    'your-fcm-vapid-key',
  };
</script>

<!-- Firebase SDK (for phone OTP) -->
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/9.x.x/firebase-messaging-compat.js"></script>
<script>
  firebase.initializeApp({
    apiKey:            "your-web-api-key",
    authDomain:        "your-project.firebaseapp.com",
    projectId:         "your-project-id",
    messagingSenderId: "your-sender-id",
    appId:             "your-app-id",
  });
</script>

<!-- Socket.IO client -->
<script src="https://cdn.socket.io/4.7.2/socket.io.min.js"></script>

<!-- Supabase client -->
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>

<!-- Google Maps -->
<script async src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places&callback=initGoogleMap"></script>
```

### `/driver-app/index.html`
Same config block, same Firebase/Socket.IO/Supabase scripts.

---

## API Endpoint Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/verify` | Customer login (Firebase ID token → DB upsert) |
| POST | `/api/auth/driver/verify` | Driver login (Firebase ID token → DB upsert) |
| GET | `/api/auth/profile` | Get customer profile |
| PUT | `/api/auth/profile` | Update customer profile |

### Bookings (Customer)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create booking (triggers auto driver match) |
| GET | `/api/bookings` | Get user bookings (paginated) |
| GET | `/api/bookings/:id` | Get single booking |
| PUT | `/api/bookings/:id/cancel` | Cancel booking |
| POST | `/api/bookings/:id/rate` | Rate driver (1-5 stars) |

### Driver
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/driver/profile` | Get driver profile + vehicle + stats |
| PUT | `/api/driver/availability` | Toggle online/offline + GPS |
| PUT | `/api/driver/location` | Update GPS position (stored to DB) |
| GET | `/api/driver/bookings` | Get driver trip history |
| POST | `/api/driver/bookings/:id/accept` | Accept ride request |
| POST | `/api/driver/bookings/:id/arrive` | Mark driver arrived at pickup |
| POST | `/api/driver/bookings/:id/start` | Passenger onboard, trip starts |
| POST | `/api/driver/bookings/:id/complete` | Complete trip (saves earnings) |
| GET | `/api/driver/earnings` | Today/week/month earnings summary |
| GET | `/api/driver/earnings/history` | Paginated earnings list |
| GET | `/api/driver/performance` | Accept rate, cancel rate, on-time rate |
| GET | `/api/driver/queue` | Airport queue status |

### Maps & Fare
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/fare/calculate` | Calculate fare (all vehicle types) |
| GET | `/api/maps/distance` | Real road distance via Google Maps |
| GET | `/api/maps/geocode` | Address → coordinates |
| GET | `/api/maps/directions` | Turn-by-turn directions + polyline |

### Flights
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flights/:flightNumber` | Real-time flight status (AviationStack) |

### Real-Time (Socket.IO events)
| Event | Direction | Description |
|-------|-----------|-------------|
| `join_booking_room` | Client → Server | Customer subscribes to booking updates |
| `join_driver_room` | Client → Server | Driver subscribes to ride requests |
| `driver_location` | Client → Server | Driver broadcasts GPS |
| `ride_request` | Server → Driver | New ride assigned to driver |
| `driver_location_update` | Server → Customer | Driver GPS position update |
| `booking_status_update` | Server → Customer | Status change notification |
| `ride_cancelled` | Server → Driver | Customer cancelled the ride |

---

## What Changed vs. Before

| Before | After |
|--------|-------|
| `setTimeout(4000)` fake ride request | Real Socket.IO `ride_request` event from server |
| Hardcoded `$185.50` earnings | Real DB query: `SELECT SUM(net_payout)` |
| Any OTP accepted | Real Firebase phone OTP via Twilio SMS |
| `John Smith` hardcoded passenger | Real passenger data from `users` table |
| CSS animation "GPS" | Real `navigator.geolocation.watchPosition` |
| `setInterval` ETA | Real Google Maps Duration Matrix |
| 5 hardcoded trips | Real `SELECT * FROM bookings WHERE driver_id=...` |
| Stars click nowhere | Real `POST /api/bookings/:id/rate` + rolling average |
| `localStorage` fake session | Real Firebase ID token refresh cycle |
| No driver assignment | Auto haversine-based nearest driver matching |
| No earnings tracking | `driver_earnings` ledger row on every completion |
