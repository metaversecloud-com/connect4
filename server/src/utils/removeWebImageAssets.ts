import { InteractiveCredentials } from "@rtsdk/topia";
import { World } from "./topiaInstance.js";

const removeAllWebImageAssets = async (
    credentials: InteractiveCredentials,
    sid: string,
    winningCells: { row: number; col: number }[] | undefined
  ) => {
    const world = World.create(
      credentials.urlSlug || "",
      { credentials }
    );
    let droppedAssetIds = [] as any;
    // how do I get the uniqueName here?
    const a = await world.fetchDroppedAssetsWithUniqueName({
      uniqueName: "c4p",
      isPartial: true,
    });

  
    for (const droppedAsset in a) {
      const { uniqueName } = a[droppedAsset] as any;
  
      const row = uniqueName.split("-")[1];
      const col = uniqueName.split("-")[2];
  
      const isWinningCell = winningCells?.some(
        (cell: { row: number; col: number }) =>
          cell.row === parseInt(row) && cell.col === parseInt(col)
      );
  
      if (!isWinningCell) {
        droppedAssetIds.push(a[droppedAsset].id);
      }
    }
  
    await World.deleteDroppedAssets(
      credentials.urlSlug || "",
      droppedAssetIds,
      credentials.interactivePublicKey || "",
      process.env.INTERACTIVE_SECRET || ""
    );
  };

  export default removeAllWebImageAssets;