// Requests a player can send by hand or at the same time: forged webhook bodies, columns outside the
// board, simultaneous clicks, and secrets in error responses.
import { INTERACTIVE_SECRET } from "../../constants";
import { ALICE, BOB, CAROL, expect, gameData, test } from "../../fixtures";

test.describe("columns outside the board", () => {
  for (const column of ["7", "-1", "left"]) {
    test(`a move into column ${column} is rejected and doesn't use up the turn`, async ({ world }) => {
      await world.seedGame({ assetData: gameData({ next: ALICE }) });

      const response = await world.drop(ALICE, column, { timeout: 5_000 });

      expect(response?.ok()).toBe(false);
      const game = await world.game();
      expect(Object.keys(game.columns)).toEqual(["0", "1", "2", "3", "4", "5", "6"]);
      expect(game).toMatchObject({ turnCount: 0, lastPlayerTurn: BOB.visitorId, player1: { claimedSpaces: [] } });
      expect(await world.dropped("claimedSpace")).toEqual([]);
    });
  }
});

test.describe("forged webhook bodies", () => {
  test("a webhook without an interactive nonce is rejected", async ({ world }) => {
    await world.seedGame({ assetData: gameData({ next: ALICE }) });

    const response = await world.drop(ALICE, 3, { overrides: { interactiveNonce: "" } });

    expect(response?.ok()).toBe(false);
    expect((await response!.json()).success).toBe(false);
    expect(await world.dropped("claimedSpace")).toEqual([]);
  });

  test("a visitor who isn't in the world can't move", async ({ world }) => {
    await world.seedGame({ assetData: gameData({ next: ALICE }) });

    const response = await world.drop(ALICE, 3, { overrides: { visitorId: "999" } });

    expect(response?.ok()).toBe(false);
    expect(await world.dropped("claimedSpace")).toEqual([]);
  });

  test("credentials signed for another app's public key are rejected", async ({ world }) => {
    // Known bug (EXP-428 #6): getCredentials never compares interactivePublicKey with INTERACTIVE_KEY, and
    // the SDK signs every call with the app's own key, so the move goes through.
    test.fail(true, "EXP-428 #6: getCredentials never checks the public key");
    await world.seedGame({ assetData: gameData({ next: ALICE }) });

    const response = await world.drop(ALICE, 3, { overrides: { interactivePublicKey: "someone-else" } });

    expect(response?.ok()).toBe(false);
    expect(await world.dropped("claimedSpace")).toEqual([]);
  });
});

test.describe("at the same time", () => {
  test("a player clicking two columns at once only gets one move", async ({ world }) => {
    await world.seedGame({ assetData: gameData({ next: ALICE }) });

    const responses = await Promise.all([world.drop(ALICE, 0, { timeout: 5_000 }), world.drop(ALICE, 6, { timeout: 5_000 })]);

    // The second one hits the move lock (409), or the turn check if it reads after the first one's write.
    expect(responses.filter((r) => r?.ok()).length).toBe(1);
    const game = await world.game();
    expect([...game.columns[0], ...game.columns[6]]).toEqual([ALICE.visitorId]);
    expect(game.player1.claimedSpaces).toHaveLength(1);
    expect(await world.dropped("claimedSpace")).toHaveLength(1);
  });

  test("both players clicking at once only lets the player whose turn it is move", async ({ world }) => {
    await world.seedGame({ assetData: gameData({ next: ALICE }) });

    await Promise.all([world.drop(ALICE, 0, { timeout: 5_000 }), world.drop(BOB, 6, { timeout: 5_000 })]);

    const game = await world.game();
    expect(game.columns[6]).toEqual([]);
    expect(game.player2.claimedSpaces).toEqual([]);
    expect((await world.dropped("claimedSpace")).length).toBeLessThanOrEqual(1);
  });

  test("two visitors clicking seat 1 at once don't both become player one", async ({ world }) => {
    // Known bug: the join lock id includes the visitorId, so two visitors never share a lock and both pass
    // the "already selected" check on state read before the lock. Both are told they joined, both joins
    // are recorded, and the last write wins the seat.
    test.fail(true, "EXP-448 #3: simultaneous seat claims aren't serialized");
    await world.seedGame({ assetData: gameData({ p1: null, p2: null }) });

    const responses = await Promise.all([world.select(ALICE, 1, { timeout: 5_000 }), world.select(CAROL, 1, { timeout: 5_000 })]);

    expect(responses.filter((r) => r?.ok()).length, "requests told they joined").toBe(1);
    expect(await world.analytics("joins")).toHaveLength(1);
  });

  test("seats 1 and 2 claimed at once still start the game", async ({ world }) => {
    // Known bug: each request sees the other seat still free, so neither counts as the second player:
    // GAME_ON never fires and the board keeps saying "Find a second player!".
    test.fail(true, "EXP-448 #3: simultaneous seat claims aren't serialized");
    await world.seedGame({ assetData: gameData({ p1: null, p2: null }) });

    await Promise.all([world.select(ALICE, 1), world.select(BOB, 2)]);

    expect(await world.game()).toMatchObject({ player1: { visitorId: ALICE.visitorId }, player2: { visitorId: BOB.visitorId } });
    expect(await world.activities()).toContain("GAME_ON");
    expect(await world.text()).toBe("Let the game begin!");
  });
});

test("error responses never carry the interactive secret", async ({ request, world }) => {
  await world.seedGame({ assetData: gameData({ grid: ["12.....", "12....."] }) });

  const responses = await Promise.all([
    request.post("/api/click/3"), // no credentials
    world.drop(ALICE, 3, { overrides: { visitorId: "999" } }), // not in the world
    world.drop(ALICE, 3, { overrides: { interactiveNonce: "" } }), // no nonce
    world.drop(ALICE, "9"), // outside the board
    world.reset(CAROL), // not allowed to reset
    world.webhook("/click/3", ALICE, { assetId: "selector-3", uniqueName: "selector" }, { overrides: { sceneDropId: "no-such-scene" } }), // no key asset
  ]);

  for (const response of responses) {
    expect(response).not.toBeNull();
    const body = await response!.text();
    expect(body).not.toContain(INTERACTIVE_SECRET);
    expect(body).not.toContain("interactiveSecret");
    // A signed InteractiveJWT (mock-topia's own 401 message names the header, so look for the token).
    expect(body).not.toMatch(/eyJ[\w-]+\.eyJ[\w-]+\./);
  }
});
