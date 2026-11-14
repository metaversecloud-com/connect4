// Claiming a seat: the player one / player two buttons post to /api/select-player/:player (webhooks).
// Refused clicks never get an HTTP answer (EXP-448 #2), so those tests wait for the state instead.
import { ALICE, BOB, CAROL, KEY_ASSET_ID, SCENE_DROP_ID, expect, gameData, test } from "../../fixtures";

test("the first player to click a seat takes it and waits for an opponent", async ({ world }) => {
  await world.seed({ assetData: gameData({ p1: null, p2: null }) });

  const response = await world.select(ALICE, 1);

  expect(response?.ok()).toBe(true);
  expect(await world.game()).toMatchObject({
    playerCount: 1,
    player1: { claimedSpaces: [], profileId: ALICE.profileId, username: "Alice", visitorId: ALICE.visitorId },
    player2: { visitorId: null },
  });
  expect(await world.text("player1Text")).toBe("Alice");
  expect(await world.text()).toBe("Find a second player!");
  expect(await world.activities()).toEqual(["GAME_WAITING"]);
  expect((await world.events("set-activity"))[0].assetId).toBe(KEY_ASSET_ID);
  expect(await world.analytics()).toEqual([{ analyticName: "joins", profileId: ALICE.profileId, uniqueKey: ALICE.profileId }]);
});

test("the second player starts the game", async ({ world }) => {
  await world.seed({ assetData: gameData({ p2: null }) });

  const response = await world.select(BOB, 2);

  expect(response?.ok()).toBe(true);
  expect(await world.game()).toMatchObject({
    playerCount: 2,
    player1: { visitorId: ALICE.visitorId },
    player2: { claimedSpaces: [], profileId: BOB.profileId, username: "Bob", visitorId: BOB.visitorId },
    lastPlayerTurn: null,
  });
  expect(await world.text("player2Text")).toBe("Bob");
  expect(await world.text()).toBe("Let the game begin!");
  expect(await world.activities()).toEqual(["GAME_ON"]);
  expect(await world.analytics("joins")).toEqual([{ analyticName: "joins", profileId: BOB.profileId, uniqueKey: BOB.profileId }]);
});

test("the first click on a board without game state sets it up and links the scene to its key asset", async ({ world }) => {
  await world.seed({ assetData: {} });

  const response = await world.select(BOB, 2);

  expect(response?.ok()).toBe(true);
  expect(await world.game()).toMatchObject({
    keyAssetId: KEY_ASSET_ID,
    sceneDropId: SCENE_DROP_ID,
    isGameOver: false,
    columns: { 0: [], 6: [] },
    player1: { visitorId: null },
    player2: { visitorId: BOB.visitorId },
  });
  // Any clickable asset of the scene finds the key asset through the world data object from now on.
  expect((await world.state()).dataObject).toEqual({ [SCENE_DROP_ID]: { keyAssetId: KEY_ASSET_ID } });
});

test("a seat that's already taken can't be claimed by someone else", async ({ world }) => {
  await world.seed({ assetData: gameData({ p2: null }) });

  void world.select(CAROL, 1);

  await expect.poll(async () => (await world.game()).playerCount).toBe(2);
  expect(await world.game()).toMatchObject({ player1: { visitorId: ALICE.visitorId }, player2: { visitorId: null } });
  expect(await world.text()).toBe("Player 1 already selected.");
  expect(await world.text("player1Text")).toBe("Player One");
  expect(await world.analytics()).toEqual([]);
});

test("a player can't take both seats to play against themselves", async ({ world }) => {
  await world.seed({ assetData: gameData({ p2: null }) });

  void world.select(ALICE, 2);

  await expect.poll(async () => (await world.game()).playerCount).toBe(2);
  expect((await world.game()).player2).toMatchObject({ visitorId: null });
  expect(await world.text()).toBe("You are already player 1");
  expect(await world.activities()).toEqual([]);
});

test("a bystander can't take over a full game", async ({ world }) => {
  await world.seed({ assetData: gameData() });

  void world.select(CAROL, 2);

  await expect.poll(async () => (await world.game()).playerCount).toBe(3);
  expect((await world.game()).player2).toMatchObject({ visitorId: BOB.visitorId });
  expect(await world.text()).toBe("Player 2 already selected.");
});

test("a refused seat click still answers the webhook", async ({ world }) => {
  // Known bug: the refusal branch ends with `return console.log(...)` and never sends a response, so the
  // webhook request stays open until Topia gives up on it.
  test.fail(true, "EXP-448 #2: refused clicks never get an HTTP response");
  await world.seed({ assetData: gameData() });

  const response = await world.select(CAROL, 1, { timeout: 5_000 });

  expect(response, "no answer within 5s").not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
});

test("only seats 1 and 2 exist", async ({ world }) => {
  // Known bug: the seat number isn't checked. /select-player/3 stores a "player3" entry, records a join
  // and announces "Find a second player!", though nobody took a real seat.
  test.fail(true, "EXP-448 #4: seat number isn't validated");
  await world.seed({ assetData: gameData({ p1: null, p2: null }) });

  await world.select(CAROL, 3, { timeout: 3_000 });

  const game = await world.game();
  expect(Object.keys(game).filter((key) => key.startsWith("player")).sort()).toEqual(["player1", "player2", "playerCount"]);
  expect(await world.analytics("joins")).toEqual([]);
  expect(await world.activities()).toEqual([]);
});
