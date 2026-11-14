# End-to-end tests

Playwright tests that drive the real app (production build of the server). Connect 4 has no client: every
interaction is an `assetClicked` webhook from a board asset, so the tests fire those webhooks directly.
The server's `@rtsdk/topia` calls go to `mock-topia/server.mjs`, an in-memory fake of the Topia public
API, so no Topia credentials, world or network access are needed. The PR check (`E2E`) runs them on
every push; see `.github/workflows/e2e.yml` (managed by Terraform in config_texts).

## Run

```bash
npm install                      # app deps, repo root
cd e2e
npm install
npx playwright install chromium
npm test                         # builds the app, starts the mock + app, runs all specs
npm run test:ui                  # interactive mode
```

Against the Docker image instead of local Node (what ships; needs Docker):

```bash
e2e/scripts/test-image.sh        # image exactly as the Dockerfile builds it
e2e/scripts/test-image.sh 24     # --build-arg NODE_VERSION=24, fails unless the image runs Node 24
```

Ports: app `3100`, mock `3101` (override with `APP_PORT` / `MOCK_TOPIA_PORT`).

## Layout

| Path | What it is | When forking into a new app |
|---|---|---|
| `tests/platform/` | Checks every SDK app must pass: health endpoint contract, app shell fallback, credential checks, the interactive secret never reaching the browser | Keep identical; only edit `app.config.ts` |
| `app.config.ts` | The app's credentialed API routes, their known bugs, the entry page and the app shell marker | List every route that calls `getCredentials`; set `APP_SHELL_MARKER` if the page isn't a React root |
| `tests/app/` | Connect 4 tests: claiming seats (`join`), turns (`moves`), wins in every direction and draws (`endings`), building and resetting the board (`reset`), forged webhooks, columns outside the board and simultaneous clicks (`security`) | Replace with tests for the app's own pages and rules |
| `fixtures.ts` | `world.seed({...})` builds one isolated Topia world per test with the scene (key asset `reset` plus the generated board) and four people (`ALICE`, `BOB`, `CAROL`, `ADMIN`); `gameData({ grid })` builds the key asset's game state from a drawn board; `world.select()` / `world.drop()` / `world.reset()` send the webhooks the seat buttons, column arrows and reset button send (credentials in the JSON body) | Extend `seed` for the app's data objects |
| `mock-topia/server.mjs` | Fake Topia public API. Like the real one, world routes reject calls with neither an API key nor an interactive JWT carrying a nonce | Add routes for any endpoint the app calls that isn't there |

Every test gets its own world, so the suite runs fully in parallel. Each test also fails if the app
calls a public-API endpoint the mock doesn't implement, so an `@rtsdk/topia` upgrade that starts using
new endpoints can't pass silently. A full app example lives in sdk-quiz (`e2e/tests`).

## What the mock mirrors

- `GET /world/:slug/assets/:id` returns the asset with its `dataObject`, like the real API (`DroppedAsset.get` fills `droppedAsset.dataObject` from it).
- Data-object writes (`set`, `update` and `increment-data-object-value`, on world, asset, visitor and user) honour `lock`: a held `lockId` answers 409, `releaseLock: true` frees it after the write, otherwise it stays held. Locks are per data object.
- `analytics` sent with a successful write are logged as `analytics` events; `particles` events carry `particleName`.
- Visitor inventory entries have the real top-level fields (`name`, `image_url`, `type`, `item_id`, `itemId`, `quantity`, `status`) plus the nested `item`. Granting an owned item adds to its quantity.
- `PATCH /__mock/worlds/:slug/visitors/:id` (`world.updateVisitor({...})`) changes visitor fields mid-test. Route handlers may be async.
- The browser may only reach localhost: `fixtures.ts` aborts every other request.

### Extensions other apps added

Not in the boilerplate because they're app-specific. Copy from the PR when an app needs one.

| Extension | PR |
|---|---|
| Fake S3 (uploads) | sdk-scavenger-hunt#56, sdk-quest#53 |
| Fake Redis (`mock-redis/`) and scenes | sdk-race#53 |
| NPCs and expressions | virtual-pet#54 |
| JWT signature checks, multi-app and ecosystem data objects, `latencyMs` | sdk-leaderboard#13 |
| `set-custom-text` | sdk-tictactoe#41 |

## Connect 4 specifics

- No page: `playwright.config.ts` leaves out the two platform tests that load the app's page (`grepInvert`);
  the platform spec files themselves are unchanged.
- The webhook routes read credentials from the body only. The platform credential tests send them in the
  query string, so they effectively check the missing-credentials case; `app/security.spec.ts` covers
  foreign keys and secrets in error responses with credentials in the body.
- Refused clicks never get an HTTP answer (EXP-448 #2), so tests for refusals poll the game state instead
  of awaiting the response.

## Known bugs

Tests for bugs that still exist are marked `test.fail(...)`: they pass while the bug is there and
fail with "Expected to fail, but passed" once it's fixed, so the marker is removed in the same change
as the fix. In `tests/platform/` the markers come from `knownBugs` on each route in `app.config.ts`.

| Test | Bug | Tracked in |
|---|---|---|
| `platform/credentials.spec.ts` "names the credential problem" | `getCredentials` returns `{ error }` instead of throwing. | EXP-428 #6 |
| `app/security.spec.ts` "credentials signed for another app's public key are rejected" | `getCredentials` never checks the public key. | EXP-428 #6 |
| `app/endings.spec.ts` "only ends in a draw once all 42 spaces are filled", "the 41st piece is a win" | Draw declared at 41 pieces, before the win check. | EXP-448 #1 |
| `app/join.spec.ts`, `app/moves.spec.ts` "a refused … still answers the webhook" | Refusals end with `return console.log(...)`, no response. | EXP-448 #2 |
| `app/security.spec.ts` "at the same time" seat claims (2) | The seat lock is per visitor. | EXP-448 #3 |
| `app/join.spec.ts` "only seats 1 and 2 exist" | Seat number isn't validated. | EXP-448 #4 |
| `app/moves.spec.ts` "when player two moves first…" | Turn text computed before the move. | EXP-448 #5 |
| `app/reset.spec.ts` "a refused reset leaves the status text as it was" | Refusal restores the start text. | EXP-448 #6 |
| `app/reset.spec.ts` "can't build a second board by sending another asset's id" | `/reset` trusts the request's `assetId`. | EXP-448 #7 |

The interactive secret leak (EXP-429) doesn't apply: no route returns SDK objects and error responses
don't carry the secret (`app/security.spec.ts` "error responses never carry the interactive secret").

## Conventions

- New tests are mutation-checked: break the behavior in the app and confirm the test goes red.
- Before merging, `npx playwright test --repeat-each=3` must pass every time.
