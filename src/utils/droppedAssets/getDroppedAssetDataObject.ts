import { errorHandler, DroppedAsset, initializeDroppedAssetDataObject, World } from "../index.js";
import { Credentials, WorldDataObjectType } from "../../types/index.js";

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
      const droppedAssets = await world.fetchDroppedAssetsBySceneDropId({
        sceneDropId,
        uniqueName: "reset",
      });

      keyAssetId = droppedAssets[0]?.id;
    }

    if (!keyAssetId) throw "No key asset found.";

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
