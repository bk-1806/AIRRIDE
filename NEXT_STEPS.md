# AIRRIDE — Next Steps & Known Issues
# Status: MVP Checkpoint — 2026-06-05
# ─────────────────────────────────────────────────────────────────────────────

## Current Status

| Component | Status |
|---|---|
| Backend API (Node.js / Express) | ✅ Complete |
| PostgreSQL Database (Supabase) | ✅ Complete — all 10 tables |
| Firebase Phone Authentication | ✅ Complete (backend) |
| Socket.IO Real-time | ✅ Complete |
| Row Level Security (RLS) | ✅ Complete — 15 policies |
| AviationStack Integration | ✅ Complete |
| OpenStreetMap / Nominatim | ✅ Complete |
| OSRM Routing | ✅ Complete |
| Customer Web App | ⚠️ Partially working — UI issues blocking manual test |
| Driver Web App | ⚠️ Partially working — UI issues blocking manual test |
| Admin Dashboard | 🔴 Not started |
| Flutter Customer App | 🔴 Not started |
| Flutter Driver App | 🔴 Not started |
| Production Deployment | 🔴 Not started |

---

## 🔴 Critical Blockers (Fix Before Resuming Testing)

### 1. Country/Region Code Selector Not Working
**File:** `web/index.html`, `driver-app/index.html`
**Issue:** The phone number input's country code selector (`+91`, `+1`, etc.) does not
render or function correctly. Users cannot change the country prefix.
**Impact:** Phone number submission fails or sends malformed numbers to Firebase Auth.
**Fix needed:**
- Implement a proper intl-tel-input library or a simple `<select>` dropdown for country codes
- Ensure the final phone number is assembled as `+{countryCode}{number}` before sending to Firebase

### 2. Phone Login / OTP Flow Not Functional from UI
**File:** `web/app.js` → `handleSendOTP()`, `handleVerifyOTP()`
**Issue:** Firebase `RecaptchaVerifier` or `signInWithPhoneNumber` is failing in the browser
context. The OTP is either not sent or the verification step throws an error.
**Likely causes:**
- `RecaptchaVerifier` requires a visible DOM element with a valid `id`
- Firebase Phone Auth requires the domain to be whitelisted in Firebase Console
  → Add `localhost` to **Firebase Console → Authentication → Settings → Authorized domains**
- The `appVerifier` object may be getting garbage collected before use
**Fix needed:**
- Verify `localhost` is in Firebase authorized domains
- Test `signInWithPhoneNumber` in browser console directly
- Add explicit error display so the user sees what Firebase returns

### 3. Manual Booking Flow Not Fully Usable
**Issue:** Because login fails, the subsequent booking flow (pickup/destination entry,
fare calculation, booking creation) cannot be reached during manual UI testing.
**Note:** The backend APIs for all these flows are fully functional and were verified
by programmatic E2E tests (55/56 passing, 98% score).
**Unblocked by:** Fixing issues #1 and #2 above.

---

## 🟡 Remaining UI Fixes (After Login is Fixed)

### 4. Map Rendering on Tracking Screen
- Verify Leaflet map initializes correctly after navigating to tracking screen
- Ensure `tracking-map` div is visible before `new L.Map()` is called
- Driver marker update function `updateDriverMarker(lat, lng)` needs live GPS data

### 5. Driver Location Ping from Driver App
- `startLocationTracking()` in `driver-app.js` uses `navigator.geolocation`
- Test that it actually emits `driver_location` events over Socket.IO
- Verify the customer app receives and renders these on the map

### 6. Trip Lifecycle UI Buttons
- Confirm "Arrived", "Start Trip", "Complete Trip" buttons trigger correct API calls
- Verify status transitions are reflected on the customer tracking screen in real-time

### 7. Rating Screen Auto-Navigation
- After `completed` status received via Socket.IO, customer should auto-navigate to rating
- Verify `navigateTo('rating')` is called in `handleBookingStatusChange`

---

## 🏗️ Admin Dashboard (Not Started)

**Path:** `apps/admin_dashboard/` (Vite/React scaffold exists, no features built)

**Features to build:**
- [ ] Login (JWT-based, separate from customer/driver auth)
- [ ] Live driver map (all online drivers)
- [ ] Booking list with filters (status, date, driver, customer)
- [ ] Driver management (activate/deactivate, verify documents)
- [ ] Earnings overview (daily/weekly/monthly)
- [ ] Customer list
- [ ] Trip analytics

---

## 📱 Flutter Migration Plan

### Phase 1 — Flutter Customer App
**Priority:** High (after UI fixes on web app are validated)
**Tech stack:** Flutter + Firebase Auth + Dart HTTP client
**Key screens:**
- Splash / Login (Firebase Phone Auth)
- Home (pickup + destination search, Nominatim)
- Fare selection
- Booking confirmation
- Tracking (flutter_map + Socket.IO)
- Rating
- History

**Backend:** Point to same Express API — no backend changes needed.
**Maps:** Use `flutter_map` (Leaflet equivalent) + Nominatim + OSRM.
**Real-time:** Use `socket_io_client` Dart package.

### Phase 2 — Flutter Driver App
**Priority:** High (parallel with customer app)
**Key screens:**
- Login
- Dashboard (online/offline toggle)
- Incoming ride request
- Navigation (pickup → destination)
- Trip controls (Arrived / Start / Complete)
- Earnings

### Phase 3 — Production Deployment
**Backend deployment target:** Railway or Render (Node.js, zero config)
**Steps:**
1. Set all environment variables in Railway/Render dashboard
2. Update CORS origins to production domain
3. Add HTTPS reverse proxy (handled by platform)
4. Update Firebase authorized domains
5. Run `rls_migration_v2.sql` against production DB (already done on Supabase)
6. Restrict Firebase API key to production domain in Google Cloud Console

---

## 🔒 Security Checklist (Completed)

- [x] All mock/bypass authentication removed
- [x] OTP bypasses (`9999999999`, `8888888888`) removed
- [x] Supabase anon key removed from all frontend HTML
- [x] Supabase Realtime replaced with Socket.IO (no anon key usage)
- [x] RLS enabled on all 6 tables (15 policies)
- [x] `public.firebase_uid()` helper in correct schema
- [x] Firebase Admin loaded from env vars (not hardcoded)
- [x] `.env` excluded from git via `.gitignore`
- [ ] Firebase API key restricted to production domain (Google Cloud Console)
- [ ] HTTPS reverse proxy in front of Node.js backend
- [ ] Production CORS domains set

---

## 📋 GitHub Repository

**Repo:** https://github.com/bk-1806/AIRRIDE
**Branch:** `main`
**Checkpoint commit:** `AIRRIDE MVP checkpoint - backend, realtime, security, and integrations complete`

### What is in the repo
- `apps/backend/` — Full Express API + Socket.IO server
- `apps/admin_dashboard/` — React/Vite scaffold (not yet built out)
- `web/` — Customer web app (HTML/CSS/JS, Leaflet maps)
- `driver-app/` — Driver web app (HTML/CSS/JS)
- `apps/backend/.env.example` — Template for all required env vars
- `README.md` — Project overview
- `SETUP.md` — Local development setup guide
- `NEXT_STEPS.md` — This file

### What is NOT in the repo (gitignored)
- `.env` — Contains all secrets (DATABASE_URL, Firebase private key, etc.)
- `node_modules/` — Install with `npm install`
- `dist/`, `build/` — Build artifacts
- Any Firebase service account JSON files
