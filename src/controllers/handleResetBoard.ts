import { Request, Response } from "express";
import {
  errorHandler,
  getDroppedAssetDataObject,
  generateBoard,
  Visitor,
  World,
  DroppedAsset,
} from "../utils/index.js";
import { GameDataType } from "../types/index.js";
import { defaultGameData, defaultGameText } from "../constants.js";
import { DroppedAssetInterface, VisitorInterface } from "@rtsdk/topia";

export const handleResetBoard = async (req: Request, res: Response) => {
  try {
    const credentials = req.credentials;
    const { assetId, sceneDropId, urlSlug, visitorId } = credentials;

    const visitor: VisitorInterface = await Visitor.get(visitorId, urlSlug, { credentials });
    const isAdmin = visitor.isAdmin;

    const { keyAsset, wasDataObjectInitialized } = await getDroppedAssetDataObject(credentials);
    const { lastInteraction, player1, player2, resetCount } = keyAsset.dataObject as GameDataType;

    if (wasDataObjectInitialized) {
      await generateBoard(credentials);
      return res.status(200).send({ message: "Game created successfully" });
    }

    let droppedAssetIds = [],
      droppedAssets: DroppedAssetInterface[];
    const world = World.create(urlSlug, { credentials });

    // get all assets with matching sceneDropId for full board rebuild
    droppedAssets = await world.fetchDroppedAssetsBySceneDropId({
      sceneDropId,
    });
    droppedAssets = droppedAssets.filter((item) => item.uniqueName !== "reset");

    const gameText = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === "gameText");

    if (gameText) await gameText.updateCustomTextAsset({}, "Reset in progress...");

    try {
      try {
        await keyAsset.updateDataObject(
          { isResetInProgress: true },
          {
            lock: { lockId: `${assetId}-${resetCount}-${new Date(Math.round(new Date().getTime() / 10000) * 10000)}` },
          },
        );
      } catch (error) {
        return res.status(409).json({ message: "Reset already in progress." });
      }

      const promises = [];
      const resetAllowedDate = new Date();
      resetAllowedDate.setMinutes(resetAllowedDate.getMinutes() - 5);

      if (!isAdmin && !lastInteraction) {
        throw "Nothing to reset!";
      } else if (
        !isAdmin &&
        player1.visitorId !== visitorId &&
        player2.visitorId !== visitorId &&
        new Date(lastInteraction).getTime() > resetAllowedDate.getTime()
      ) {
        throw "You must be either a player or admin to reset the board";
      }

      if (!isAdmin) {
        const p1text = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === "player1Text");
        const p2text = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === "player2Text");

        if (p1text) promises.push(p1text.updateCustomTextAsset({}, ""));
        if (p2text) promises.push(p2text.updateCustomTextAsset({}, ""));
        if (gameText) promises.push(gameText.updateCustomTextAsset({}, defaultGameText));

        droppedAssets = droppedAssets.filter(
          (item) => item.uniqueName === "claimedSpace" || item.uniqueName === "crown",
        );
      }

      for (const droppedAsset in droppedAssets) droppedAssetIds.push(droppedAssets[droppedAsset].id);
      if (droppedAssetIds.length > 0) {
        promises.push(World.deleteDroppedAssets(urlSlug, droppedAssetIds, process.env.INTERACTIVE_SECRET, credentials));
      }

      // update key asset data object
      const droppedAsset = await DroppedAsset.create(assetId, credentials.urlSlug, {
        credentials: { ...credentials, assetId },
      });
      promises.push(
        droppedAsset.updateDataObject({
          ...defaultGameData,
          keyAssetId: assetId,
          isResetInProgress: false,
          resetCount: resetCount + 1,
          sceneDropId,
        }),
      );

      if (isAdmin) promises.push(generateBoard(credentials));

      await Promise.all(promises);

      return res.status(200).send({ message: "Game reset successfully" });
    } catch (error) {
      if (gameText) gameText.updateCustomTextAsset({}, "");
      await keyAsset.updateDataObject({ isResetInProgress: false, resetCount: resetCount + 1 });
      throw error;
    }
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleResetBoard",
      message: "Error resetting the board.",
      req,
      res,
    });
  }
};
