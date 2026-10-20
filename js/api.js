/* Shared API transport and response normalization for the HeritageX frontend. */
(function () {
    const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    const API_BASE = window.HX_API_BASE_URL || (isLocal
        ? `${window.location.protocol}//localhost:5000/api`
        : `${window.location.origin}/api`);
    let refreshRequest;

    class ApiError extends Error {
        constructor(message, status, code, details) {
            super(message);
            this.name = "ApiError";
            this.status = status;
            this.code = code;
            this.details = details;
        }
    }

    async function readResponse(response) {
        let body;
        try {
            body = await response.json();
        } catch {
            throw new ApiError("The server returned an invalid response.", response.status, "INVALID_RESPONSE");
        }
        if (!response.ok || body.success === false) {
            throw new ApiError(
                body.error?.message || `Request failed (${response.status}).`,
                response.status,
                body.error?.code,
                body.error?.details
            );
        }
        return body;
    }

    async function requestEnvelope(path, options = {}, mayRefresh = true) {
        const headers = new Headers(options.headers || {});
        headers.set("X-Requested-With", "HeritageX");
        if (options.body !== undefined && !(options.body instanceof FormData)) {
            headers.set("Content-Type", "application/json");
        }

        let response;
        try {
            response = await fetch(`${API_BASE}${path}`, {
                ...options,
                headers,
                credentials: "include",
                body: options.body !== undefined && !(options.body instanceof FormData)
                    ? JSON.stringify(options.body)
                    : options.body
            });
        } catch (error) {
            throw new ApiError("Unable to reach HeritageX. Check your connection and try again.", 0, "NETWORK_ERROR", error);
        }

        if (response.status === 401 && mayRefresh && path !== "/auth/refresh" &&
            path !== "/auth/login" && path !== "/auth/register" && path !== "/auth/admin-login") {
            if (!refreshRequest) {
                refreshRequest = request("/auth/refresh", { method: "POST" }, false)
                    .finally(() => { refreshRequest = undefined; });
            }
            try {
                await refreshRequest;
                return requestEnvelope(path, options, false);
            } catch {
                // Keep the original endpoint's 401 so callers can handle sign-in consistently.
            }
        }

        const body = await readResponse(response);
        return body;
    }

    async function request(path, options = {}, mayRefresh = true) {
        const body = await requestEnvelope(path, options, mayRefresh);
        if (Array.isArray(body.data) && body.meta) {
            Object.defineProperty(body.data, "meta", { value: body.meta, configurable: true });
        }
        return body.data;
    }

    function normalizeSite(site) {
        if (!site || typeof site !== "object") return site;
        const category = typeof site.category === "object" && site.category
            ? site.category.name
            : (site.categoryName || site.category || "");
        return {
            ...site,
            category,
            image: site.image || site.images?.[0] || "",
            gallery: site.gallery || site.images || [],
            duration: site.duration || site.durationMinutes || 0,
            rating: Number(site.rating || 0),
            reviewCount: Number(site.reviewCount || 0),
            reviews: Array.isArray(site.reviews)
                ? site.reviews.map((review) => ({
                    ...review,
                    text: review.text || review.comment || "",
                    date: review.date || review.createdAt || ""
                }))
                : []
        };
    }

    const api = {
        baseUrl: API_BASE,
        ApiError,
        get: (path, options) => request(path, options),
        post: (path, body) => request(path, { method: "POST", body }),
        put: (path, body) => request(path, { method: "PUT", body }),
        delete: (path) => request(path, { method: "DELETE" }),
        getSites: async (params = {}) => {
            const query = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== "") query.set(key, value);
            });
            const result = await request(`/heritage${query.toString() ? `?${query}` : ""}`);
            return {
                data: (result || []).map(normalizeSite),
                meta: result?.meta || {}
            };
        },
        getSite: async (idOrSlug) => normalizeSite(await request(`/heritage/${encodeURIComponent(idOrSlug)}`)),
        getCategories: () => request("/categories"),
        normalizeSite,
        setCurrentUser(user) {
            window.HX_AUTH_USER = user || null;
            if (!window.HX_AUTH_USER) window.HX_SAVED_IDS = null;
            document.dispatchEvent(new CustomEvent("hx:auth-change", { detail: { user: window.HX_AUTH_USER } }));
        }
    };

    window.api = api;
})();
