# HeritageX Backend API Reference (`API.md`)

Base URL:
- Local development: `http://localhost:5000/api`
- Production: `https://<BACKEND_HOST>/api` (or proxied via `/api/*` on Netlify)

All mutating requests (`POST`, `PUT`, `PATCH`, `DELETE`) require header:
`X-Requested-With: HeritageX`

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Register a new visitor user.
- **Request Body:**
  ```json
  {
    "name": "Arjun Patel",
    "email": "arjun@example.com",
    "password": "Password123!"
  }
  ```
- **Response (201):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "cmuz...",
        "name": "Arjun Patel",
        "email": "arjun@example.com",
        "role": "USER",
        "createdAt": "2026-10-08T..."
      },
      "accessToken": "eyJhbGci..."
    }
  }
  ```
- **Cookies set:** `hx_access_token` (15m), `hx_refresh_token` (7d, HttpOnly)

### `POST /api/auth/login`
User login. Supports email or username `heritagex_admin`. Locks account for 15 minutes after 5 failed attempts.
- **Request Body:**
  ```json
  {
    "emailOrUsername": "arjun@example.com",
    "password": "Password123!"
  }
  ```

### `POST /api/auth/admin/login`
Admin-only login. Fails with 401 if user does not hold `role: ADMIN`.

### `POST /api/auth/refresh`
Rotates refresh token, invalidates old token, sets new access & refresh cookies.

### `POST /api/auth/logout`
Revokes current refresh token in database and clears authentication cookies.

### `GET /api/auth/me`
Returns current session profile and stats.
- **Headers:** cookie or `Authorization: Bearer <accessToken>`

---

## 2. Public Endpoints (`/api`)

### `GET /api/heritage`
Browse catalog of verified heritage sites.
- **Query Parameters:**
  - `q`: Search string across title, description, history, tags
  - `category`: Filter by category name
  - `interest`: Filter by interest (`history`, `architecture`, `food`, etc.)
  - `minRating`: Minimum rating (e.g. `4.0`)
  - `sort`: `rating` (default) | `name` | `duration` | `new`
  - `page`: Page number (default: 1)
  - `limit`: Records per page (default: 20, max: 50)
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": 1,
        "name": "Bhadra Fort",
        "slug": "bhadra-fort",
        "categoryName": "Historical Monuments",
        "rating": 4.4,
        "reviewCount": 812,
        "duration": "45–60 min",
        "latitude": 23.0225,
        "longitude": 72.5825,
        ...
      }
    ],
    "meta": { "page": 1, "limit": 20, "total": 18, "totalPages": 1 }
  }
  ```

### `GET /api/heritage/:idOrSlug`
Full details of a site by integer ID or string slug, including approved reviews and nearby sites.

### `GET /api/heritage/nearby`
Find sites near coordinates.
- **Query Parameters:** `lat`, `lng`, `radiusKm` (default: 10), `category`

### `GET /api/categories`
Returns list of all categories with active site counts.

### `GET /api/culture`
Returns all 9 cultural sections (Gujarati Food, Traditional Crafts, Festivals, etc.).

### `GET /api/walks`
Returns all 3 curated heritage walks with fully hydrated stop sites.

### `POST /api/recommendations`
Execute the 4-factor recommendation scoring engine.
- **Request Body:**
  ```json
  {
    "interests": ["history", "architecture"],
    "time": "2h",
    "style": "walking",
    "area": "bhadra",
    "limit": 6
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "data": [
      {
        "site": { "id": 1, "name": "Bhadra Fort", ... },
        "score": 99,
        "matchPercentage": 99,
        "distanceKm": 0.0,
        "reason": "Recommended because you selected history, and it is 0.0 km from Bhadra Fort / Old City Core, and it fits comfortably within your available time."
      }
    ]
  }
  ```

---

## 3. User Endpoints (`/api`) — Requires `requireAuth`

### `GET /api/me/preferences` & `PUT /api/me/preferences`
Read or update saved interests, travel style, and time budget.

### `GET /api/saved`
List user's saved places with full site cards.

### `POST /api/saved/:siteId`
Save a site to bookmarks.

### `DELETE /api/saved/:siteId`
Remove a site from bookmarks.

### `POST /api/saved/merge`
Merge guest `localStorage` saved sites into account on login.
- **Request Body:** `{ "siteIds": [1, 2, 4] }`

### `GET /api/itineraries` & `POST /api/itineraries`
List or create custom trip itineraries.

### `POST /api/itineraries/:id/optimize`
Sorts itinerary stops using nearest-neighbor route heuristic to minimize travel distance.

### `POST /api/heritage/:id/reviews`
Submit a visitor review. Held in `PENDING` status for moderation. Text sanitized to prevent XSS.
- **Request Body:** `{ "rating": 5, "comment": "Beautiful architecture and rich history!" }`

---

## 4. Admin Endpoints (`/api/admin`) — Requires `role: ADMIN`

### `GET /api/admin/analytics`
Complete dashboard statistics and Chart.js datasets:
- Total, verified, pending reviews, and categories counts
- Category doughnut chart dataset
- Category average rating bar chart dataset
- Category breakdown summary table

### `GET /api/admin/heritage`
List all heritage sites (including pending verification).

### `POST /api/admin/heritage` & `PUT /api/admin/heritage/:id`
Add or update site. Logs changes to `AuditLog`.

### `DELETE /api/admin/heritage/:id`
Delete site from database.

### `GET /api/admin/reviews?status=PENDING`
Review moderation queue.

### `PATCH /api/admin/reviews/:id`
Approve or reject review. In a database transaction, automatically recomputes site `avgRating` and `ratingCount`.

### `GET /api/admin/audit`
Retrieve the last 50 administrative audit actions.
