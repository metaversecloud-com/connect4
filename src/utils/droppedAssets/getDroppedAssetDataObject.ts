import { errorHandler, DroppedAsset, initializeDroppedAssetDataObject, World } from "../index.js";
import { Credentials, WorldDataObjectType } from "../../types/index.js";
import { DroppedAssetInterface } from "@rtsdk/topia";

export const getDroppedAssetDataObject = async (credentials: Credentials) => {
  try {
    let { assetId, sceneDropId, urlSlug } = credentials;
    let keyAssetId = assetId;

    const world = World.create(urlSlug, { credentials });
    await world.fetchDataObject();
    const dataObject = world.dataObject as WorldDataObjectType;

    if (!sceneDropId) {
      keyAssetId = assetId;
      sceneDropId = assetId;
    } else if (dataObject?.[sceneDropId]?.keyAssetId) {
      keyAssetId = dataObject[sceneDropId].keyAssetId;
    } else {
      const droppedAssets: DroppedAssetInterface[] = await world.fetchDroppedAssetsBySceneDropId({
        sceneDropId,
      });
      const keyAsset = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === "reset");
      keyAssetId = keyAsset?.id;
    }

    if (!keyAssetId) throw "No key asset found.";

    // store keyAssetId by sceneDropId in World data object so that it can be accessed by any clickable asset
    // this supports a scene being dropped with the board already created instead of just the Reset button
    if (!dataObject || Object.keys(dataObject).length === 0) {
      await world.setDataObject({ [sceneDropId]: { keyAssetId } });
    } else if (!dataObject[sceneDropId]) {
      await world.updateDataObject({ [sceneDropId]: { keyAssetId } });
    }

    const keyAsset = await DroppedAsset.get(keyAssetId, urlSlug, {
      credentials: { ...credentials, assetId: keyAssetId },
    });
    const wasDataObjectInitialized = await initializeDroppedAssetDataObject(keyAsset, sceneDropId);

    return { keyAsset, wasDataObjectInitialized };
  } catch (error) {
    return errorHandler({
      error,
      functionName: "getGameData",
      message: "Error getting game data.",
    });
  }
};
