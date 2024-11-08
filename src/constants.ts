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

export const defaultGameText = "Click on a game piece on the left or right to begin!";
