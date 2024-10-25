import { Request, Response } from "express";
import { DroppedAsset, World, Visitor } from "../utils/topiaInstance.js";
import {
  credentialsFromQuery,
  getDroppedAssetFromSceneWithUniqueName,
} from "../utils/common.js";
import { InteractiveCredentials, VisitorInterface } from "@rtsdk/topia";
import removeAllWebImageAssets from "../utils/removeWebImageAssets.js";
import { DroppedAssetExt } from "../utils/types.js";
import { defaultDataObject } from "../utils/defaultDataObject.js";
import { errorHandler } from "../utils/errorHandler.js";


const resetBoard = async (credentials: InteractiveCredentials, sid: string) => {
  await removeAllWebImageAssets(credentials, sid, undefined);
  return;
};

const handleResetBoard = async (req: Request, res: Response) => {
  try {
    const sceneDropId = req.body.sceneDropId;
    const credentials = credentialsFromQuery(req);
    const world = World.create(credentials.urlSlug || "", { credentials });

    const visitor: VisitorInterface = await Visitor.get(
      credentials.visitorId || 0,
      credentials.urlSlug || "",
      { credentials }
    );
    const isAdmin = visitor.isAdmin;

    const assetsInScene = (await world.fetchDroppedAssetsBySceneDropId({
      sceneDropId,
    })) as unknown as DroppedAssetExt[];

    const keyAsset = await getDroppedAssetFromSceneWithUniqueName(
      "board",
      assetsInScene
    );

    const keyAssetDataObject = (await keyAsset?.fetchDataObject()) as any;
    if (!isAdmin && keyAssetDataObject?.isGameStarted) {
      if (
        keyAssetDataObject?.playerOne?.visitorId === credentials.visitorId ||
        keyAssetDataObject?.playerTwo?.visitorId === credentials.visitorId
      ) {
        return res.status(400).send({
          success: false,
          message: "You can't reset the game while it's in progress",
        });
      }
    }

    try {
      await keyAsset?.updateDataObject(
        {},
        {
          lock: {
            lockId: `${credentials.assetId}-${
              keyAssetDataObject.resetCount
            }-${new Date(Math.round(new Date().getTime() / 10000) * 10000)}`,
          },
        }
      );
    } catch (error) {
      console.error("Key asset locked: Reset", error);
      return res.status(409).json({ message: "Reset already in progress." });
    }

    const boardMessage = await getDroppedAssetFromSceneWithUniqueName(
      "board-msg",
      assetsInScene
    );
    const selTextBlue = await getDroppedAssetFromSceneWithUniqueName(
      "blue-sel-text",
      assetsInScene
    );
    const selTextOrange = await getDroppedAssetFromSceneWithUniqueName(
      "orange-sel-text",
      assetsInScene
    );


    if (!boardMessage || !selTextBlue || !selTextOrange || !keyAsset)
      return res
        .status(500)
        .send({ success: false, message: "Board Elements not Found" });

    const updateBluetext = new Promise((resolve, reject) => {
      selTextBlue.updateCustomTextAsset({}, "< Click to play");
    });

    const updateOrangeText = new Promise((resolve, reject) => {
      selTextBlue.updateCustomTextAsset({}, "< Click to play");
    });

    const updateBoard = new Promise((resolve, reject) => {
      resetBoard(credentials, sceneDropId);
    });

    const boardMessageUpdate = new Promise((resolve, reject) => {
      boardMessage.updateWebImageLayers(
        "https://sdk-connect4.s3.amazonaws.com/connect4-title.png",
        "https://sdk-connect4.s3.amazonaws.com/connect4-title.png"
      );
    });

    const updateKeyAsset = new Promise((resolve, reject) => {
      keyAsset.setDataObject({
        ...defaultDataObject,
        resetCount: keyAssetDataObject.resetCount + 1,
      });
    });

    try {
      await boardMessage.updateWebImageLayers(
        "https://sdk-connect4.s3.amazonaws.com/reseting-msg.png",
        "https://sdk-connect4.s3.amazonaws.com/reseting-msg.png"
      );

      await Promise.all([
        updateBluetext,
        updateOrangeText,
        updateBoard,
        boardMessageUpdate,
        updateKeyAsset,
      ]);
    } catch (error) {
      await Promise.all([
        //add a state for the webimage to set it to something
        keyAsset.updateDataObject({
          isResetInProgress: false,
          resetCount: keyAssetDataObject.resetCount + 1,
        }),
      ]);
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

export default handleResetBoard;
