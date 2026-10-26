import { expect, test, type Page, type Route } from "@playwright/test";

const site = {
    id: 1,
    slug: "bhadra-fort",
    name: "Bhadra Fort",
    category: "Historical Monuments",
    categoryName: "Historical Monuments",
    tags: ["Sultanate Era"],
    interests: ["history"],
    shortDescription: "A heritage fort in Ahmedabad.",
    history: "Founded in 1411.",
    architecture: "Sultanate architecture.",
    image: "",
    gallery: [],
    latitude: 23.0225,
    longitude: 72.5825,
    rating: 4.4,
    reviewCount: 10,
    duration: "45–60 min",
    timings: "Daily",
    entryFee: "Free",
    nearby: [],
    nearbyPlaces: [],
    responsibleGuidelines: ["Respect the site."],
    verified: true,
    source: "HeritageX",
    reviews: []
};

async function mockApi(page: Page, { authenticated = false } = {}) {
    const requests: Array<{ method: string; path: string; body?: unknown }> = [];
    await page.route("https://**/*", (route) => route.abort());
    await page.addInitScript(() => {
        window.HX_API_BASE_URL = `${window.location.origin}/api`;
    });
    await page.route("**/api/**", async (route: Route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/, "");
        let requestBody: unknown;
        try {
            requestBody = route.request().postDataJSON();
        } catch {
            requestBody = undefined;
        }
        requests.push({ method: route.request().method(), path, body: requestBody });
        const json = (status: number, body: unknown) =>
            route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

        if (path === "/auth/me" && authenticated) {
            return json(200, {
                success: true,
                data: { user: { id: "test-visitor", name: "Test Visitor", email: "visitor@example.test" } }
            });
        }
        if (path === "/auth/me") {
            return json(200, { success: true, data: { user: null } });
        }
        if (path === "/auth/refresh") {
            return json(401, {
                success: false,
                error: { code: "UNAUTHENTICATED", message: "Sign in required." }
            });
        }
        if (path === "/categories") {
            return json(200, { success: true, data: [{ name: site.category, siteCount: 1 }] });
        }
        if (path === "/heritage/bhadra-fort") {
            return json(200, { success: true, data: site });
        }
        if (path === "/heritage") {
            return json(200, {
                success: true,
                data: [site],
                meta: { total: 1, page: 1, limit: 50, totalPages: 1 }
            });
        }
        if (path === "/saved" && route.request().method() === "GET") {
            return json(200, { success: true, data: [] });
        }
        if (path.startsWith("/saved/") || path === "/saved/merge" ||
            path === "/itineraries/merge" || /^\/heritage\/\d+\/reviews$/.test(path)) {
            return json(200, { success: true, data: { id: "mock-result" } });
        }
        return json(404, {
            success: false,
            error: { code: "NOT_FOUND", message: "Not found." }
        });
    });
    return requests;
}

async function mockGoogleMaps(page: Page) {
    await page.addInitScript(() => {
        Object.assign(window, { HX_GOOGLE_MAPS_API_KEY: "playwright-restricted-browser-key" });
    });
    await page.route("https://maps.googleapis.com/maps/api/js**", async (route) => {
        const callback = new URL(route.request().url()).searchParams.get("callback");
        await route.fulfill({
            contentType: "application/javascript",
            body: `
                window.__hxGoogleMapMarkers = 0;
                window.google = { maps: {
                    SymbolPath: { CIRCLE: "circle" },
                    MapTypeId: { ROADMAP: "roadmap" },
                    Map: class {
                        constructor(element, options) {
                            element.dataset.googleMapsLoaded = "true";
                            this.options = options;
                        }
                        setCenter(position) { this.center = position; }
                        setZoom(zoom) { this.zoom = zoom; }
                        fitBounds() {}
                    },
                    Marker: class {
                        constructor(options) {
                            this.options = options;
                            window.__hxGoogleMapMarkers += 1;
                        }
                        addListener() {}
                        setMap(map) { this.options.map = map; }
                        getPosition() { return this.options.position; }
                    },
                    InfoWindow: class {
                        setContent(content) { this.content = content; }
                        open() {}
                    },
                    Polyline: class { constructor(options) { this.options = options; } },
                    LatLngBounds: class { extend() {} }
                } };
                window[${JSON.stringify(callback)}]();
            `
        });
    });
}

async function mockAdminApi(page: Page) {
    const requests: Array<{ path: string; method: string }> = [];
    await page.route("https://**/*", (route) => route.abort());
    await page.addInitScript(() => {
        sessionStorage.setItem("heritagex_admin_session", JSON.stringify({ adminAuthenticated: true }));
    });
    await page.route("**/api/**", async (route: Route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/, "");
        requests.push({ path: `${path}${url.search}`, method: route.request().method() });
        const json = (status: number, body: unknown) =>
            route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
        if (path === "/auth/me") {
            return json(200, {
                success: true,
                data: { user: { id: "test-admin", name: "Test Admin", email: "admin@example.test", role: "ADMIN" } }
            });
        }
        if (path === "/categories") {
            return json(200, { success: true, data: [{ name: "Historical Monuments", siteCount: 1 }] });
        }
        if (path === "/admin/analytics") {
            return json(200, {
                success: true,
                data: {
                    stats: { total: 1, verified: 1, pending: 0, categories: 1, pendingSites: 0, averageRating: 4.4, totalReviews: 10 },
                    categoryChart: { labels: ["Historical Monuments"], data: [1], colors: ["#6E1E24"] },
                    ratingChart: { labels: ["Historical Monuments"], data: [4.4] },
                    breakdown: [{ category: "Historical Monuments", sites: 1, verified: 1, avgRating: 4.4, totalReviews: 10 }]
                }
            });
        }
        if (path === "/admin/audit") {
            return json(200, {
                success: true,
                data: [{ action: "UPDATE_SITE", entity: "HeritageSite", entityId: "1", createdAt: "2026-10-21T10:00:00.000Z" }]
            });
        }
        if (path === "/admin/heritage") {
            return json(200, {
                success: true,
                data: [{ ...site, verification: "VERIFIED" }],
                meta: { page: Number(url.searchParams.get("page") || 1), limit: 25, total: 1, totalPages: 1 }
            });
        }
        return json(200, { success: true, data: [] });
    });
    return requests;
}

test("guest can search the API catalogue, open a detail, and save it locally", async ({ page }) => {
    await mockApi(page);
    await page.goto("/Pages/explore.html");

    await expect(page.locator("#resultsGrid")).toContainText("Bhadra Fort");
    await page.getByRole("searchbox", { name: "Search heritage sites" }).fill("Bhadra");
    await expect(page.getByRole("link", { name: "Bhadra Fort" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Save Bhadra Fort to your places" }).click();
    await page.goto("/Pages/saved.html");
    await expect(page.getByRole("heading", { name: "Bhadra Fort" })).toBeVisible();

    await page.goto("/Pages/detail.html?slug=bhadra-fort");
    await expect(page.getByRole("heading", { name: "Bhadra Fort", exact: true })).toBeVisible();
    await expect(page.locator("#detailMapStatus")).toContainText("Google Maps is not configured");
});

test("guest review submission sends the visitor to sign in and returns to the detail", async ({ page }) => {
    await mockApi(page);
    await page.goto("/Pages/detail.html?slug=bhadra-fort");

    await page.getByRole("button", { name: "5 star" }).click();
    await page.getByLabel("Your review").fill("A lovely heritage visit.");
    await page.getByRole("button", { name: "Submit review" }).click();

    await expect(page).toHaveURL(/\/Pages\/account\.html\?returnTo=/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("map page explains missing Google Maps configuration and retains the nearby site list", async ({ page }) => {
    await mockApi(page);
    await page.goto("/Pages/map.html");

    await expect(page.getByRole("status")).toContainText("Google Maps is not configured");
    await expect(page.getByLabel("Nearby heritage sites")).toContainText("Bhadra Fort");
});

test("map explorer initializes Google Maps and renders API-backed markers", async ({ page }) => {
    await mockApi(page);
    await mockGoogleMaps(page);
    await page.goto("/Pages/map.html");

    await expect(page.locator("#map")).toHaveAttribute("data-google-maps-loaded", "true");
    await expect(page.locator("#mapStatus")).toContainText("Showing 1 verified heritage site");
    await expect(page.locator("#nearbyList")).toContainText("Bhadra Fort");
    await expect.poll(() => page.evaluate(() =>
        (window as Window & { __hxGoogleMapMarkers: number }).__hxGoogleMapMarkers
    )).toBe(1);
});

test("home, walks, and itinerary explain missing Google Maps configuration without errors", async ({ page }) => {
    await mockApi(page);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/");
    await expect(page.locator("#homeMapStatus")).toContainText("Google Maps is not configured");

    await page.goto("/Pages/heritage-walks.html");
    await expect(page.locator("#walkMapStatus-0"))
        .toContainText("Google Maps is not configured");

    await page.goto("/Pages/itinerary.html");
    await expect(page.locator("#itineraryMapStatus"))
        .toContainText("Add a stop to preview your route");
    expect(pageErrors).toEqual([]);
});

test("late Google Maps authorization failures update map status accessibly", async ({ page }) => {
    await mockApi(page);
    await mockGoogleMaps(page);
    await page.goto("/Pages/map.html");

    await expect(page.locator("#map")).toHaveAttribute("data-google-maps-loaded", "true");
    await page.evaluate(() => (window as Window & { gm_authFailure: () => void }).gm_authFailure());
    await expect(page.locator("#mapStatus")).toContainText("Google Maps rejected the API key");
});

test("account form controls switch accessibly between sign-in and registration", async ({ page }) => {
    await mockApi(page);
    await page.goto("/Pages/account.html");

    const register = page.getByRole("group", { name: "Choose account action" })
        .getByRole("button", { name: "Create account" });
    await register.click();
    await expect(register).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
});

test("admin site management filters API results and shows review-weighted summary statistics", async ({ page }) => {
    const requests = await mockAdminApi(page);
    await page.goto("/admin/sites.html");

    await expect(page.getByRole("heading", { name: "Manage heritage sites" })).toBeVisible();
    await expect(page.locator("#statAverageRating")).toHaveText("4.4");
    await expect(page.locator("#statTotalReviews")).toHaveText("10");
    await expect(page.locator("#sitesTableBody")).toContainText("Bhadra Fort");

    await page.getByRole("searchbox", { name: "Search sites" }).fill("Bhadra");
    await page.getByLabel("Filter by verification status").selectOption("VERIFIED");
    await page.getByRole("button", { name: "Apply" }).click();

    await expect.poll(() => requests.some(({ path }) =>
        path.includes("q=Bhadra") && path.includes("verification=VERIFIED")
    )).toBe(true);
    await expect(page.locator("#sitesPageSummary")).toContainText("Page 1 of 1");
});

test("admin dashboard displays recent activity without exposing audit metadata", async ({ page }) => {
    await mockAdminApi(page);
    await page.goto("/admin/dashboard.html");

    await expect(page.getByRole("heading", { name: "Recent admin activity" })).toBeVisible();
    await expect(page.locator("#auditLogBody")).toContainText("UPDATE_SITE");
    await expect(page.locator("#auditLogBody")).toContainText("HeritageSite");
});

test("signed-in visitor actions are sent to the API and confirm successful review submission", async ({ page }) => {
    const requests = await mockApi(page, { authenticated: true });
    await page.goto("/Pages/detail.html?slug=bhadra-fort");
    await expect(page.getByRole("heading", { name: "Bhadra Fort", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save Place" }).click();
    await expect.poll(() => requests.some((request) =>
        request.method === "POST" && request.path === "/saved/1"
    )).toBe(true);

    await page.getByRole("button", { name: "Add to Trip" }).click();
    await expect.poll(() => requests.some((request) =>
        request.method === "POST" && request.path === "/itineraries/merge"
    )).toBe(true);

    await page.getByRole("button", { name: "5 star" }).click();
    await page.getByLabel("Your review").fill("A lovely heritage visit.");
    await page.getByRole("button", { name: "Submit review" }).click();
    await expect(page.locator("#reviewMessage"))
        .toContainText("submitted and is awaiting moderation");
    expect(requests).toContainEqual(expect.objectContaining({
        method: "POST",
        path: "/heritage/1/reviews",
        body: { rating: 5, comment: "A lovely heritage visit." }
    }));
});
