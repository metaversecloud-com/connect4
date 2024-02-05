import initBoardData from "./initBoardData.js";
import { GameDataType } from "./types.js";

export const defaultDataObject:GameDataType  = {
    board: JSON.stringify(initBoardData()),
    playerOne: {
      profileId: "",
      username: "",
      visitorId: 0,
    },
    playerTwo: {
      profileId: "",
      username: "",
      visitorId: 0,
    },
    isGameStarted: false,
}