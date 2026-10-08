/* =========================================================================
   HeritageX — admin-auth.js
   Production-ready Authentication Layer integrated with PostgreSQL backend.
   ========================================================================= */

const ADMIN_SESSION_KEY = "heritagex_admin_session";

const AUTH_API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "/api";

/**
 * Attempt admin login via server-side API. Returns Promise<{ success: boolean, message?: string }>.
 */
async function loginAdmin(username, password) {
  try {
    const res = await fetch(`${AUTH_API_BASE}/auth/admin/login`, {
      method: "POST",
      credentials: "include", // receives HttpOnly session cookies
      headers: {
        "Content-Type": "application/json",
        "X-Requested-With": "HeritageX",
      },
      body: JSON.stringify({
        emailOrUsername: username.trim(),
        password,
      }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || !json.success) {
      return {
        success: false,
        message: json?.error?.message || "Invalid administrator credentials.",
      };
    }

    // Set client session marker
    const session = {
      adminAuthenticated: true,
      user: json.data.user,
      issuedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(session));

    return { success: true };
  } catch (err) {
    console.error("Login network error:", err);
    return {
      success: false,
      message: "Network error connecting to backend API.",
    };
  }
}

/** Returns true if an admin session marker is present in sessionStorage */
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

/** Invalidates server session, clears storage, and redirects to login */
async function logoutAdmin() {
  try {
    await fetch(`${AUTH_API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "X-Requested-With": "HeritageX" },
    }).catch(() => {});
  } finally {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    redirectToLogin();
  }
}

/** Sends the browser to the admin login page */
function redirectToLogin() {
  window.location.href = "login.html";
}

/**
 * Verifies session with backend on page load.
 * If unauthorized, immediately redirects to login.html.
 */
function protectAdminPage() {
  // Synchronous optimistic check to avoid UI flicker
  if (!isAdminAuthenticated()) {
    redirectToLogin();
    return false;
  }

  // Asynchronous verification with backend
  fetch(`${AUTH_API_BASE}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: { "X-Requested-With": "HeritageX" },
  })
    .then((res) => {
      if (!res.ok) {
        sessionStorage.removeItem(ADMIN_SESSION_KEY);
        redirectToLogin();
      }
    })
    .catch(() => {
      // Allow offline prototype grace period if server temporarily offline
    });

  return true;
}