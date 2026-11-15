// Wins and draws: four in a row in every direction, the crown and particles, analytics, and the draw
// once the board is full.
import { BOARD_CENTER, ALICE, BOB, KEY_POSITION, expect, gameData, space, test } from "../../fixtures";
import { S3_BUCKET } from "../../app.config";
import type { TopiaWorld } from "../../fixtures";

const completions = [
  { analyticName: "completions", profileId: ALICE.profileId, uniqueKey: ALICE.profileId },
  { analyticName: "completions", profileId: BOB.profileId, uniqueKey: BOB.profileId },
];

/** What a win leaves behind: game over, the winner's text, a crown above their name and a crown particle on them. */
const expectWin = async (world: TopiaWorld, winner: typeof ALICE, side: -1 | 1) => {
  expect((await world.game()).isGameOver).toBe(true);
  expect(await world.text()).toBe(`${winner.username} wins!`);
  expect(await world.dropped("crown")).toEqual([
    expect.objectContaining({ layer0: `${S3_BUCKET}crown.png`, position: { x: KEY_POSITION.x + side * 400, y: KEY_POSITION.y - 580 } }),
  ]);
  expect(await world.events("particles")).toEqual([
    expect.objectContaining({ particleName: "crown_float", followPlayerId: winner.visitorId }),
  ]);
  expect(await world.analytics()).toEqual(completions);
};

const LINES = [
  { name: "vertical", grid: ["12.....", "12.....", "12....."], next: ALICE, column: 0, line: [0, 1, 2, 3].map((r) => space(0, r)) },
  { name: "horizontal", grid: ["222....", "111...."], next: ALICE, column: 3, line: [0, 1, 2, 3].map((c) => space(c, 0)) },
  {
    name: "rising diagonal",
    grid: ["..12...", ".122...", "1221..."],
    next: ALICE,
    column: 3,
    line: [0, 1, 2, 3].map((i) => space(i, i)),
  },
  {
    name: "falling diagonal",
    grid: ["...21..", "...221.", "...1221"],
    next: ALICE,
    column: 3,
    line: [0, 1, 2, 3].map((i) => space(3 + i, 3 - i)),
  },
];

for (const { name, grid, next, column, line } of LINES) {
  test(`four in a ${name} line win the game`, async ({ world }) => {
    await world.seedGame({ assetData: gameData({ grid, next }) });

    const response = await world.drop(ALICE, column);

    expect(response?.ok()).toBe(true);
    expect((await world.game()).player1.claimedSpaces).toEqual(expect.arrayContaining(line));
    await expectWin(world, ALICE, -1);
    expect(await world.analytics("ties")).toEqual([]);
  });
}

test("player two can win too, and gets the crown on their side", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: ["1.....2", "1.....2", "1.1...2"] }) });

  const response = await world.drop(BOB, 6);

  expect(response?.ok()).toBe(true);
  await expectWin(world, BOB, 1);
});

test("three in a row isn't a win", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ grid: ["12.....", "12....."] }) });

  await world.drop(ALICE, 0);

  expect((await world.game()).isGameOver).toBe(false);
  expect(await world.text()).toBe("It's Bob's turn");
  expect(await world.dropped("crown")).toEqual([]);
  expect(await world.analytics()).toEqual([]);
});

// A full board with no four in a row: 21 pieces each. Its top row is "2121212".
const FULL = ["2121212", "1211212", "2212111", "1122122", "2112211", "2221121"];

test("the game only ends in a draw once all 42 spaces are filled", async ({ world }) => {
  // Known bug: the draw check is `claimed spaces === 41`, so the game is called a draw after the 41st
  // piece while one space is still empty, and the 42nd can never be played.
  test.fail(true, "EXP-448 #1: draw declared with one space left");
  await world.seedGame({ assetData: gameData({ grid: ["..21212", ...FULL.slice(1)] }) });

  expect((await world.drop(ALICE, 1))?.ok()).toBe(true);
  expect((await world.game()).isGameOver).toBe(false);
  expect(await world.text()).toBe("It's Bob's turn");

  expect((await world.drop(BOB, 0))?.ok()).toBe(true);
  expect((await world.game()).isGameOver).toBe(true);
  expect(await world.text()).toBe("It's a draw! Press Reset to play again.");
  const tie = `${BOB.profileId}-${ALICE.profileId}`;
  expect(await world.analytics()).toEqual([
    { analyticName: "ties", profileId: ALICE.profileId, uniqueKey: tie },
    { analyticName: "ties", profileId: BOB.profileId, uniqueKey: tie },
    ...completions,
  ]);
  expect(await world.events("particles")).toEqual([
    expect.objectContaining({ particleName: "pastelConfetti_explosion", position: BOARD_CENTER }),
  ]);
  expect(await world.dropped("crown")).toEqual([]);
});

test("four in a row with the 41st piece is a win, not a draw", async ({ world }) => {
  // Known bug: the draw check runs before the win check, so a winning 41st piece is reported as a draw
  // (ties for both, no crown).
  test.fail(true, "EXP-448 #1: winning 41st piece reported as a draw");
  // 20 pieces each; column 5 is one short and Alice's piece there completes a line.
  await world.seedGame({ assetData: gameData({ grid: ["1.122.2", "1122112", "2211211", "1122212", "1212122", "1212121"] }) });

  expect((await world.drop(ALICE, 5))?.ok()).toBe(true);

  await expectWin(world, ALICE, -1);
  expect(await world.analytics("ties")).toEqual([]);
});

test("a whole game from claiming seats to a win", async ({ world }) => {
  await world.seedGame({ assetData: gameData({ p1: null, p2: null }) });

  expect((await world.select(ALICE, 1))?.ok()).toBe(true);
  expect((await world.select(BOB, 2))?.ok()).toBe(true);
  for (const [player, column] of [
    [ALICE, 0],
    [BOB, 1],
    [ALICE, 0],
    [BOB, 1],
    [ALICE, 0],
    [BOB, 1],
    [ALICE, 0],
  ] as const) {
    expect((await world.drop(player, column))?.ok(), `${player.username} drops into column ${column}`).toBe(true);
  }

  const game = await world.game();
  expect(game).toMatchObject({ isGameOver: true, turnCount: 7, lastPlayerTurn: ALICE.visitorId });
  expect(game.columns[0]).toEqual(Array(4).fill(ALICE.visitorId));
  expect(await world.dropped("claimedSpace")).toHaveLength(7);
  expect(await world.text()).toBe("Alice wins!");
  expect(await world.dropped("crown")).toHaveLength(1);
  expect(await world.activities()).toEqual(["GAME_WAITING", "GAME_ON"]);
  expect((await world.analytics()).map((a) => a.analyticName)).toEqual(["joins", "joins", "completions", "completions"]);
});
