# HeritageX Frontend Audit (`AUDIT.md`)

> **Phase 0 Deliverable** — Comprehensive inventory of the frontend data structures, client storage, forms, page dependencies, and REST API mapping.

---

## 1. Hardcoded Data Arrays & Schema Shapes (`js/data.js`)

### A. `HERITAGE_SITES` (`Array<HeritageSite>`)
- **Total records:** 15 initial sites
- **Field Definitions:**
  - `id`: `number` (1, 2, 3... 15)
  - `name`: `string` (e.g. "Bhadra Fort")
  - `slug`: `string` (e.g. "bhadra-fort")
  - `category`: `string` ("Historical Monuments", "Sultanate Heritage", "Religious Heritage", "Pols & Havelis", "Museums", "Markets", "Living Heritage")
  - `tags`: `string[]` (e.g. `["Sultanate Era", "Fort", "1411 CE"]`)
  - `interests`: `string[]` (e.g. `["history", "architecture", "photography"]`)
  - `shortDescription`: `string`
  - `history`: `string`
  - `culturalSignificance`: `string`
  - `architecture`: `string`
  - `image`: `string` (URL)
  - `gallery`: `string[]` (URLs)
  - `latitude`: `number` (Float)
  - `longitude`: `number` (Float)
  - `rating`: `number` (Float, 0.0 – 5.0)
  - `reviewCount`: `number` (Int)
  - `duration`: `string` (e.g. "45–60 min", "15–20 min", "2 hours")
  - `timings`: `string`
  - `entryFee`: `string`
  - `nearbyPlaces`: `number[]` (Array of site IDs)
  - `responsibleGuidelines`: `string[]`
  - `verified`: `boolean`
  - `source`: `string`

### B. `CULTURE_SECTIONS` (`Array<Culture>`)
- **Total records:** 6 cultural sections
- **Field Definitions:**
  - `id`: `string` ("food", "crafts", "festivals", "pol-life", "markets", "music")
  - `title`: `string`
  - `icon`: `string` (Bootstrap icon name, e.g. "bi-egg-fried")
  - `summary`: `string`
  - `body`: `string`

### C. `HERITAGE_WALKS` (`Array<HeritageWalk>`)
- **Total records:** 3 curated walks + 1 dynamic custom route
- **Field Definitions:**
  - `id`: `string` ("morning-walk", "evening-walk", "monuments-walk", "custom-walk")
  - `title`: `string`
  - `type`: `string` ("Morning", "Evening", "Monuments", "Custom")
  - `duration`: `string` (e.g. "2.5 hours")
  - `difficulty`: `string` ("Easy", "Moderate")
  - `stops`: `number`
  - `startingPoint`: `string`
  - `endingPoint`: `string`
  - `route`: `number[]` (Ordered array of site IDs)
  - `culturalStory`: `string`

### D. `REVIEWS_SEED` (`Record<number, Array<Review>>`)
- Seed reviews keyed by site id (`1`, `4`, `6`):
  - `id`: `string` (e.g. "r1")
  - `author`: `string`
  - `rating`: `number` (1 to 5)
  - `text`: `string`
  - `date`: `string` (YYYY-MM-DD)
  - `helpful`: `number`
  - `pending`: `boolean` (optional for seed, `true` for user submissions)

---

## 2. Browser Storage Keys (`localStorage` & `sessionStorage`)

| Key | Storage | Content | Data Type | Notes |
|---|---|---|---|---|
| `heritagex_bookmarks` | `localStorage` | Array of saved site IDs | `number[]` | Guest bookmarks; will merge to server on user login |
| `heritagex_itinerary` | `localStorage` | Array of trip stops | `Array<{ siteId: number, time: string }>` | Will sync with `Itinerary` table when authenticated |
| `heritagex_reviews_<siteId>` | `localStorage` | User-submitted reviews per site | `Array<Review>` | To be replaced by server-side review moderation table |
| `heritagex_admin_sites` | `localStorage` | Added/edited/deleted admin site overlay | `{ added: [], edited: {}, deleted: [] }` | Replaced by PostgreSQL `HeritageSite` mutations |
| `heritagex_admin_session` | `sessionStorage` | Client session flag | `{ authenticated: boolean, timestamp: number }` | Replaced by HTTP-only JWT cookies (`/api/auth/*`) |

---

## 3. Form Inventory

| Page | Form / Element ID | Input Fields | Client Validation | Target Endpoint |
|---|---|---|---|---|
| `index.html` | `#navSearchForm` / `#heroSearchForm` | `#navSearchInput`, `#heroSearchInput` | Trimmed non-empty string | Redirects to `/Pages/explore.html?q=...` -> `GET /api/heritage?q=` |
| `Pages/detail.html` | `#reviewForm` | `#starValue` (1-5), `#reviewText` (textarea) | Star > 0, text trimmed non-empty | `POST /api/heritage/:id/reviews` |
| `Pages/recommendations.html` | Choice tiles wizard | `interests[]`, `time`, `style`, `area` | Step progression checks | `POST /api/recommendations` |
| `admin/login.html` | `#adminLoginForm` | `#adminUsername`, `#adminPassword` | Required fields | `POST /api/auth/admin/login` |
| `admin/sites.html` | `#siteForm` | `#siteFormId`, `#siteFormName`, `#siteFormCategory`, `#siteFormDesc`, `#siteFormVerified` | Required name, category, desc | `POST /api/admin/heritage` / `PUT /api/admin/heritage/:id` |

---

## 4. Page Data Mapping Table

| Page | Reads | Writes | Proposed Endpoint(s) |
|---|---|---|---|
| `index.html` | Featured sites, culture highlights, walks preview, map markers | Navigation search | `GET /api/heritage?limit=6`, `GET /api/culture`, `GET /api/walks` |
| `Pages/explore.html` | Sites catalog, categories, tags | Search & filter params | `GET /api/heritage?q=&category=&sort=&page=&limit=`, `GET /api/categories` |
| `Pages/detail.html` | Site by slug, approved reviews, nearby sites | Submit review, bookmark, add to trip | `GET /api/heritage/:slug`, `POST /api/heritage/:id/reviews`, `POST /api/saved/:siteId` |
| `Pages/map.html` | Sites with lat/lng, categories, nearby distance | Geolocation / demo origin | `GET /api/heritage/nearby?lat=&lng=&radiusKm=` |
| `Pages/recommendations.html` | Sites filtered & scored by preferences | Itinerary additions | `POST /api/recommendations`, `GET/PUT /api/me/preferences` |
| `Pages/itinerary.html` | Itinerary stops, site details | Reorder stops, remove stops, start time | `GET/POST /api/itineraries`, `PUT /api/itineraries/:id` |
| `Pages/culture.html` | Cultural sections | None | `GET /api/culture` |
| `Pages/heritage-walks.html` | Walk routes, stops, site details | Add walk to itinerary | `GET /api/walks`, `POST /api/itineraries` |
| `Pages/saved.html` | Bookmarked sites by IDs | Add to itinerary, remove bookmark | `GET /api/saved`, `POST /api/saved/merge`, `DELETE /api/saved/:siteId` |
| `Pages/about.html` | Static editorial content | None | Static HTML |
| `Pages/responsible-tourism.html` | Static guidelines | None | Static HTML |
| `admin/login.html` | Session check | Admin credentials | `POST /api/auth/admin/login`, `GET /api/auth/me` |
| `admin/dashboard.html` | System stats (total, verified, pending reviews, categories) | None | `GET /api/admin/analytics`, `GET /api/auth/me` |
| `admin/sites.html` | All sites (verified + pending) | Add/Edit/Delete/Verify site | `GET /api/admin/heritage`, `POST/PUT/DELETE /api/admin/heritage/:id` |
| `admin/reviews.html` | Pending review moderation queue | Approve / Reject review | `GET /api/admin/reviews?status=PENDING`, `PATCH /api/admin/reviews/:id` |
| `admin/analytics.html` | Category distribution & rating stats | None | `GET /api/admin/analytics` |

---

## 5. Current Admin Auth Mechanism & Security Audit

- **Location:** `admin/js/admin-auth.js`
- **Current Flow:**
  - Hardcoded credentials in `verifyDemoCredentials()`: username `heritagex_admin`, passphrase `PBL-Demo-2026!`.
  - On submit, sets `sessionStorage.setItem("heritagex_admin_session", JSON.stringify({ authenticated: true, timestamp: Date.now() }))`.
  - `protectAdminPage()` checks if `sessionStorage` item exists; if not, redirects to `login.html`.
- **Target Replacement:**
  - Secure server-side endpoint `POST /api/auth/admin/login`.
  - Argon2id password hash verification against seeded database record.
  - JWT Access (15m) + Refresh (7d) cookies with `httpOnly`, `Secure`, `SameSite=Lax`.
  - Server-side middleware `requireRole('ADMIN')` on all `/api/admin/*` routes.
