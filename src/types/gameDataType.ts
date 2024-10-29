export type GameDataType = {
  columns?: object;
  isGameOver?: boolean;
  isResetInProgress?: boolean;
  keyAssetId?: string;
  lastInteraction?: Date;
  lastPlayerTurn?: number;
  playerCount?: number;
  player1?: {
    claimedSpaces?: number[];
    profileId?: string;
    username?: string;
    visitorId?: number;
  };
  player2?: {
    claimedSpaces?: number[];
    profileId?: string;
    username?: string;
    visitorId?: number;
  };
  resetCount?: number;
  turnCount?: number;
};
