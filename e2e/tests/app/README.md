# Connect 4 tests

Connect 4 has no client: every interaction is an `assetClicked` webhook from a board asset, so the tests fire
those webhooks directly. `tests/app/` covers claiming seats (`join`), turns (`moves`), wins in every direction
and draws (`endings`), building and resetting the board (`reset`), forged webhooks, columns outside the board
and simultaneous clicks (`security`).

On top of the shared fixtures: `world.seedGame({...})` builds the scene (key asset `reset` plus the generated
board) with four people (`ALICE`, `BOB`, `CAROL`, `ADMIN`); `gameData({ grid })` builds the key asset's game
state from a drawn board; `world.select()` / `world.drop()` / `world.reset()` send the webhooks the seat
buttons, column arrows and reset button send (credentials in the JSON body). The mock also accepts the
`pastelConfetti_explosion` and `crown_float` particles and `set-custom-text`.

- No page: `ENTRY_PAGE = null` skips the platform tests that load one.
- The webhook routes read credentials from the body (`credentialsIn: "body"` in `app.config.ts`).
- Refused clicks never get an HTTP answer (EXP-448 #2), so tests for refusals poll the game state instead
  of awaiting the response.

## Known bugs

| Test | Bug | Tracked in |
|---|---|---|
| `platform/credentials.spec.ts` "names the credential problem" | `getCredentials` returns `{ error }` instead of throwing. | EXP-428 #6 |
| `platform/credentials.spec.ts` "rejects credentials signed for another app's public key", `app/security.spec.ts` "credentials signed for another app's public key are rejected" | `getCredentials` never checks the public key. | EXP-428 #6 |
| `platform/secrets.spec.ts` on `/click/3` (`answersNever`) | The platform visitor isn't seated, and a refused click never answers. | EXP-448 #2 |
| `app/endings.spec.ts` "only ends in a draw once all 42 spaces are filled", "the 41st piece is a win" | Draw declared at 41 pieces, before the win check. | EXP-448 #1 |
| `app/join.spec.ts`, `app/moves.spec.ts` "a refused … still answers the webhook" | Refusals end with `return console.log(...)`, no response. | EXP-448 #2 |
| `app/security.spec.ts` "at the same time" seat claims (2) | The seat lock is per visitor. | EXP-448 #3 |
| `app/join.spec.ts` "only seats 1 and 2 exist" | Seat number isn't validated. | EXP-448 #4 |
| `app/moves.spec.ts` "when player two moves first…" | Turn text computed before the move. | EXP-448 #5 |
| `app/reset.spec.ts` "a refused reset leaves the status text as it was" | Refusal restores the start text. | EXP-448 #6 |
| `app/reset.spec.ts` "can't build a second board by sending another asset's id" | `/reset` trusts the request's `assetId`. | EXP-448 #7 |

The interactive secret leak (EXP-429) doesn't apply: no route returns SDK objects and error responses
don't carry the secret (`app/security.spec.ts` "error responses never carry the interactive secret").
