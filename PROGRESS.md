# HeritageX Backend — Progress Tracker (`PROGRESS.md`)

## Status Summary

### Production-readiness phase status (0–7)

| Phase | Scope | Status |
|---|---|---|
| 0 | Audit and baseline findings | Complete |
| 1 | Backend, database, and local environment reliability | Complete; verified by backend build and integration tests |
| 2 | CORS, cookie authentication, and security baseline | Complete; exact-origin and cookie behavior covered by API tests |
| 3 | API-backed discovery and detail pages | Complete; Playwright covers catalogue search and site detail |
| 4 | Visitor authentication and persisted user actions | Complete in code; guest saves, simulated authenticated saves/itinerary/reviews, and unauthenticated review redirect are covered; a real DB-backed authenticated browser run still needs a dedicated test account |
| 5 | Maps, accessibility, and failure-state handling | Google Maps integrated across home, discovery, detail, itinerary, and walks; key/billing/referrer failure states remain accessible |
| 6 | Automated testing and CI | Complete in repository; 13 backend tests, 3 proxy tests, and 8 Playwright tests pass locally |
| 7 | Live deployment and production smoke validation | **Not complete**; provider secrets, production origins, and deployment access have not been provided, so no remote deployment was changed or verified |

**Next phase to start: Phase 7.** Configure the frontend provider's `API_BACKEND_URL`, backend production environment and `CORS_ORIGINS`, then run database migrations and seed only after confirming the production database and migration policy. Finish with `/api/ready` and browser smoke checks on the deployed domains.

- Deployment templates and proxy functions are present, but they are not proof of a live deployment.
- The browser suite uses a mocked API for safe repeatability; it does not create or mutate a real visitor account.

- [x] **Phase 0: Frontend Audit & Documentation** — Complete (`AUDIT.md`, `FRONTEND_ISSUES.md`)
- [x] **Phase 1: Backend Foundation Setup** — Complete (Express 4, TypeScript, Zod env validation, security middleware, Pino, `/api/health` passing)
- [x] **Phase 2: Database Schema & Seed (Prisma + Neon Postgres)** — Complete (18 sites, 7 categories, 9 culture, 3 walks, reviews, argon2 admin seeded)
- [x] **Phase 3: Authentication & Security (Argon2, JWT Cookies, CSRF, RBAC)** — Complete (Register, login, admin login, refresh rotation, logout, /me, argon2id, account lockout)
- [x] **Phase 4: Public APIs & Recommendation Engine** — Complete (Catalogue, search, category counts, nearby geo-search, enriched walks, 4-factor recommendation engine)
- [x] **Phase 5: User-Data APIs (Preferences, Saved Places, Itineraries, Reviews)** — Complete (Preferences, bookmark sync, guest merge, itinerary TSP optimizer, review submission with HTML sanitization)
- [x] **Phase 6: Admin APIs & Analytics** — Complete (Site CRUD, review moderation queue, rating auto-recalculation, Chart.js analytics, audit logging)
- [x] **Phase 7: Frontend Integration (Zero visual changes)** — Complete (`js/api.js`, admin portal dynamic connection, `_redirects`, `netlify.toml`, detail page sync)
- [x] **Phase 8: Automated & Manual Testing** — Complete (Vitest test suite: 7/7 passing, TypeScript zero error compile)
- [ ] **Phase 9: Deployment & Launch Preparation** — Repository templates and provider proxies are prepared; live environment configuration and production smoke validation remain.

---

## Detailed Log

### Phase 0: Audit the Frontend
- Scanned all 11 user pages (`index.html`, `Pages/*.html`) and 5 admin pages (`admin/*.html`).
- Extracted exact schema shapes from `js/data.js` (`HERITAGE_SITES`, `CULTURE_SECTIONS`, `HERITAGE_WALKS`, `REVIEWS_SEED`).
- Audited all browser storage keys (`localStorage`, `sessionStorage`).
- Cataloged all forms, validation rules, and page data requirements.
- Documented findings in `AUDIT.md` and potential bugs in `FRONTEND_ISSUES.md`.

### Phase 1 to Phase 6: Core API, DB, Auth & Recommendation Engine
- Full REST API written with Express, TypeScript, Zod, Argon2, and Prisma.
- Connected to Neon PostgreSQL production branch with full migrations & seed data.
- Built 4-factor recommendation service (Interests 45%, Distance 25%, Time 20%, Rating 10%).
- Implemented TSP nearest-neighbor algorithm for itinerary optimization.
- Admin dashboard APIs with real-time analytics and review moderation queue.

### Phase 7 & 8: Integration & Testing
- Universal API client `js/api.js` created with CSRF protection, retry rotation, and token refresh.
- Admin dashboard integrated dynamically without modifying frontend appearance.
- Netlify redirect rules configured (`/api/* -> backend API`).
- Vitest automated tests covering public endpoints, recommendation engine, and admin auth passing (7/7).
