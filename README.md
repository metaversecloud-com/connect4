<div align="center">
<img src="https://global-uploads.webflow.com/62e7004a0f9b3a63b980ac3c/62e70c84dd3aac06fb2ac2b6_topia-logo-blue-2x.png" style="width: 120px; margin-bottom: 20px" alt="Topia logo">
</div>

# Connect 4

## Introduction / Summary

Connect 4 renders a fully-playable 7×6 grid **on the Topia canvas itself** — no drawer, no React UI. An admin drops a single key asset with `uniqueName: "reset"` and the app auto-generates a board (background, status text, two player-name labels, two claim buttons, and seven column drop arrows) as scene-scoped dropped assets. Each column arrow and each player-selection button fires an `assetClicked` webhook back to this server; the server validates the turn against key-asset data-object state, stacks the appropriate piece PNG at the bottom of the requested column, and runs win/draw detection.

> **Note:** this app is intentionally client-less — it is a **server-only reference implementation** for turn-based on-canvas games (same shape as `sdk-tictactoe`). There is no `client/` directory, no drawer, and no admin panel. All state and rendering flow through Topia dropped assets and webhooks.

## Key Features

### Canvas elements & interactions

- **Key asset (the "reset button"):** placed manually by an admin with `uniqueName: "reset"`. Clicking it triggers `handleResetBoard` — admins may force a full rebuild at any time; the two active players may reset any time; a non-player non-admin may only reset after 5+ minutes of inactivity.
- **Auto-generated board (`generateBoard.ts`):** on the very first reset click (`wasDataObjectInitialized === true`) the server drops the board PNG, `gameText` label, the two player-name labels, the two player-selection buttons, and seven `selector` arrow assets — each `selector` gets an `assetClicked` webhook to `${APP_URL}click/{0..6}`, and each `playerN` button gets a webhook to `${APP_URL}select-player/{1|2}`.
- **Claim a slot:** clicking `player1` or `player2` claims that seat for the caller and updates the corresponding name label.
- **Drop a piece:** clicking the arrow above a column drops a `claimedSpace` piece at the bottom of that column (stacked via `columns[column].length`). Column full at 6.
- **Crown:** on a win, a `crown` asset is dropped above the winner's name label and a `crown_float` particle fires on the winner's visitor.
- **World activities:** `GAME_WAITING` fires when the first player claims a slot; `GAME_ON` when the second joins.

### Drawer content

None — this app has no drawer UI.

### Admin features

None outside the reset gate: `handleResetBoard` inspects `Visitor.isAdmin`. Admins can force a full rebuild (delete every asset in the current `sceneDropId` except the one with `uniqueName: "reset"`, then re-run `generateBoard`) even while a game is in progress or a reset was never touched.

### Themes

None. There is a single palette and a single set of PNGs served from `S3_BUCKET`.

## Required Assets with Unique Names

Only one asset needs to be placed manually — everything else is generated. Assets are scoped by `sceneDropId` (not by an `assetId_*` prefix as in `sdk-tictactoe`), so multiple Connect 4 boards can coexist in the same world only if they live in distinct scene drops.

| Unique Name    | Count | Placed by | Description                                                                                                                   |
| -------------- | ----- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `reset`        | 1     | Manually  | The key asset. `getDroppedAssetDataObject` finds it via `world.fetchDroppedAssetsBySceneDropId({ uniqueName: "reset" })`.     |
| `board`        | 1     | The app   | Board background image (`${S3_BUCKET}board.png`).                                                                             |
| `gameText`     | 1     | The app   | Main status message (text asset).                                                                                             |
| `player1Text`  | 1     | The app   | Player 1 name label (text asset).                                                                                             |
| `player2Text`  | 1     | The app   | Player 2 name label (text asset).                                                                                             |
| `player1`      | 1     | The app   | Player 1 selection button (`${S3_BUCKET}player1.png`); webhook → `/api/select-player/1`.                                      |
| `player2`      | 1     | The app   | Player 2 selection button (`${S3_BUCKET}player2.png`); webhook → `/api/select-player/2`.                                      |
| `selector`     | 7     | The app   | Column drop arrows (`${S3_BUCKET}selector.png`), one per column, all sharing this uniqueName; webhooks → `/api/click/{0..6}`. |
| `claimedSpace` | 0–42  | The app   | Player pieces stacked on the board during play (`layer0` = `${S3_BUCKET}player1.png` or `player2.png`).                       |
| `crown`        | 0–1   | The app   | Victory crown dropped above the winner's name label (`${S3_BUCKET}crown.png`).                                                |

## Technical Architecture

### Data Objects

#### Key Asset (`GameDataType`)

Primary source of truth for game state. Set on first initialization from `defaultGameData` (`constants.ts`) and mutated by every controller.

```ts
{
  columns: { 0: visitorId[], 1: [...], 2: [...], 3: [...], 4: [...], 5: [...], 6: [...] };
  isGameOver: boolean;
  isResetInProgress: boolean;
  keyAssetId: string;
  lastInteraction: Date | null;
  lastPlayerTurn: number | null;                  // visitorId of the player who just moved
  playerCount: number;                            // monotonically incremented on every selection attempt
  player1: { claimedSpaces: number[]; profileId; username; visitorId } | { ...nulls };
  player2: { claimedSpaces: number[]; profileId; username; visitorId } | { ...nulls };
  resetCount: number;
  sceneDropId: string;
  turnCount: number;                              // monotonically incremented on every drop attempt (valid or not)
}
```

Spaces on the 7×6 grid are indexed 0–41 (column-major: 0–5 is column 0, 6–11 is column 1, …, 36–41 is column 6). `claimedSpaces` on each player is the flat list of indices they own; `columns[c]` is a stack of `visitorId` markers used to compute the next fill height.

#### World (`WorldDataObjectType`)

Keyed by `sceneDropId` so any clickable asset in the scene can find its key asset without re-scanning the world:

```ts
{
  [sceneDropId: string]: {
    keyAssetId: string;
  };
}
```

Written on first look-up in `getDroppedAssetDataObject` (via `world.setDataObject` or `world.updateDataObject`).

#### Visitor

Not used as a persistent store. `Visitor.get` is called in the auth middleware to prove the caller exists in the world, and again in `handleResetBoard` to read `visitor.isAdmin`. `Visitor.create(...).triggerParticle(...)` is used for the `crown_float` on the winner.

## API Endpoints

All routes mount under `/api`. All game routes pass through `auth` middleware (Topia interactive-key credentials via `getCredentials(req.body)`; the request must include `interactiveNonce`, `interactivePublicKey`, `urlSlug`, `visitorId`).

| Method | Route                        | Purpose                                                                                                                                                                                                                                                       |
| ------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/api/select-player/:player` | Claim seat 1 or 2 for the calling visitor (`handlePlayerSelection`). Fires `GAME_WAITING` on first join, `GAME_ON` on second.                                                                                                                                 |
| `POST` | `/api/click/:column`         | Drop a piece into column 0–6 for the calling visitor (`handleDropPiece`). Runs win/draw detection.                                                                                                                                                            |
| `POST` | `/api/reset`                 | Reset the board (`handleResetBoard`). On very first call for a scene it initializes the data object and runs `generateBoard`; otherwise it wipes all scene-scoped dropped assets (except the `reset` key), re-initializes state, and re-runs `generateBoard`. |
| `GET`  | `/api/system/health`         | Version, server start date, and a boolean-ish report of the env vars in use (public).                                                                                                                                                                         |

**Concurrency locks** (all issued via `updateDataObject({}, { lock: {...} })`):

| Handler                 | Lock id shape                                                         | Collision response                               |
| ----------------------- | --------------------------------------------------------------------- | ------------------------------------------------ |
| `handleDropPiece`       | `${keyAssetId}-${resetCount}-${turnCount}`                            | HTTP 409 "Move already in progress."             |
| `handlePlayerSelection` | `${keyAssetId}-${visitorId}-${playerCount}-${5sBucket}`               | HTTP 409 "Player selection already in progress." |
| `handleResetBoard`      | `${assetId}-${resetCount}-${10sBucket}` (on `isResetInProgress` flip) | HTTP 409 "Reset already in progress."            |

**No SSE / WebSocket / polling:** all real-time updates flow through Topia's server-side `updateDataObject` and dropped-asset mutations — clients see canvas changes as they happen.

## Analytics

Fired via the SDK `analytics: [...]` option on `updateDataObject`, plus an optional Google Sheets append on completion.

| Event         | Fired when                                                                                                               | uniqueKey                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `joins`       | A visitor successfully claims Player 1 or Player 2 (`handlePlayerSelection`).                                            | `profileId`                                         |
| `ties`        | Both players, when the board fills without a winner (draw branch of `handleDropPiece`, triggered on the 41st placement). | `${bigger.profileId}-${smaller.profileId}` (shared) |
| `completions` | Both players, on a win **or** a tie.                                                                                     | each player's own `profileId`                       |
| `resets`      | Every successful reset (`handleResetBoard`, on `resetCount` increment).                                                  | none                                                |

**Google Sheets:** on a **win only**, `addNewRowToGoogleSheets` appends one `completions` row (`identityId`, `displayName`, `"Connect 4"`, `event`, `urlSlug`) to `GOOGLESHEETS_SHEET_ID` at range `GOOGLESHEETS_SHEET_RANGE` (default `Sheet1`). Skipped silently if `GOOGLESHEETS_SHEET_ID` is unset.

**Particles:**

| Particle                   | Scope                     | Fired on |
| -------------------------- | ------------------------- | -------- |
| `crown_float`              | Visitor (winner)          | Win      |
| `pastelConfetti_explosion` | World, above board center | Draw     |

## Environment Variables

Create a `.env` at the app root. See `.env-example` for a template. `checkEnvVariables()` in `src/index.ts` hard-fails startup if any of `APP_URL`, `S3_BUCKET`, `INTERACTIVE_KEY`, or `INTERACTIVE_SECRET` is missing.

| Variable                    | Description                                                                                                                                       | Required |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `APP_URL`                   | Public base URL that generated webhooks target (`${APP_URL}click/N`, `${APP_URL}select-player/N`). Trailing slash required.                       | Yes      |
| `S3_BUCKET`                 | S3 URL prefix (e.g. `https://sdk-connect4.s3.amazonaws.com/`) that serves `board.png`, `player1.png`, `player2.png`, `selector.png`, `crown.png`. | Yes      |
| `INTERACTIVE_KEY`           | Topia interactive app key.                                                                                                                        | Yes      |
| `INTERACTIVE_SECRET`        | Topia interactive app secret. Also passed to `World.deleteDroppedAssets` on reset.                                                                | Yes      |
| `INSTANCE_DOMAIN`           | Topia API domain (`api.topia.io` for prod, `api-stage.topia.io` for stage). Defaults to `api.topia.io`.                                           | No       |
| `INSTANCE_PROTOCOL`         | `https` for prod/stage; `http` only for local. Defaults to `https`.                                                                               | No       |
| `PORT`                      | Server port. Defaults to `3000`.                                                                                                                  | No       |
| `NODE_ENV`                  | Toggles verbose error logging in `errorHandler`.                                                                                                  | No       |
| `TEXT_ASSET_ID`             | Asset template id for text labels. Defaults to `textAsset`.                                                                                       | No       |
| `WEB_IMAGE_ASSET_ID`        | Asset template id for image drops. Defaults to `webImageAsset`.                                                                                   | No       |
| `COMMIT_HASH`               | Reported by `/system/health` for deploy tracking.                                                                                                 | No       |
| `GOOGLESHEETS_CLIENT_EMAIL` | Google service-account email for optional completion logging.                                                                                     | No       |
| `GOOGLESHEETS_PRIVATE_KEY`  | Google service-account private key (`\n` escapes are unescaped at load).                                                                          | No       |
| `GOOGLESHEETS_SHEET_ID`     | Sheet id to append `completions` rows to on wins. If unset, Sheets logging is skipped entirely.                                                   | No       |
| `GOOGLESHEETS_SHEET_RANGE`  | Sheet range. Defaults to `Sheet1`.                                                                                                                | No       |

### Where to find `INTERACTIVE_KEY` and `INTERACTIVE_SECRET`

- [Topia Dev Account Dashboard](https://dev.topia.io/t/dashboard/integrations)
- [Topia Production Account Dashboard](https://topia.io/t/dashboard/integrations)

## Getting Started

```bash
# from the app root
npm install

# create a .env at the app root (see Environment Variables above)
cp .env-example .env

# development (watch mode)
npm run dev

# production
npm run build
npm start
```

## For Developers

### Setup flow in a world

1. Drop the key asset into a scene and set its `uniqueName` to `reset`.
2. Click it once as an admin. Because there is no world/keyAsset state yet, `handleResetBoard` takes the `wasDataObjectInitialized` early-return branch, seeds `defaultGameData` on the key asset, records `{ [sceneDropId]: { keyAssetId } }` on the world, and calls `generateBoard` to lay down the board, labels, player buttons, and 7 column arrows.
3. All subsequent clicks on the auto-generated arrows/buttons flow through webhooks back to `/api/*`.

### App-specific notes

- **`sceneDropId`-scoped, not uniqueName-prefixed.** Unlike `sdk-tictactoe`, Connect 4 does **not** prefix generated assets with the key asset's id. Every asset shares a flat `uniqueName` (`board`, `gameText`, `selector`, …) and multi-board disambiguation relies entirely on `sceneDropId` scoping through `fetchDroppedAssetsBySceneDropId`. Two Connect 4 boards should therefore live in **distinct scene drops**.
- **Column indexing & piece stacking:** `handleDropPiece` computes `columnStart = column * 6` and `claimedSpace = columnStart + columns[column].length`, then looks up the world-space `(x, y)` for that index in `getPosition.ts`.
- **Win detection (`getGameStatus.ts`):** enumerates 69 four-in-a-row combos over the 42-space grid — 21 vertical (within-column), 24 horizontal (across columns at the same row), and 24 diagonal (12 down-right + 12 up-right). Any subset match wins.
- **Reset gate:** admin OR either active player → always allowed. Non-admin non-player → allowed only when `lastInteraction` is older than 5 minutes (idle-timeout). First-ever click short-circuits to board generation.
- **Admin rebuild wipes everything except `reset`:** `world.fetchDroppedAssetsBySceneDropId({ sceneDropId })` → filter out `uniqueName === "reset"` → `World.deleteDroppedAssets` → re-run `generateBoard`.
- **turnCount is always incremented,** including on invalid moves (wrong turn, full column, non-player click, game already over). This keeps the drop-piece lock id monotonic per key asset.
- **Global process guards:** `unhandledRejection` and `uncaughtException` are logged (not crashed) except for fatal non-`ERR_HTTP_HEADERS_SENT` exceptions.

### Helpful links

- [SDK Developer docs](https://metaversecloud-com.github.io/mc-sdk-js/index.html)
- View it in action: [Dev](https://topia.io/connect4-dev), [Prod](https://topia.io/connect4-prod)
- [Notion One Pager](https://app.notion.com/p/topiaio/Connect4-469a8deed60e44f1bd149466d8a3f6b0?v=71f6c3828d3b4f33960326f9bde24781)
