import { defineConfig, devices } from "@playwright/test";

const frontendServer = process.platform === "win32"
    ? "py -m http.server 8000"
    : "python3 -m http.server 8000";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:8000",
        trace: "retain-on-failure",
        ...devices["Desktop Chrome"]
    },
    webServer: {
        command: frontendServer,
        url: "http://127.0.0.1:8000",
        reuseExistingServer: !process.env.CI,
        timeout: 30_000
    }
});
