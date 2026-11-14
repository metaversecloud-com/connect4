import { APIRequestContext, APIResponse, test as base, expect } from "@playwright/test";
import { INTERACTIVE_KEY, MOCK_TOPIA_URL } from "./constants";

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
  /** false = the scene has no key asset. */
  withAsset?: boolean;
  /** false = only the key asset is in the scene: the board hasn't been generated yet. */
  withBoard?: boolean;
  /** Extra key-asset fields. */
  asset?: Record<string, unknown>;
  /** The key asset's data object (see gameData()). Empty = a freshly dropped key asset. */
  assetData?: Record<string, unknown>;
  /** The world's data object. */
  worldData?: Record<string, unknown>;
  /** Further dropped assets in the world, keyed by id. */
  extraAssets?: Record<string, Record<string, unknown>>;
};

/** Result of a webhook call: the response, or null if the app never answered. */
export type WebhookResult = APIResponse | null;

/** One isolated Topia world in mock-topia, plus helpers to fire the board's webhooks in it. */
export class TopiaWorld {
  readonly displayName = "E2E Player";

  constructor(
    readonly urlSlug: string,
    readonly profileId: string,
    private request: APIRequestContext,
  ) {}

  /** A world with the Connect 4 scene: key asset plus the generated board (labels, seat buttons, 7 arrows). */
  async seed({
    isAdmin = false,
    withAsset = true,
    withBoard = true,
    asset = {},
    assetData = {},
    worldData = {},
    extraAssets = {},
  }: SeedOptions = {}) {
    const assets: Record<string, any> = { ...(withBoard ? boardPieces() : {}), ...extraAssets };
    if (withAsset) {
      assets[KEY_ASSET_ID] = {
        id: KEY_ASSET_ID,
        assetName: "Connect 4 reset button",
        position: KEY_POSITION,
        uniqueName: KEY_UNIQUE_NAME,
        sceneDropId: SCENE_DROP_ID,
        ...asset,
        dataObject: assetData,
      };
    }

    const visitor = (person: { profileId: string; username: string; isAdmin?: boolean }) => ({
      isAdmin: !!person.isAdmin,
      profileId: person.profileId,
      displayName: person.username,
      username: person.username,
      landmarkZonesString: "",
      privateZoneId: "",
      dataObject: {},
      inventory: [],
    });
    const visitors: Record<number, any> = {
      [VISITOR_ID]: visitor({ profileId: this.profileId, username: this.displayName, isAdmin }),
    };
    for (const person of [ALICE, BOB, CAROL, ADMIN]) visitors[person.visitorId] = visitor(person);

    const response = await this.request.post(`${MOCK_TOPIA_URL}/__mock/worlds/${this.urlSlug}`, {
      data: { dataObject: worldData, assets, visitors },
    });
    if (!response.ok()) throw new Error(`Seeding mock world failed: ${response.status()}`);
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

  async assetData(assetId = KEY_ASSET_ID) {
    return (await this.state()).assets[assetId]?.dataObject;
  }

  /** The key asset's game state. */
  game() {
    return this.assetData(KEY_ASSET_ID);
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
      assetId: KEY_ASSET_ID,
      displayName: this.displayName,
      identityId: "identity-1",
      interactiveNonce: "e2e-nonce",
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

  /** Credential overrides for one of the seeded people. */
  as(person: Person) {
    return {
      visitorId: String(person.visitorId),
      profileId: person.profileId,
      displayName: person.username,
      username: person.username,
      identityId: `identity-${person.username.toLowerCase()}`,
    };
  }

  /** App page URL as Topia opens it in an iframe (Connect 4 has none; kept for the platform tests). */
  url(path = "/", overrides: Record<string, string> = {}) {
    return `${path}?${this.credentials(overrides)}`;
  }

  /** App API path carrying the session credentials in the query string. */
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

export const test = base.extend<{ world: TopiaWorld }>({
  // The browser may only talk to the app: anything else (CDNs, analytics, real Topia) is aborted, so a
  // test can't pass or flake on the network.
  context: async ({ context }, use) => {
    await context.route(
      (url) => !["localhost", "127.0.0.1"].includes(url.hostname),
      (route) => route.abort(),
    );
    await use(context);
  },
  world: async ({ request }, use, testInfo) => {
    const id = `${testInfo.testId}-${testInfo.repeatEachIndex}-${testInfo.retry}`.replace(/[^a-zA-Z0-9-]/g, "");
    const world = new TopiaWorld(`world-${id}`, `profile-${id}`, request);
    await use(world);

    // Fail the test if the app called a public-API endpoint the mock doesn't implement (e.g. after an
    // @rtsdk/topia upgrade): it would otherwise pass against a 501 the real API never returns.
    expect((await world.state()).unhandled, "public-API calls mock-topia doesn't implement").toEqual([]);
    const outside = await (await request.get(`${MOCK_TOPIA_URL}/__mock/unhandled`)).json();
    expect(outside, "public-API calls mock-topia doesn't implement").toEqual([]);
  },
});

export { expect } from "@playwright/test";
