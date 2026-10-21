(function () {
    const key = String(window.HX_GOOGLE_MAPS_API_KEY || "").trim();

    window.hxGoogleMapsReady = new Promise((resolve, reject) => {
        if (!key) {
            reject(new Error("Google Maps is not configured. Add a referrer-restricted Maps JavaScript API key in js/runtime-config.js."));
            return;
        }

        const callbackName = "__hxGoogleMapsInitialized";
        const script = document.createElement("script");
        const params = new URLSearchParams({
            key,
            callback: callbackName,
            loading: "async",
            v: "weekly"
        });
        let settled = false;

        function fail(message) {
            if (settled) return;
            settled = true;
            reject(new Error(message));
        }

        function handleAuthFailure() {
            const message =
                "Google Maps rejected the API key. Check that billing and the Maps JavaScript API are enabled and that this site is an allowed referrer.";
            window.hxGoogleMapsError = message;
            document.querySelectorAll("[data-google-maps-status]").forEach((status) => {
                status.textContent = message;
                status.classList.add("text-danger");
            });
            document.querySelectorAll(".hx-map").forEach((map) => {
                map.setAttribute("aria-busy", "false");
            });
            fail(message);
        }

        window[callbackName] = () => {
            if (settled) return;
            settled = true;
            resolve(window.google.maps);
        };
        window.gm_authFailure = handleAuthFailure;
        script.src = `https://maps.googleapis.com/maps/api/js?${params}`;
        script.async = true;
        script.onerror = () => fail(
            "Google Maps could not load. Check your connection and the Maps JavaScript API key configuration."
        );
        document.head.appendChild(script);
    });

    window.hxGoogleMapsReady.catch(() => {});
})();
