import { Request, Response } from "express";
import { errorHandler, getDroppedAssetDataObject, getCredentials, lockDataObject, World } from "../utils/index.js";
import { GameDataType } from "../types/gameDataType.js";
import { DroppedAssetInterface, WorldActivityType } from "@rtsdk/topia";

export const handlePlayerSelection = async (req: Request, res: Response) => {
  try {
    const playerId = req.params.player;
    const isPlayer2 = parseInt(playerId) === 2;
    const credentials = req.credentials;
    const { profileId, sceneDropId, urlSlug, visitorId } = credentials;
    const { username } = req.body;

    let text = "",
      shouldUpdateGame = true;

    const { keyAsset } = await getDroppedAssetDataObject(credentials, false);
    const { keyAssetId, playerCount, player1, player2 } = keyAsset.dataObject as GameDataType;

    try {
      try {
        const timestamp = new Date(Math.round(new Date().getTime() / 5000) * 5000);
        await lockDataObject(`${keyAssetId}-${visitorId}-${playerCount}-${timestamp}`, keyAsset);
      } catch (error) {
        return res.status(409).json({ message: "Player selection already in progress." });
      }

      const world = World.create(urlSlug, { credentials });

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
        world.triggerActivity({ type: WorldActivityType.GAME_ON, assetId: keyAssetId }).catch((error) =>
          errorHandler({
            error,
            functionName: "handlePlayerSelection",
            message: "Error triggering world activity",
          }),
        );
      } else {
        text = "Find a second player!";
        world.triggerActivity({ type: WorldActivityType.GAME_WAITING, assetId: keyAssetId }).catch((error) =>
          errorHandler({
            error,
            functionName: "handlePlayerSelection",
            message: "Error triggering world activity",
          }),
        );
      }

      const droppedAssets: DroppedAssetInterface[] = await world.fetchDroppedAssetsBySceneDropId({ sceneDropId });
      const gameText = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === "gameText");
      const playerText = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === `player${playerId}Text`);

      if (!shouldUpdateGame) {
        if (gameText) gameText.updateCustomTextAsset({}, text);
        throw text;
      }

      const promises = [];
      promises.push(
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
      );
      if (playerText) promises.push(playerText.updateCustomTextAsset({}, username));
      if (gameText) promises.push(gameText.updateCustomTextAsset({}, text));
      await Promise.all(promises);
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
