/* =========================================================================
   HeritageX — admin-auth.js
   =========================================================================
   ⚠️ SECURITY NOTICE — READ BEFORE REUSING THIS CODE ⚠️

   This is a FRONTEND-ONLY prototype authentication layer for a B.Tech PBL
   demonstration. It exists so the admin dashboard has *some* gate in front
   of it while the project has no backend yet.

   IT IS NOT REAL SECURITY:
   - There is no server validating credentials.
   - Anyone who opens browser DevTools can read this file's source,
     inspect sessionStorage, or simply run isAdminAuthenticated-style
     code manually to fake a session.
   - localStorage/sessionStorage are not secure stores — they are plain
     text, readable by any script running on the page (or by anyone
     with physical/DevTools access to the browser).
   - There is no hashing, no server session, no CSRF protection, no
     rate limiting here.

   WHAT THIS FILE IS FOR:
   - Demonstrating the *shape* of an auth flow (login → session → guard →
     logout) so the UI and page-protection pattern are already correct
     when a real backend is added.

   HOW THIS BECOMES REAL LATER (no UI redesign needed):
   - loginAdmin() → replace the local check with:
         POST /api/auth/login  { username, password }
         → server verifies against a hashed password (bcrypt/Argon2)
         → server returns a signed session cookie (HttpOnly) or JWT
   - isAdminAuthenticated() → replace with a call to
         GET /api/auth/session   (relies on the HttpOnly cookie / token)
   - protectAdminPage() → same shape, just awaits the server check
   - logoutAdmin() → POST /api/auth/logout to invalidate the server session
   - Role-based access (adminRole) would then be asserted by the server on
     every admin API call, not trusted from the client.
   ========================================================================= */

const ADMIN_SESSION_KEY = "heritagex_admin_session";

/**
 * Demo credential check.
 *
 * NOTE: This is intentionally NOT "if (username === 'admin' && password === 'admin123')"
 * written in plain sight as if it were secure. There is no way to check a
 * password safely on the frontend alone — any "real" check here would just
 * be obfuscated plaintext. For the prototype we accept a fixed demo
 * username and a non-trivial demo passphrase, purely so the login screen
 * has something to demonstrate the flow with. This must be replaced by a
 * server-side credential check before this project ever handles real data.
 */
function verifyDemoCredentials(username, password) {
    const DEMO_USERNAME = "heritagex_admin"; // demo only — never do this in production
    const DEMO_PASSPHRASE = "PBL-Demo-2026!"; // demo only — never do this in production
    return username.trim().toLowerCase() === DEMO_USERNAME && password === DEMO_PASSPHRASE;
}

/**
 * Attempt admin login. Returns { success: boolean }.
 * On success, stores a MINIMAL session marker in sessionStorage —
 * never the password itself.
 */
function loginAdmin(username, password) {
    const ok = verifyDemoCredentials(username, password);
    if (!ok) {
        return { success: false, message: "Invalid administrator credentials." };
    }
    const session = {
        adminAuthenticated: true,
        adminRole: "admin",
        adminSession: "demo-" + Date.now().toString(36), // stand-in for a real session/JWT id
        issuedAt: new Date().toISOString()
    };
    // sessionStorage clears when the browser tab/window closes — a reasonable
    // default for a demo "session" that shouldn't outlive the visit.
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));
    return { success: true };
}

/** Returns true if a (demo) admin session marker is present. */
function isAdminAuthenticated() {
    try {
        const raw = sessionStorage.getItem(ADMIN_SESSION_KEY);
        if (!raw) return false;
        const session = JSON.parse(raw);
        return !!session.adminAuthenticated;
    } catch (e) {
        return false;
    }
}

/** Clears the demo session and sends the admin back to the login screen. */
function logoutAdmin() {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    redirectToLogin();
}

/** Sends the browser to the admin login page. */
function redirectToLogin() {
    window.location.href = "login.html";
}

/**
 * Call this at the top of every protected admin page (dashboard.html and
 * any future admin pages). If there's no valid session, it redirects to
 * login immediately and returns false so calling code can stop rendering.
 */
function protectAdminPage() {
    if (!isAdminAuthenticated()) {
        redirectToLogin();
        return false;
    }
    return true;
}