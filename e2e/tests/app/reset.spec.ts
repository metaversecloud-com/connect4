// The reset button (the key asset) posts to /api/reset: the first click builds the board, later clicks
// rebuild it from scratch. Players and admins may reset any time, others only after 5 idle minutes.
import { ADMIN, ALICE, BOARD_CENTER, BOB, CAROL, DEFAULT_GAME_TEXT, KEY_ASSET_ID, KEY_POSITION, SCENE_DROP_ID, expect, gameData, test } from "../../fixtures";
import { APP_URL, S3_BUCKET } from "../../app.config";
import type { TopiaWorld } from "../../fixtures";

const IN_PROGRESS = ["12.....", "12....."];
const SIX_MINUTES_AGO = () => new Date(Date.now() - 6 * 60 * 1000).toISOString();

/** Pieces of the game in progress, plus a piece of another Connect 4 board (another scene) in the same world. */
const leftovers = {
  "piece-1": { id: "piece-1", uniqueName: "claimedSpace", sceneDropId: SCENE_DROP_ID },
  "piece-2": { id: "piece-2", uniqueName: "claimedSpace", sceneDropId: SCENE_DROP_ID },
  "other-board-piece": { id: "other-board-piece", uniqueName: "claimedSpace", sceneDropId: "scene-2" },
};

/** The board generateBoard drops: background, status text, name labels, seat buttons and 7 column arrows. */
const expectFreshBoard = async (world: TopiaWorld) => {
  const one = async (uniqueName: string) => {
    const assets = await world.dropped(uniqueName);
    expect(assets, uniqueName).toHaveLength(1);
    return assets[0];
  };
  expect(await one("board")).toMatchObject({ layer1: `${S3_BUCKET}board.png`, position: BOARD_CENTER, sceneDropId: SCENE_DROP_ID });
  expect(await one("gameText")).toMatchObject({ text: DEFAULT_GAME_TEXT, position: { x: BOARD_CENTER.x, y: BOARD_CENTER.y - 375 } });
  expect(await one("player1Text")).toMatchObject({ text: "Player One", position: { x: KEY_POSITION.x - 400, y: BOARD_CENTER.y - 130 } });
  expect(await one("player2Text")).toMatchObject({ text: "Player Two", position: { x: KEY_POSITION.x + 400, y: BOARD_CENTER.y - 130 } });
  expect(await one("player1")).toMatchObject({ layer1: `${S3_BUCKET}player1.png` });
  expect(await one("player2")).toMatchObject({ layer1: `${S3_BUCKET}player2.png` });
  const arrows = await world.dropped("selector");
  expect(arrows.map((a) => a.position.x).sort((a, b) => a - b)).toEqual([-255, -170, -85, 0, 85, 170, 255].map((dx) => BOARD_CENTER.x + dx));
  expect(await world.dropped("claimedSpace")).toEqual(
    expect.not.arrayContaining([expect.objectContaining({ sceneDropId: SCENE_DROP_ID })]),
  );
  expect(await world.dropped("crown")).toEqual([]);
};

/** Each seat button and column arrow gets an assetClicked webhook back to the app. */
const expectWebhooks = async (world: TopiaWorld) => {
  const webhooks = await world.events("webhooks");
  expect(webhooks.map((w) => w.url).sort()).toEqual(
    ["select-player/1", "select-player/2", ...[0, 1, 2, 3, 4, 5, 6].map((c) => `click/${c}`)].map((path) => `${APP_URL}${path}`).sort(),
  );
  for (const webhook of webhooks) expect(webhook).toMatchObject({ webhookType: "assetClicked", shouldSetClickType: true });
};

test("the first click on a freshly dropped key asset builds the board", async ({ world }) => {
  await world.seedGame({ withBoard: false });

  const response = await world.reset(CAROL);

  expect(response?.ok()).toBe(true);
  expect(await response!.json()).toEqual({ message: "Game created successfully" });
  expect(await world.game()).toMatchObject({
    keyAssetId: KEY_ASSET_ID,
    sceneDropId: SCENE_DROP_ID,
    isGameOver: false,
    isResetInProgress: false,
    lastPlayerTurn: null,
    player1: { visitorId: null },
    player2: { visitorId: null },
    resetCount: 0,
    turnCount: 0,
  });
  expect((await world.state()).dataObject).toEqual({ [SCENE_DROP_ID]: { keyAssetId: KEY_ASSET_ID } });
  await expectFreshBoard(world);
  await expectWebhooks(world);
  expect(await world.analytics()).toEqual([]);
});

test("a player's reset clears the board and starts a new game", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS }), extraAssets: leftovers });

  const response = await world.reset(ALICE);

  expect(response?.ok()).toBe(true);
  expect(await response!.json()).toEqual({ message: "Game reset successfully" });
  const { assets } = await world.state();
  for (const id of ["piece-1", "piece-2", "board", "game-text", "selector-0", "player1-button"]) expect(assets[id], id).toBeUndefined();
  // Only this scene is cleared: the key asset and the other board stay.
  expect(assets[KEY_ASSET_ID]).toBeDefined();
  expect(assets["other-board-piece"]).toBeDefined();
  await expectFreshBoard(world);
  await expectWebhooks(world);
  const game = await world.game();
  expect(game).toMatchObject({
    isGameOver: false,
    isResetInProgress: false,
    lastPlayerTurn: null,
    player1: { visitorId: null, claimedSpaces: [] },
    player2: { visitorId: null, claimedSpaces: [] },
    resetCount: 1,
    turnCount: 0,
    keyAssetId: KEY_ASSET_ID,
  });
  expect(Object.values(game.columns)).toEqual(Array(7).fill([]));
  expect(await world.analytics()).toEqual([{ analyticName: "resets", profileId: undefined, uniqueKey: undefined }]);
});

test("an admin can reset a game they aren't playing", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS }), extraAssets: leftovers });

  const response = await world.reset(ADMIN);

  expect(response?.ok()).toBe(true);
  expect((await world.game()).player1.visitorId).toBeNull();
  expect((await world.state()).assets["piece-1"]).toBeUndefined();
});

test("a bystander can't reset a game that's being played", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS }), extraAssets: leftovers });

  const response = await world.reset(CAROL);

  expect(response?.ok()).toBe(false);
  expect(JSON.stringify(await response!.json())).toContain("You must be either a player or admin to reset the board");
  const game = await world.game();
  expect(game).toMatchObject({ player1: { visitorId: ALICE.visitorId }, player2: { visitorId: BOB.visitorId }, isResetInProgress: false });
  expect(game.columns[0]).toHaveLength(2);
  expect((await world.state()).assets["piece-1"]).toBeDefined();
  expect(await world.analytics()).toEqual([]);
});

test("claiming to be an admin in the request doesn't let a bystander reset", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS }) });

  const response = await world.reset(CAROL, { overrides: { isAdmin: "true" } });

  expect(response?.ok()).toBe(false);
  expect((await world.game()).player1.visitorId).toBe(ALICE.visitorId);
});

test("a refused reset leaves the status text as it was", async ({ world }) => {
  // Known bug: the refusal path restores the status text to the "Click on a game piece..." start text,
  // so the board stops showing whose turn it is in the middle of a game.
  test.fail(true, "EXP-448 #6: refused reset overwrites the status text");
  await world.seedGame({
    assetData: gameData({ grid: IN_PROGRESS }),
    extraAssets: { "game-text": { id: "game-text", uniqueName: "gameText", sceneDropId: SCENE_DROP_ID, text: "It's Alice's turn" } },
  });

  await world.reset(CAROL);

  expect(await world.text()).toBe("It's Alice's turn");
});

test("a bystander can reset a board nobody has touched for 5 minutes", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS, lastInteraction: SIX_MINUTES_AGO() }), extraAssets: leftovers });

  const response = await world.reset(CAROL);

  expect(response?.ok()).toBe(true);
  expect((await world.game()).player1.visitorId).toBeNull();
  await expectFreshBoard(world);
});

test("two resets at once leave exactly one board", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS }), extraAssets: leftovers });

  const responses = await Promise.all([world.reset(ALICE), world.reset(BOB)]);

  // Usually the second one hits the reset lock (409) or fails on the status text the first one already
  // deleted; if it reads after the first one finished it's simply a second reset. Either way: one board.
  expect(responses.some((r) => r?.ok())).toBe(true);
  await expectFreshBoard(world);
  expect(await world.game()).toMatchObject({ isResetInProgress: false, player1: { visitorId: null }, turnCount: 0 });
});

test("a bystander can't build a second board by sending another asset's id to /reset", async ({ world }) => {
  // Known bug: /reset uses the assetId from the request as the key asset. Any other asset of the scene
  // (here the board background) has no game state yet, so the app takes the "first click" branch, skips
  // the permission check and drops a whole second board with its webhooks.
  test.fail(true, "EXP-448 #7: /reset trusts the request's assetId");
  await world.seedGame({ assetData: gameData({ grid: IN_PROGRESS }) });

  await world.webhook("/reset", CAROL, { assetId: "board", uniqueName: "board" });

  expect(await world.dropped("board")).toHaveLength(1);
  expect(await world.dropped("selector")).toHaveLength(7);
  expect(await world.events("webhooks")).toEqual([]);
});
