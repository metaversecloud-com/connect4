import { DroppedAsset } from "@rtsdk/topia";

export const lockDataObject = async (lockId: string, recordToLock: DroppedAsset) => {
  await recordToLock.updateDataObject(
    {},
    { lock: { lockId, releaseLock: false } }
  );
};
