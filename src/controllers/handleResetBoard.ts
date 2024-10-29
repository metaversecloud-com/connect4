import { Request, Response } from "express";
import {
  errorHandler,
  getDroppedAssetDataObject,
  generateBoard,
  updateGameText,
  Visitor,
  World,
  DroppedAsset,
} from "../utils/index.js";
import { GameDataType } from "../types/index.js";
import { defaultGameData, defaultGameText } from "../constants.js";
import { VisitorInterface } from "@rtsdk/topia";

export const handleResetBoard = async (req: Request, res: Response) => {
  try {
    const credentials = req.credentials;
    const { assetId, urlSlug, visitorId } = credentials;

    const visitor: VisitorInterface = await Visitor.get(visitorId, urlSlug, { credentials });
    const isAdmin = visitor.isAdmin;

    const { keyAsset, wasDataObjectInitialized } = await getDroppedAssetDataObject(credentials);
    const { lastInteraction, player1, player2, resetCount } = keyAsset.dataObject as GameDataType;

    if (wasDataObjectInitialized) {
      await generateBoard(credentials);
      return res.status(200).send({ message: "Game created successfully" });
    }

    await updateGameText(credentials, "Reset in progress...", `${assetId}_connect4_gameText`);

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

      let droppedAssetIds = [],
        droppedAssets;
      const world = World.create(urlSlug, { credentials });

      if (isAdmin) {
        // get all assets with assetId in unique name for full board rebuild
        droppedAssets = await world.fetchDroppedAssetsWithUniqueName({
          isPartial: true,
          uniqueName: assetId,
        });
      } else {
        // get only game move assets with assetId in unique name
        droppedAssets = await world.fetchDroppedAssetsWithUniqueName({
          isPartial: false,
          uniqueName: `${assetId}_connect4_claimedSpace`,
        });

        const crown = await world.fetchDroppedAssetsWithUniqueName({
          isPartial: false,
          uniqueName: `${assetId}_connect4_crown`,
        });
        if (crown.length > 0) droppedAssetIds.push(crown[0].id);

        updateGameText(credentials, "", `${assetId}_connect4_player1Text`);
        updateGameText(credentials, "", `${assetId}_connect4_player2Text`);
        updateGameText(credentials, defaultGameText, `${assetId}_connect4_gameText`);
      }

      for (const droppedAsset in droppedAssets) {
        droppedAssetIds.push(droppedAssets[droppedAsset].id);
      }
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
        }),
      );

      if (isAdmin) promises.push(generateBoard(credentials));

      const position = {
        x: keyAsset.position.x,
        y: keyAsset.position.y - 300,
      };
      promises.push(world.triggerParticle({ duration: 4, position, name: "blueSmoke_fog" }));

      await Promise.all(promises);

      return res.status(200).send({ message: "Game reset successfully" });
    } catch (error) {
      await Promise.all([
        updateGameText(credentials, "", `${assetId}_connect4_gameText`),
        keyAsset.updateDataObject({ isResetInProgress: false, resetCount: resetCount + 1 }),
      ]);
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
