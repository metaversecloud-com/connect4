import { APIRequestContext, APIResponse, test as base, expect } from "@playwright/test";
import { INTERACTIVE_KEY, MOCK_TOPIA_URL } from "./constants";

/**
 * Id of the dropped asset the app is opened from. Per world instead with test.use({ uniqueAssetId: true })
 * (then use world.assetId): apps that match SSE connections or caches by assetId alone would otherwise mix
 * up parallel tests, since real asset ids are globally unique.
 */
export const KEY_ASSET_ID = "key-asset";
export const SCENE_DROP_ID = "scene-1";
export const VISITOR_ID = 42;

// ---- Connect 4 board scene (README "Required Assets with Unique Names") ----

/** The key asset: the reset button an admin drops with uniqueName "reset". It holds the game state. */
export const KEY_UNIQUE_NAME = "reset";
export const KEY_POSITION = { x: 1000, y: 1000 };
/** generateBoard puts the board 300 above the key asset. */
export const BOARD_CENTER = { x: KEY_POSITION.x, y: KEY_POSITION.y - 300 };
export const DEFAULT_GAME_TEXT = "Click on a game piece on the left or right to begin!";

/** Space index on the 7x6 grid: column-major, row 0 at the bottom (README "Data Objects"). */
export const space = (column: number, row: number) => column * 6 + row;
/** Where a piece on that space is dropped (server/utils/getPosition.ts). */
export const spacePosition = (column: number, row: number) => ({
  x: KEY_POSITION.x + (column - 3) * 85,
  y: KEY_POSITION.y - 130 - row * 70,
});

/** The pieces generateBoard drops, as a board that's already been built, keyed by id. */
const boardPieces = () => {
  const piece = (id: string, uniqueName: string, extra: Record<string, unknown> = {}) => ({
    id,
    uniqueName,
    sceneDropId: SCENE_DROP_ID,
    position: BOARD_CENTER,
    dataObject: {},
    ...extra,
  });
  const pieces: Record<string, any> = {
    board: piece("board", "board"),
    "game-text": piece("game-text", "gameText", { text: DEFAULT_GAME_TEXT }),
    "player1-text": piece("player1-text", "player1Text", { text: "Player One" }),
    "player2-text": piece("player2-text", "player2Text", { text: "Player Two" }),
    "player1-button": piece("player1-button", "player1"),
    "player2-button": piece("player2-button", "player2"),
  };
  for (let column = 0; column < 7; column++) pieces[`selector-${column}`] = piece(`selector-${column}`, "selector");
  return pieces;
};

// ---- people ----

export type Person = { visitorId: number; profileId: string; username: string; isAdmin?: boolean };

/** Player one, player two, a bystander and an admin. VISITOR_ID (the platform tests' visitor) is "E2E Player". */
export const ALICE: Person = { visitorId: 1, profileId: "profile-alice", username: "Alice" };
export const BOB: Person = { visitorId: 2, profileId: "profile-bob", username: "Bob" };
export const CAROL: Person = { visitorId: 3, profileId: "profile-carol", username: "Carol" };
export const ADMIN: Person = { visitorId: 9, profileId: "profile-admin", username: "Admin", isAdmin: true };

const seat = (person: Person | null, claimedSpaces: number[]) =>
  person
    ? { claimedSpaces, profileId: person.profileId, username: person.username, visitorId: person.visitorId }
    : { claimedSpaces: [], profileId: null, username: null, visitorId: null };

/**
 * The key asset's game state (README "Data Objects"). `grid` draws the board top row first, one
 * 7-character row each: "1" = player one's piece, "2" = player two's, "." = empty. Missing top rows are
 * empty. `next` is who moves next (the app stores the opposite: lastPlayerTurn = who just moved); by
 * default player one moves when both have the same number of pieces.
 */
export const gameData = ({
  p1 = ALICE as Person | null,
  p2 = BOB as Person | null,
  grid = [] as string[],
  next = undefined as Person | undefined,
  ...rest
}: { p1?: Person | null; p2?: Person | null; grid?: string[]; next?: Person } & Record<string, unknown> = {}) => {
  const rows = [...Array(6 - grid.length).fill("......."), ...grid];
  const columns: Record<number, number[]> = {};
  const claimed: Record<string, number[]> = { "1": [], "2": [] };
  for (let column = 0; column < 7; column++) {
    columns[column] = [];
    for (let row = 0; row < 6; row++) {
      const cell = rows[5 - row][column];
      if (cell === ".") continue;
      if (columns[column].length !== row) throw new Error(`grid has a gap under column ${column}, row ${row}`);
      columns[column].push((cell === "1" ? p1 : p2)!.visitorId);
      claimed[cell].push(space(column, row));
    }
  }
  const pieces = claimed["1"].length + claimed["2"].length;
  let lastPlayerTurn: number | null = null;
  if (next && p1 && p2) lastPlayerTurn = next.visitorId === p1.visitorId ? p2.visitorId : p1.visitorId;
  else if (pieces > 0) lastPlayerTurn = claimed["1"].length > claimed["2"].length ? p1!.visitorId : p2!.visitorId;
  return {
    columns,
    isGameOver: false,
    isResetInProgress: false,
    keyAssetId: KEY_ASSET_ID,
    lastInteraction: new Date().toISOString(),
    lastPlayerTurn,
    playerCount: (p1 ? 1 : 0) + (p2 ? 1 : 0),
    player1: seat(p1, claimed["1"]),
    player2: seat(p2, claimed["2"]),
    resetCount: 0,
    sceneDropId: SCENE_DROP_ID,
    turnCount: pieces,
    ...rest,
  };
};


export type SeedOptions = {
  /** The platform tests' visitor (VISITOR_ID) is an admin. */
  isAdmin?: boolean;
  /** Visitor is standing inside the asset's zone. */
  inZone?: boolean;
  /**
   * The generated board (labels, seat buttons, 7 arrows) is in the scene. Default false here so the shared
   * platform specs see the boilerplate's world; Connect 4 tests use world.seedGame(), where it's true.
   */
  withBoard?: boolean;
  /** false = the dropped asset the app was opened from doesn't exist in the world. */
  withAsset?: boolean;
  /** Extra dropped-asset fields (assetName, topLayerURL, uniqueName, ...). */
  asset?: Record<string, unknown>;
  /** The dropped asset's data object. */
  assetData?: Record<string, unknown>;
  /** The world's data object. */
  worldData?: Record<string, unknown>;
  /** The visitor's data object (the same record as its user data object, like the real API). */
  visitorData?: Record<string, unknown>;
  /** Badges the visitor already owns. */
  badges?: string[];
  /**
   * Catalog items the visitor already owns (any type), by catalog id or name, with their quantity
   * (default 1) and the user item's own metadata (default {}). Unknown items fail the seed.
   */
  inventory?: OwnedItem[];
  /** Extra fields on the visitor (expressions: ["emote-wave"] it owns, username, ...). */
  visitor?: Record<string, unknown>;
  /**
   * Other players in the world, keyed by visitorId. Act as one with world.as(id) / world.apiAs(id, path).
   * Their default profileIds are unique per world; an explicit profileId is shared by every test that uses
   * it (user data objects are global in the mock), so derive it from the world: world.scopedId("alice").
   */
  otherVisitors?: Record<number, OtherVisitor>;
  /** Data objects of profiles that aren't in the world, keyed by profileId (use world.scopedId(...) keys). */
  users?: Record<string, Record<string, unknown>>;
  /**
   * The ecosystem inventory catalog (GET /inventory, grants) for this world. Default: mock-topia/catalog.json
   * if the app has one, else four Quiz badges. Useless for apps that cache the catalog process-wide (they
   * keep the first world's): give those a catalog.json instead.
   */
  inventoryItems?: InventoryItem[];
  /** Unlockable expressions (GET /expressions, grant-expression). Default: the mock's Wave and Dance. */
  expressions?: Array<{ id: string; name: string } & Record<string, unknown>>;
  /**
   * The world's user group data objects, as Visitor.fetchUserGroupDataObject returns them (default none).
   */
  userGroupDataObjects?: Array<Record<string, unknown>>;
  /** Extra fields for GET /world-details (World.fetchDetails); default { urlSlug, name, width, height }. */
  worldDetails?: Record<string, unknown>;
  /** Further dropped assets in the world, keyed by id (their `id` defaults to the key). */
  extraAssets?: Record<string, Record<string, unknown>>;
  /**
   * Scenes GET /scenes/:sceneId (Scene.get / fetchSceneById) knows, keyed by scene id (their `id` is the key).
   * Read from the caller's world (the InteractiveJWT's urlSlug); an unknown id answers 200 with a null body,
   * like the real getSceneById.
   */
  scenes?: Record<string, Record<string, unknown>>;
  /** Delay for every public-API call into the world, so concurrent requests overlap. */
  latencyMs?: number;
  /**
   * Delay for matching public-API calls only: { "<substring of 'METHOD /api/v1/...'>": ms }, e.g.
   * { "PUT /api/v1/world": 300 } or { "/visitors/42/set-data-object": 400 }. Adds to latencyMs. Calls
   * outside /world/ (inventory, user data objects, ...) count for the world in the caller's JWT.
   */
  delays?: Record<string, number>;
  /**
   * Fail matching public-API calls: { "<substring of 'METHOD /api/v1/...'>": status }, e.g.
   * { "grant-visitor-inventory-item": 500 }. Matched like delays; logged as "injected-failure" events.
   */
  failures?: Record<string, number>;
  /**
   * Data-object writes with a lockId take the lock first and hold it for their delay (latencyMs + delays),
   * like a real write that takes time, so a concurrent write with the same lockId gets 409. Default false:
   * the delay runs before the write, which takes and frees the lock at once.
   */
  holdLocksDuringDelay?: boolean;
};

/** Result of a webhook call: the response, or null if the app never answered. */
export type WebhookResult = APIResponse | null;

/** A catalog item a visitor owns: catalog id or name, quantity (default 1), user item metadata (default {}). */
export type OwnedItem = { item: string; quantity?: number; metadata?: Record<string, unknown> };

/**
 * Another player in the world. Defaults: profileId "<world.profileId>-v<id>", displayName "Player <id>",
 * username "player-<id>".
 */
export type OtherVisitor = {
  profileId?: string;
  displayName?: string;
  isAdmin?: boolean;
  /** Standing inside the asset's zone. Default true. */
  inZone?: boolean;
  visitorData?: Record<string, unknown>;
  badges?: string[];
  inventory?: OwnedItem[];
} & Record<string, unknown>;

/** An ecosystem inventory item as GET /inventory returns it. */
export type InventoryItem = {
  id: string;
  name: string;
  type: string;
  status?: string;
  description?: string;
  image_path?: string;
  metadata?: Record<string, unknown>;
} & Record<string, unknown>;

/** A visitor inventory entry shaped like GET get-visitor-inventory-items returns it. */
const ownedBadge = (name: string) => ({
  id: `owned-${name}`,
  item_id: `owned-${name}`,
  itemId: `owned-${name}`,
  name,
  type: "BADGE",
  image_url: "",
  quantity: 1,
  status: "ACTIVE",
  item: { id: `owned-${name}`, name, type: "BADGE", image_url: "" },
});

/** One isolated Topia world in mock-topia, plus helpers to open the app inside it. */
export class TopiaWorld {
  readonly displayName = "E2E Player";

  private others: Record<number, OtherVisitor> = {};

  constructor(
    readonly urlSlug: string,
    readonly profileId: string,
    private request: APIRequestContext,
    /** Id of the dropped asset the app is opened from (KEY_ASSET_ID unless the test uses uniqueAssetId). */
    readonly assetId = KEY_ASSET_ID,
  ) {}

  /**
   * A world with the Connect 4 scene: key asset (the reset button, uniqueName "reset") plus the generated
   * board unless withBoard: false. ALICE, BOB, CAROL and ADMIN are always in the world.
   */
  seedGame(options: SeedOptions = {}) {
    return this.seed({ withBoard: true, inZone: false, ...options });
  }

  async seed({
    isAdmin = false,
    inZone = true,
    withAsset = true,
    withBoard = false,
    asset = {},
    assetData = {},
    worldData = {},
    visitorData = {},
    badges = [],
    inventory = [],
    visitor = {},
    otherVisitors = {},
    users = {},
    inventoryItems,
    expressions,
    worldDetails,
    userGroupDataObjects,
    extraAssets = {},
    scenes,
    latencyMs = 0,
    delays = {},
    failures = {},
    holdLocksDuringDelay = false,
  }: SeedOptions = {}) {
    otherVisitors = {
      ...Object.fromEntries(
        [ALICE, BOB, CAROL, ADMIN].map(({ visitorId, ...person }) => [
          visitorId,
          { ...person, displayName: person.username, isAdmin: !!person.isAdmin, inZone: false },
        ]),
      ),
      ...otherVisitors,
    };
    this.others = otherVisitors;
    const assets: Record<string, any> = {
      ...(withBoard ? boardPieces() : {}),
      ...Object.fromEntries(Object.entries(extraAssets).map(([id, fields]) => [id, { id, ...fields }])),
    };
    if (withAsset) {
      assets[this.assetId] = {
        id: this.assetId,
        assetName: "Connect 4 reset button",
        position: KEY_POSITION,
        uniqueName: KEY_UNIQUE_NAME,
        sceneDropId: SCENE_DROP_ID,
        ...asset,
        dataObject: assetData,
      };
    }

    const response = await this.request.post(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`, {
      data: {
        dataObject: worldData,
        latencyMs,
        delays,
        failures,
        holdLocksDuringDelay,
        worldDetails,
        userGroupDataObjects,
        scenes,
        assets,
        users,
        inventoryItems,
        expressions,
        visitors: {
          ...Object.fromEntries(
            Object.entries(otherVisitors).map(
              ([
                id,
                {
                  inZone: zoned = true,
                  visitorData: data = {},
                  badges: owned = [],
                  inventory: items = [],
                  isAdmin: admin = false,
                  ...rest
                },
              ]) => [
                id,
                {
                  ...this.player(Number(id)),
                  // Real visitors always have one; the same as world.as(id) sends.
                  username: `player-${id}`,
                  isAdmin: admin,
                  landmarkZonesString: zoned ? Object.keys(assets).join(",") : "",
                  privateZoneId: "",
                  dataObject: data,
                  inventory: owned.map(ownedBadge),
                  ownedItems: items,
                  ...rest,
                },
              ],
            ),
          ),
          [VISITOR_ID]: {
            isAdmin,
            profileId: this.profileId,
            displayName: this.displayName,
            // The same as world.credentials() sends.
            username: "e2e-player",
            landmarkZonesString: inZone ? Object.keys(assets).join(",") : "",
            privateZoneId: "",
            dataObject: visitorData,
            inventory: badges.map(ownedBadge),
            ownedItems: inventory,
            ...visitor,
          },
        },
      },
    });
    if (!response.ok()) throw new Error(`Seeding mock world failed: ${response.status()} ${await response.text()}`);
  }

  /**
   * Replaces the injected failures mid-test (same format as seed's `failures`); no argument stops them,
   * e.g. to check the app recovers once Topia answers again.
   */
  async setFailures(failures: Record<string, number> = {}) {
    const response = await this.request.patch(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`, { data: { failures } });
    if (!response.ok()) throw new Error(`Changing mock failures failed: ${response.status()}`);
  }

  /**
   * An id unique to this world, e.g. an explicit profileId for otherVisitors or a `users` key: profiles are
   * global in the mock, so a fixed "alice" would be shared by every test running in parallel.
   */
  scopedId(name: string) {
    return `${this.profileId}-${name}`;
  }

  /** Changes visitor fields mid-test (moveTo, isAdmin, landmarkZonesString, ...). */
  async updateVisitor(fields: Record<string, unknown>, visitorId = VISITOR_ID) {
    const response = await this.request.patch(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}/visitors/${visitorId}`, {
      data: fields,
    });
    if (!response.ok()) throw new Error(`Updating mock visitor failed: ${response.status()}`);
  }

  async state() {
    const response = await this.request.get(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`);
    return (await response.json()) as {
      dataObject: Record<string, any>;
      assets: Record<string, any>;
      visitors: Record<string, any>;
      events: Array<Record<string, any>>;
      unhandled: string[];
    };
  }

  async assetData(assetId = this.assetId) {
    return (await this.state()).assets[assetId]?.dataObject;
  }

  /** The key asset's game state. */
  game() {
    return this.assetData(KEY_ASSET_ID);
  }

  async visitorData(visitorId = VISITOR_ID) {
    return (await this.state()).visitors[visitorId].dataObject;
  }

  /** A profile's user data object (for a visitor, the same record as visitorData). */
  async userData(profileId = this.profileId) {
    const response = await this.request.get(`${MOCK_TOPIA_URL}/__mock/users/${profileId}`);
    return (await response.json()).dataObject as Record<string, any>;
  }

  /** Objects in mock-topia's fake S3, from every test: filter by key. */
  async s3Objects() {
    const response = await this.request.get(`${MOCK_TOPIA_URL}/__mock/s3`);
    return (await response.json()) as Array<{ bucket: string; key: string; size: number; contentType?: string }>;
  }

  /** Identity of a player in this world: VISITOR_ID or one seeded with otherVisitors. */
  player(visitorId: number) {
    if (visitorId === VISITOR_ID) return { visitorId, profileId: this.profileId, displayName: this.displayName };
    const seeded = this.others[visitorId] ?? {};
    return {
      visitorId,
      profileId: seeded.profileId ?? `${this.profileId}-v${visitorId}`,
      displayName: seeded.displayName ?? `Player ${visitorId}`,
    };
  }

  /**
   * Credential overrides that make a request come from another player, with their own nonce like a
   * separate drawer: world.url("/", world.as(43)), world.credentials(world.as(43)).
   */
  as(who: number | Person): Record<string, string> {
    // Connect 4's people (ALICE, BOB, ...) share the main visitor's nonce, as the app's webhooks always did.
    if (typeof who === "object") {
      return {
        visitorId: String(who.visitorId),
        profileId: who.profileId,
        displayName: who.username,
        username: who.username,
        identityId: `identity-${who.username.toLowerCase()}`,
      };
    }
    const visitorId = who;
    if (visitorId === VISITOR_ID) return {};
    const { profileId, displayName } = this.player(visitorId);
    return {
      visitorId: String(visitorId),
      profileId,
      displayName,
      identityId: `identity-${visitorId}`,
      username: `player-${visitorId}`,
      interactiveNonce: `e2e-nonce-${this.urlSlug}-v${visitorId}`,
    };
  }

  /** App API path as another player's iframe calls it. */
  apiAs(visitorId: number, path: string, overrides: Record<string, string> = {}) {
    return this.api(path, { ...this.as(visitorId), ...overrides });
  }

  async events(type?: string) {
    const { events } = await this.state();
    return type ? events.filter((e) => e.type === type) : events;
  }

  /** Analytics the app recorded, as { analyticName, profileId, uniqueKey }. */
  async analytics(name?: string) {
    return (await this.events("analytics"))
      .filter((e) => !name || e.analyticName === name)
      .map(({ analyticName, profileId, uniqueKey }) => ({ analyticName, profileId, uniqueKey }));
  }

  /** World activities the app triggered (GAME_WAITING, GAME_ON), in order. */
  async activities() {
    return (await this.events("set-activity")).map((e) => e.webhookType as string);
  }

  /** Text currently shown by a text asset of the scene (gameText, player1Text, player2Text). */
  async text(uniqueName = "gameText") {
    const assets = Object.values((await this.state()).assets);
    return assets.find((a) => a.uniqueName === uniqueName && a.sceneDropId === SCENE_DROP_ID)?.text;
  }

  /** Dropped assets with this uniqueName (e.g. the claimedSpace pieces the app dropped). */
  async dropped(uniqueName: string) {
    return Object.values((await this.state()).assets).filter((a) => a.uniqueName === uniqueName);
  }

  /** Session credentials Topia sends in a webhook body (or appends to an iframe URL). */
  credentials(overrides: Record<string, string> = {}) {
    return new URLSearchParams({
      assetId: this.assetId,
      displayName: this.displayName,
      identityId: "identity-1",
      // Unique per world: apps that key state by nonce across worlds (SSE connections, caches) would
      // otherwise mix up parallel tests.
      interactiveNonce: `e2e-nonce-${this.urlSlug}`,
      interactivePublicKey: INTERACTIVE_KEY,
      profileId: this.profileId,
      sceneDropId: SCENE_DROP_ID,
      uniqueName: KEY_UNIQUE_NAME,
      urlSlug: this.urlSlug,
      username: "e2e-player",
      visitorId: String(VISITOR_ID),
      ...overrides,
    });
  }

  /** App page URL as Topia opens it in the iframe. */
  url(path = "/", overrides: Record<string, string> = {}) {
    return `${path}?${this.credentials(overrides)}`;
  }

  /** App API path carrying the session credentials, as the client's backendAPI sends them. */
  api(path: string, overrides: Record<string, string> = {}) {
    return `/api${path}?${this.credentials(overrides)}`;
  }

  /**
   * Fires the asset-click webhook Topia sends when `person` clicks a board piece: POST to the webhook URL
   * with the session credentials in the JSON body. Resolves to null if the app doesn't answer within
   * `timeout` (some refusals never answer, EXP-448 #2), so a test can still check state.
   */
  async webhook(
    path: string,
    person: Person,
    piece: Record<string, string>,
    { overrides = {}, timeout = 10_000 }: { overrides?: Record<string, string>; timeout?: number } = {},
  ): Promise<WebhookResult> {
    return this.request
      .post(`/api${path}`, {
        data: Object.fromEntries(this.credentials({ ...this.as(person), ...piece, ...overrides })),
        timeout,
      })
      .catch(() => null);
  }

  /** `person` clicks the player one or player two button. */
  select(person: Person, seatNumber: 1 | 2 | number | string, options?: Parameters<TopiaWorld["webhook"]>[3]) {
    return this.webhook(`/select-player/${seatNumber}`, person, { assetId: `player${seatNumber}-button`, uniqueName: `player${seatNumber}` }, options);
  }

  /** `person` clicks the arrow above a column. */
  drop(person: Person, column: number | string, options?: Parameters<TopiaWorld["webhook"]>[3]) {
    return this.webhook(`/click/${column}`, person, { assetId: `selector-${column}`, uniqueName: "selector" }, options);
  }

  /** `person` clicks the reset button (the key asset). */
  reset(person: Person, options?: Parameters<TopiaWorld["webhook"]>[3]) {
    return this.webhook("/reset", person, { assetId: KEY_ASSET_ID, uniqueName: KEY_UNIQUE_NAME }, options);
  }
}

// A 24x24 stand-in for the SDK style's CDN icons (stubSdkIcons).
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24"/></svg>';

export const test = base.extend<{ world: TopiaWorld; uniqueAssetId: boolean; stubSdkIcons: boolean }>({
  uniqueAssetId: [false, { option: true }],
  /**
   * test.use({ stubSdkIcons: true }) answers https://sdk-style.s3.amazonaws.com/icons/* with a 24x24 SVG
   * instead of aborting it. A button whose only content is such an icon is otherwise 0x0 and Playwright
   * can't click it (or use press() from helpers/press.ts).
   */
  stubSdkIcons: [false, { option: true }],
  // The browser may only talk to the app: anything else (CDNs, analytics, real Topia) is aborted, so a
  // test can't pass or flake on the network.
  context: async ({ context, stubSdkIcons }, use) => {
    await context.route(
      (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => route.abort(),
    );
    // Registered last, so it's matched first.
    if (stubSdkIcons) {
      await context.route("https://sdk-style.s3.amazonaws.com/icons/**", (route) =>
        route.fulfill({ contentType: "image/svg+xml", body: ICON_SVG }),
      );
    }
    await use(context);
  },
  world: async ({ request, uniqueAssetId }, use, testInfo) => {
    const id = `${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`.replace(/[^a-zA-Z0-9-]/g, "");
    const world = new TopiaWorld(
      `world-${id}`,
      `profile-${id}`,
      request,
      uniqueAssetId ? `key-asset-${id}` : KEY_ASSET_ID,
    );
    await use(world);

    // Fail the test if the app called a public-API endpoint the mock doesn't implement (e.g. after an
    // @rtsdk/topia upgrade): it would otherwise pass against a 501 the real API never returns.
    expect((await world.state()).unhandled, "public-API calls mock-topia doesn't implement").toEqual([]);
    const outside = await (await request.get(`${MOCK_TOPIA_URL}/__mock/unhandled`)).json();
    expect(outside, "public-API calls mock-topia doesn't implement").toEqual([]);
  },
});

export { expect } from "@playwright/test";
