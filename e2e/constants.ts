export const APP_PORT = Number(process.env.APP_PORT || 3100);
export const MOCK_TOPIA_PORT = Number(process.env.MOCK_TOPIA_PORT || 3101);
export const MOCK_TOPIA_URL = `http://localhost:${MOCK_TOPIA_PORT}`;
export const INTERACTIVE_KEY = "e2e-public-key";
// Distinctive on purpose: the platform tests fail if this string ever reaches the browser.
export const INTERACTIVE_SECRET = "e2e-interactive-secret-must-never-leak";
// Connect 4's webhook base URL and image bucket (env APP_URL / S3_BUCKET). Only ever used as strings.
export const APP_URL = "https://connect4.example.invalid/api/";
export const S3_BUCKET = "https://example.invalid/connect4/";
