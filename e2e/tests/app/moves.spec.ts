// Taking turns: the arrow above each column posts to /api/click/:column (webhook) when clicked.
// Refused moves never get an HTTP answer (EXP-448 #2), so those tests wait for the state instead.
import { ALICE, BOB, CAROL, SCENE_DROP_ID, expect, gameData, space, spacePosition, test } from "../../fixtures";
import { INTERACTIVE_KEY, S3_BUCKET } from "../../constants";
import type { TopiaWorld } from "../../fixtures";

/** Waits until the app has recorded a refused move (it bumps turnCount last). */
const refused = async (world: TopiaWorld, turnCount: number) =>
  expect.poll(async () => (await world.game()).turnCount).toBe(turnCount);

test("player one's move drops their piece at the bottom of the column and passes the turn", async ({ world }) => {
  await world.seed({ assetData: gameData({ next: ALICE }) });

  const response = await world.drop(ALICE, 3);

  expect(response?.ok()).toBe(true);
  expect(await response!.json()).toEqual({ message: "Move successfully made." });
  const game = await world.game();
  expect(game.columns[3]).toEqual([ALICE.visitorId]);
  expect(game).toMatchObject({
    player1: { claimedSpaces: [space(3, 0)] },
    player2: { claimedSpaces: [] },
    lastPlayerTurn: ALICE.visitorId,
    turnCount: 1,
    isGameOver: false,
  });
  expect(await world.dropped("claimedSpace")).toEqual([
    expect.objectContaining({
      layer0: `${S3_BUCKET}player1.png`,
      position: spacePosition(3, 0),
      sceneDropId: SCENE_DROP_ID,
      isInteractive: true,
      interactivePublicKey: INTERACTIVE_KEY,
    }),
  ]);
  expect(await world.text()).toBe("It's Bob's turn");
  expect(await world.analytics()).toEqual([]);
  expect(await world.dropped("crown")).toEqual([]);
});

test("pieces stack on top of the ones already in the column", async ({ world }) => {
  await world.seed({ assetData: gameData({ grid: ["2......", "1......"] }) });

  const response = await world.drop(ALICE, 0);

  expect(response?.ok()).toBe(true);
  const game = await world.game();
  expect(game.columns[0]).toEqual([ALICE.visitorId, BOB.visitorId, ALICE.visitorId]);
  expect(game.player1.claimedSpaces).toEqual([space(0, 0), space(0, 2)]);
  expect(await world.dropped("claimedSpace")).toEqual([expect.objectContaining({ position: spacePosition(0, 2) })]);
});

test("player two's move drops their own piece", async ({ world }) => {
  await world.seed({ assetData: gameData({ grid: ["...1..."] }) });

  const response = await world.drop(BOB, 4);

  expect(response?.ok()).toBe(true);
  expect(await world.game()).toMatchObject({ player2: { claimedSpaces: [space(4, 0)] }, lastPlayerTurn: BOB.visitorId });
  expect(await world.dropped("claimedSpace")).toEqual([
    expect.objectContaining({ layer0: `${S3_BUCKET}player2.png`, position: spacePosition(4, 0) }),
  ]);
  expect(await world.text()).toBe("It's Alice's turn");
});

test("a player can't move twice in a row", async ({ world }) => {
  await world.seed({ assetData: gameData({ grid: ["...1..."] }) });

  void world.drop(ALICE, 0);

  await refused(world, 2);
  const game = await world.game();
  expect(game.columns[0]).toEqual([]);
  expect(game).toMatchObject({ lastPlayerTurn: ALICE.visitorId, player1: { claimedSpaces: [space(3, 0)] } });
  expect(await world.dropped("claimedSpace")).toEqual([]);
  expect(await world.text()).toBe("It's Bob's turn");
});

test("nothing can be dropped into a full column", async ({ world }) => {
  await world.seed({ assetData: gameData({ grid: ["2......", "1......", "2......", "1......", "2......", "1......"] }) });

  void world.drop(ALICE, 0);

  await refused(world, 7);
  expect((await world.game()).columns[0]).toHaveLength(6);
  expect((await world.game()).player1.claimedSpaces).toHaveLength(3);
  expect(await world.dropped("claimedSpace")).toEqual([]);
  expect(await world.text()).toBe("Cannot place your move here");
});

test("someone who isn't playing can't move", async ({ world }) => {
  await world.seed({ assetData: gameData({ next: ALICE }) });

  void world.drop(CAROL, 3);

  await refused(world, 1);
  expect((await world.game()).columns[3]).toEqual([]);
  expect(await world.dropped("claimedSpace")).toEqual([]);
  expect(await world.text()).toBe("Game in progress");
});

test("nobody can move before both players have joined", async ({ world }) => {
  await world.seed({ assetData: gameData({ p2: null }) });

  void world.drop(ALICE, 3);

  await refused(world, 1);
  expect((await world.game()).columns[3]).toEqual([]);
  expect(await world.text()).toBe("Two players are needed to get started");
});

test("nobody can move once the game is over", async ({ world }) => {
  await world.seed({ assetData: gameData({ grid: ["1......", "12.....", "12.....", "12....."], isGameOver: true }) });

  void world.drop(BOB, 1);

  await refused(world, 8);
  expect((await world.game()).columns[1]).toHaveLength(3);
  expect(await world.dropped("claimedSpace")).toEqual([]);
  expect(await world.text()).toBe("Game over! Press Reset to play again");
});

test("nobody can move while a reset is in progress", async ({ world }) => {
  await world.seed({ assetData: gameData({ next: ALICE, isResetInProgress: true }) });

  const response = await world.drop(ALICE, 3);

  expect(response?.ok()).toBe(false);
  expect(await world.game()).toMatchObject({ turnCount: 0, columns: { 3: [] } });
  expect(await world.dropped("claimedSpace")).toEqual([]);
});

test("a refused move still answers the webhook", async ({ world }) => {
  // Known bug: every refusal branch ends with `return console.log(...)` and never sends a response, so
  // the webhook request stays open until Topia gives up on it.
  test.fail(true, "EXP-448 #2: refused clicks never get an HTTP response");
  await world.seed({ assetData: gameData({ next: ALICE }) });

  const response = await world.drop(CAROL, 3, { timeout: 5_000 });

  expect(response, "no answer within 5s").not.toBeNull();
  expect(response!.status()).toBeLessThan(500);
});

test("when player two moves first, the board says it's player one's turn", async ({ world }) => {
  // Known bug: the turn text is computed from lastPlayerTurn before the move. On a fresh game
  // (lastPlayerTurn null) whoever moves first is shown as the next player, so after Bob's opening move
  // the board reads "It's Bob's turn".
  test.fail(true, "EXP-448 #5: wrong turn text after player two's opening move");
  await world.seed({ assetData: gameData() });

  const response = await world.drop(BOB, 3);

  expect(response?.ok()).toBe(true);
  expect(await world.text()).toBe("It's Alice's turn");
});
