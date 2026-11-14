// Per-app settings for the shared platform tests in tests/platform. Every app edits this file;
// the platform specs themselves stay identical across SDK apps.

/**
 * Bugs a route still has, each set to its tracking reason (e.g. "EXP-429: ..."). The matching
 * platform test is marked test.fail: it passes while the bug exists and fails once it's fixed, so
 * the entry is removed together with the fix. Leave out what the route doesn't have.
 */
export type KnownBugs = {
  /** The response contains the interactive secret or a signed InteractiveJWT. */
  leaksSecret?: string;
  /** A request without session credentials succeeds. */
  acceptsMissingCredentials?: string;
  /** Credentials signed for another app's public key are accepted. */
  acceptsForeignCredentials?: string;
  /** Bad credentials fail later on a Topia call instead of with a credential error. */
  unnamedCredentialError?: string;
};

export type RouteSpec = {
  method: "get" | "post" | "put" | "delete";
  /** Path under /api, without the query string. */
  path: string;
  data?: Record<string, unknown>;
  knownBugs?: KnownBugs;
};

// getCredentials (protected file) returns { error } instead of throwing, so every route that
// uses it has this bug until it's fixed there.
const GET_CREDENTIALS_DOESNT_THROW = "EXP-428 #6: getCredentials doesn't throw";

/**
 * API routes that read the session credentials (getCredentials). Each one must reject missing or
 * foreign credentials and must never send the interactive secret to the browser. List them all.
 * All three are webhooks of the board's assets (seat buttons, column arrows, reset button) and read the
 * credentials from the JSON body only. The platform tests send them in the query string, so for these
 * routes they check the missing-credentials case; foreign credentials and secrets in error responses
 * are covered with credentials in the body by tests/app/security.spec.ts.
 */
export const CREDENTIALED_ROUTES: RouteSpec[] = [
  { method: "post", path: "/select-player/1", knownBugs: { unnamedCredentialError: GET_CREDENTIALS_DOESNT_THROW } },
  { method: "post", path: "/click/3", knownBugs: { unnamedCredentialError: GET_CREDENTIALS_DOESNT_THROW } },
  { method: "post", path: "/reset", knownBugs: { unnamedCredentialError: GET_CREDENTIALS_DOESNT_THROW } },
];

/**
 * Page the app opens in its iframe; the platform tests load it with valid credentials. Connect 4 has no
 * page (no client/), so playwright.config.ts leaves out the two platform tests that load it.
 */
export const ENTRY_PAGE = "/";

/** Bugs seen when loading ENTRY_PAGE (only leaksSecret applies). */
export const ENTRY_PAGE_KNOWN_BUGS: Pick<KnownBugs, "leaksSecret"> = {};

/** Text the app shell's HTML must contain. Change it if the app isn't a React root (e.g. Unity). */
export const APP_SHELL_MARKER = 'id="root"';
