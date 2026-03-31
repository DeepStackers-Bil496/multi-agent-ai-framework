import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from "dotenv";

config({
  path: ".env.local",
});

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;
const configuredWorkers = Number.parseInt(
  process.env.PLAYWRIGHT_WORKERS ?? "",
  10
);
const defaultWorkers =
  Number.isFinite(configuredWorkers) && configuredWorkers > 0
    ? configuredWorkers
    : 1;
const routeTraceMode =
  process.env.PLAYWRIGHT_ROUTE_TRACE === "True" ? "retain-on-failure" : "off";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests",
  /* Run tests in files in parallel */
  fullyParallel: false,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: 0,
  /* Opt out of parallel tests on CI. */
  workers: defaultWorkers,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
  },

  /* Configure global timeout for each test */
  timeout: 240 * 1000, // 120 seconds
  expect: {
    timeout: 240 * 1000,
  },

  /* Configure projects */
  projects: [
    {
      name: "e2e",
      testMatch: /e2e\/.*.test.ts/,
      use: {
        ...devices["Desktop Chrome"],
      },
    },
    {
      name: "routes",
      testMatch: /routes\/.*.test.ts/,
      use: {
        ...devices["Desktop Chrome"],
        trace: routeTraceMode,
        screenshot: "off",
        video: "off",
      },
    },
    {
      name: "performance",
      testDir: "./tests/performance",
      testMatch: "**/*.perf.test.ts",
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: "pnpm dev",
    url: `${baseURL}/ping`,
    timeout: 120 * 1000,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === "True",
    env: {
      ...process.env,
      BROWSERSLIST_IGNORE_OLD_DATA:
        process.env.BROWSERSLIST_IGNORE_OLD_DATA ?? "true",
      BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA:
        process.env.BASELINE_BROWSER_MAPPING_IGNORE_OLD_DATA ?? "true",
      PLAYWRIGHT: process.env.PLAYWRIGHT ?? "True",
    },
  },
});
