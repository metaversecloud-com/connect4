import { errorHandler, DroppedAsset, initializeDroppedAssetDataObject, World } from "../index.js";
import { Credentials, WorldDataObjectType } from "../../types/index.js";

export const getDroppedAssetDataObject = async (credentials: Credentials, isKeyAsset: boolean) => {
  try {
    let { assetId, sceneDropId, urlSlug } = credentials;
    let keyAsset,
      keyAssetId = assetId;

    const world = World.create(urlSlug, { credentials });
    await world.fetchDataObject();
    const dataObject = world.dataObject as WorldDataObjectType;

    if (!isKeyAsset) {
      if (dataObject?.[sceneDropId]?.keyAssetId) {
        // get keyAssetId from world data object if available
        keyAssetId = dataObject[sceneDropId].keyAssetId;
      } else {
        // find key asset by sceneDropId and unique name
        keyAsset = await DroppedAsset.getWithUniqueName("reset", urlSlug, process.env.INTERACTIVE_SECRET!, credentials);
        if (!keyAsset) throw "No key asset with the unique name 'reset' found.";
        keyAssetId = keyAsset?.id;
      }
    }

    // If sceneDropId is not provided, use keyAssetId as the sceneDropId
    // This ensures we always have a valid sceneDropId for asset queries
    if (!sceneDropId) sceneDropId = keyAssetId;

    // Validate that we have a valid sceneDropId before proceeding
    if (!sceneDropId || sceneDropId.trim() === "") {
      throw "Unable to determine a valid sceneDropId. This is required to safely query assets.";
    }

    // store keyAssetId by sceneDropId in World data object so that it can be accessed by any clickable asset
    // this supports a scene being dropped with the board already created instead of just the Reset button
    if (!dataObject || Object.keys(dataObject).length === 0) {
      await world.setDataObject({ [sceneDropId]: { keyAssetId } });
    } else if (!dataObject[sceneDropId]) {
      await world.updateDataObject({ [sceneDropId]: { keyAssetId } });
    }

    if (!keyAsset?.id) {
      keyAsset = await DroppedAsset.get(keyAssetId, urlSlug, {
        credentials: { ...credentials, assetId: keyAssetId },
      });
    }

    const wasDataObjectInitialized = await initializeDroppedAssetDataObject(keyAsset, sceneDropId);

    // Return the resolved sceneDropId so callers can use it for subsequent queries
    return { keyAsset, wasDataObjectInitialized, sceneDropId };
  } catch (error) {
    return errorHandler({
      error,
      functionName: "getGameData",
      message: "Error getting game data.",
    });
  }
};
