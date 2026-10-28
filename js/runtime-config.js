window.HX_API_BASE_URL = window.HX_API_BASE_URL || "";
// Only set key if it was not already pre-set (e.g., by a test environment).
// Use !== undefined so a test that sets the key to "" won't be overridden.
window.HX_GOOGLE_MAPS_API_KEY = window.HX_GOOGLE_MAPS_API_KEY !== undefined
    ? window.HX_GOOGLE_MAPS_API_KEY
    : "AIzaSyDkldNfToYaxZ3lnhRItn8hA_n9aEqC8Xc";
