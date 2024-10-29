import { Request, Response } from "express";
import {
  errorHandler,
  getDroppedAssetDataObject,
  getCredentials,
  lockDataObject,
  updateGameText,
} from "../utils/index.js";
import { GameDataType } from "../types/gameDataType.js";

export const handlePlayerSelection = async (req: Request, res: Response) => {
  try {
    const playerId = req.params.player;
    const isPlayer2 = parseInt(playerId) === 2;
    const credentials = getCredentials(req.body);
    const { profileId, urlSlug, visitorId } = credentials;
    const { username } = req.body;

    let text = "",
      shouldUpdateGame = true;

    const { keyAsset } = await getDroppedAssetDataObject(credentials);
    const { keyAssetId, playerCount, player1, player2 } = keyAsset.dataObject as GameDataType;

    try {
      try {
        const timestamp = new Date(Math.round(new Date().getTime() / 5000) * 5000);
        await lockDataObject(`${keyAssetId}-${visitorId}-${playerCount}-${timestamp}`, keyAsset);
      } catch (error) {
        return res.status(409).json({ message: "Player selection already in progress." });
      }

      if (player2.visitorId === visitorId) {
        text = `You are already player 2`;
        shouldUpdateGame = false;
      } else if (player1.visitorId === visitorId) {
        text = `You are already player 1`;
        shouldUpdateGame = false;
      } else if (isPlayer2 && player2.visitorId) {
        text = "Player 2 already selected.";
        shouldUpdateGame = false;
      } else if (!isPlayer2 && player1.visitorId) {
        text = "Player 1 already selected.";
        shouldUpdateGame = false;
      } else if ((isPlayer2 && player1.visitorId) || (!isPlayer2 && player2.visitorId)) {
        text = "Let the game begin!";
      } else {
        text = "Find a second player!";
      }

      if (!shouldUpdateGame) {
        await updateGameText(credentials, text, `${keyAssetId}_connect4_gameText`);
        throw text;
      }

      await Promise.all([
        keyAsset.updateDataObject(
          {
            lastInteraction: new Date(),
            playerCount: playerCount + 1,
            [`player${playerId}`]: { claimedSpaces: [], profileId, username, visitorId },
          },
          {
            analytics: [{ analyticName: "joins", profileId, urlSlug, uniqueKey: profileId }],
          },
        ),
        updateGameText(credentials, text, `${keyAssetId}_connect4_gameText`),
        updateGameText(credentials, username, `${keyAssetId}_connect4_player${playerId}Text`),
      ]);
    } catch (error) {
      await keyAsset.updateDataObject({ playerCount: playerCount + 1 });
      throw error;
    }
    return res.json({ success: true });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handlePlayerSelection",
      message: "Error handling player selection",
      req,
      res,
    });
  }
};