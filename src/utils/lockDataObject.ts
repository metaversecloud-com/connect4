export const lockDataObject = async (lockId, recordToLock) => {
  return await recordToLock.updateDataObject({}, { lock: { lockId, releaseLock: false } });
};
