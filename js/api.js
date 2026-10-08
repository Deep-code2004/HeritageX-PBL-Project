/* =========================================================================
   HeritageX — api.js
   Unified client for all backend REST API communication.
   ========================================================================= */

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:5000/api"
    : "/api";

let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
}

/**
 * Core fetch wrapper with automatic token refresh, credentials, and CSRF protection
 */
async function api(path, options = {}) {
  const { method = "GET", body, headers = {}, retry = true } = options;

  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;

  const fetchOptions = {
    method,
    credentials: "include", // send/receive HttpOnly cookies
    headers: {
      "X-Requested-With": "HeritageX", // CSRF defense
      ...headers,
    },
  };

  if (body !== undefined) {
    fetchOptions.headers["Content-Type"] = "application/json";
    fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, fetchOptions);
    const json = await res.json().catch(() => ({}));

    // Handle 401 Unauthorized with token refresh rotation
    if (res.status === 401 && retry && !path.includes("/auth/")) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
            method: "POST",
            credentials: "include",
            headers: { "X-Requested-With": "HeritageX" },
          });

          if (refreshRes.ok) {
            isRefreshing = false;
            processQueue(null);
            return api(path, { ...options, retry: false });
          } else {
            isRefreshing = false;
            processQueue(new Error("Session expired"));
          }
        } catch (refreshErr) {
          isRefreshing = false;
          processQueue(refreshErr);
        }
      } else {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: () => resolve(api(path, { ...options, retry: false })),
            reject: (err) => reject(err),
          });
        });
      }
    }

    if (!res.ok) {
      const err = new Error(json?.error?.message || `Request failed with status ${res.status}`);
      err.status = res.status;
      err.code = json?.error?.code;
      err.details = json?.error?.details;
      throw err;
    }

    return json;
  } catch (error) {
    throw error;
  }
}

api.get = (path, opts) => api(path, { ...opts, method: "GET" });
api.post = (path, body, opts) => api(path, { ...opts, method: "POST", body });
api.put = (path, body, opts) => api(path, { ...opts, method: "PUT", body });
api.patch = (path, body, opts) => api(path, { ...opts, method: "PATCH", body });
api.delete = (path, opts) => api(path, { ...opts, method: "DELETE" });

window.api = api;
