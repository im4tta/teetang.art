import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;

/**
 * Mobile end-to-end tests: `npm run test:mobile`. They build the app, serve the
 * production bundle and drive it on phone-sized viewports. External services
 * (map tiles, geocoding, fonts) are blocked in the tests so results do not
 * depend on the network.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Each test drives a full map editor; more workers than this starves the CPU.
  workers: 2,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "android-small",
      use: {
        browserName: "chromium",
        viewport: { width: 360, height: 740 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 12; SM-A125F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36",
      },
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
