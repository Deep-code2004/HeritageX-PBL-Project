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
    image: "/images/bhadra-fort.jpg",
    gallery: ["/images/bhadra-fort.jpg"],
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

async function mockApi(page: Page) {
    await page.route("**/api/**", async (route: Route) => {
        const url = new URL(route.request().url());
        const path = url.pathname.replace(/^\/api/, "");
        const json = (status: number, body: unknown) =>
            route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

        if (path === "/auth/me" || path === "/auth/refresh") {
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
        return json(404, {
            success: false,
            error: { code: "NOT_FOUND", message: "Not found." }
        });
    });
}

async function blockLeaflet(page: Page) {
    await page.route("https://unpkg.com/leaflet@*/dist/leaflet.js", (route) => route.abort());
}

test("guest can search the API catalogue, open a detail, and save it locally", async ({ page }) => {
    await mockApi(page);
    await blockLeaflet(page);
    await page.goto("/Pages/explore.html");

    await page.getByRole("searchbox", { name: "Search heritage sites" }).fill("Bhadra");
    await expect(page.getByRole("link", { name: "Bhadra Fort", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Save Bhadra Fort to your places" }).click();
    await page.goto("/Pages/saved.html");
    await expect(page.getByRole("heading", { name: "Bhadra Fort" })).toBeVisible();

    await page.goto("/Pages/detail.html?slug=bhadra-fort");
    await expect(page.getByRole("heading", { name: "Bhadra Fort", exact: true })).toBeVisible();
    await expect(page.getByRole("status")).toContainText("map library could not be loaded");
});

test("guest review submission sends the visitor to sign in and returns to the detail", async ({ page }) => {
    await mockApi(page);
    await blockLeaflet(page);
    await page.goto("/Pages/detail.html?slug=bhadra-fort");

    await page.getByRole("button", { name: "5 star" }).click();
    await page.getByLabel("Your review").fill("A lovely heritage visit.");
    await page.getByRole("button", { name: "Submit review" }).click();

    await expect(page).toHaveURL(/\/Pages\/account\.html\?returnTo=/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("map page explains a missing map library while retaining the nearby-list area", async ({ page }) => {
    await mockApi(page);
    await blockLeaflet(page);
    await page.goto("/Pages/map.html");

    await expect(page.getByRole("status")).toContainText("map library could not be loaded");
    await expect(page.getByLabel("Nearby heritage sites")).toContainText(
        "Map interaction is unavailable"
    );
});

test("account form controls switch accessibly between sign-in and registration", async ({ page }) => {
    await mockApi(page);
    await page.goto("/Pages/account.html");

    const register = page.getByRole("button", { name: "Create account" });
    await register.click();
    await expect(register).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
    await expect(page.getByLabel("Name")).toBeVisible();
});
