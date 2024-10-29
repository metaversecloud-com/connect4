export const defaultGameData = {
  columns: {
    0: [],
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
  },
  // claimedSpaces: {
  //   1: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  //   2: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  //   3: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  //   4: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  //   5: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  //   6: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  //   7: { 1: null, 2: null, 3: null, 4: null, 5: null, 6: null, 7: null },
  // },
  isGameOver: false,
  isResetInProgress: false,
  lastInteraction: null,
  lastPlayerTurn: null,
  playerCount: 0,
  player1: { claimedSpaces: [], profileId: null, username: null, visitorId: null },
  player2: { claimedSpaces: [], profileId: null, username: null, visitorId: null },
  resetCount: 0,
  turnCount: 0,
};

export const defaultGameText = "Click on a game piece to begin!";
