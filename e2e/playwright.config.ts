import { defineConfig, devices } from "@playwright/test";
import { APP_PORT, APP_URL, INTERACTIVE_KEY, INTERACTIVE_SECRET, MOCK_TOPIA_PORT, S3_BUCKET } from "./constants";

// E2E_APP_IMAGE=<image> runs the app from a Docker image (what ships, e.g. to test a Node upgrade)
// instead of local Node. The container reaches the mock on the host through host.docker.internal.
const APP_IMAGE = process.env.E2E_APP_IMAGE;
const mockHost = `${APP_IMAGE ? "host.docker.internal" : "localhost"}:${MOCK_TOPIA_PORT}`;

// The real app (production build) talks to an in-memory fake of the Topia public API.
// Explicit env wins over any developer ../.env because dotenv never overrides existing variables.
const appEnv = {
  PORT: APP_IMAGE ? "3000" : String(APP_PORT),
  NODE_ENV: "test",
  INSTANCE_DOMAIN: mockHost,
  INSTANCE_PROTOCOL: "http",
  INTERACTIVE_KEY,
  INTERACTIVE_SECRET,
  // Only used as strings: piece image URLs written onto dropped assets and the webhook URLs registered on
  // them. The server never fetches either.
  APP_URL,
  S3_BUCKET,
  TEXT_ASSET_ID: "textAsset",
  WEB_IMAGE_ASSET_ID: "webImageAsset",
  // Never let a test reach a real service: a win appends a row to Google Sheets only when a sheet id is set.
  GOOGLESHEETS_SHEET_ID: "",
  GOOGLESHEETS_CLIENT_EMAIL: "",
  GOOGLESHEETS_PRIVATE_KEY: "",
};

const imageEnvFlags = Object.entries(appEnv)
  // Single-quoted so JSON values survive the shell.
  .map(([key, value]) => `-e ${key}='${value}'`)
  .join(" ");

const appServer = APP_IMAGE
  ? {
      command: `docker run --rm --init --name sdk-app-e2e --add-host=host.docker.internal:host-gateway -p ${APP_PORT}:3000 ${imageEnvFlags} ${APP_IMAGE}`,
      // Never reuse a server already on the port: it wouldn't be the image under test.
      reuseExistingServer: false,
    }
  : {
      command: "npm run build --prefix .. && npm start --prefix ..",
      // The image bakes COMMIT_HASH in and runs in UTC; a local run has to provide both.
      env: { ...appEnv, COMMIT_HASH: "local", TZ: "UTC" },
      reuseExistingServer: !process.env.CI,
    };

export default defineConfig({
  testDir: "./tests",
  // Connect 4 has no client: it's driven entirely by asset-click webhooks on the canvas (README "Note"),
  // so the two platform tests that load the app's page don't apply. The spec files stay identical.
  grepInvert: /unknown pages fall back to the app shell|loading the app never sends the interactive secret/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node mock-topia/server.mjs",
      url: `http://localhost:${MOCK_TOPIA_PORT}/__mock/health`,
      env: { MOCK_TOPIA_PORT: String(MOCK_TOPIA_PORT), INTERACTIVE_KEY },
      reuseExistingServer: !process.env.CI,
    },
    {
      ...appServer,
      url: `http://localhost:${APP_PORT}/api/system/health`,
      timeout: 180_000,
    },
  ],
});
