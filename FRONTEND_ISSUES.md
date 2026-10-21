# HeritageX Frontend Issues Log (`FRONTEND_ISSUES.md`)

> Per Hard Rule 6: Do not silently fix UI. Log issues here so the frontend owner can review.

| Page | Issue / Inconsistency | Impact | Suggested Fix |
|---|---|---|---|
| `Pages/culture.html` (lines 121-130) | Inline script directly accesses `CULTURE_SECTIONS` global array instead of a data helper function. | Direct dependency on static JS file; breaks when `data.js` switches to async API loading. | Wrap rendering in `renderCultureGrid(sections)` helper and invoke after data arrives from API or cache. |
| `Pages/detail.html` (lines 261-267) | "Helpful" counter increment on reviews is only updated in the local DOM button, not persisted in `localStorage` or DB. | Reloading page reverts helpful upvotes back to baseline. | Connect "Helpful" click to `PATCH /api/heritage/:id/reviews/:reviewId/helpful` endpoint. |
| `README.md` (lines 486-487) & `admin/js/admin-auth.js` | Admin demo username and passphrase are in plain text in public files. | Anyone with repo access has admin password. | Replace with environment variables (`ADMIN_EMAIL`, `ADMIN_PASSWORD`) and delete plain text credentials. |
| Directory casing (`Pages/` vs `pages/`) | Directory on disk is `Pages` with uppercase 'P', but Unix/Netlify hosting treats URLs case-sensitively. | Links using lowercase `/pages/` could 404 in production environments. | Ensure all relative links consistently match exact disk casing. |
