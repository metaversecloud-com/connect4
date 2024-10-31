import { Request, Response } from "express";
import {
  dropWebImageAsset,
  errorHandler,
  getCredentials,
  getDroppedAssetDataObject,
  getGameStatus,
  lockDataObject,
  addNewRowToGoogleSheets,
  Visitor,
  getPosition,
  World,
} from "../utils/index.js";
import { GameDataType } from "../types/gameDataType.js";
import { DroppedAssetInterface } from "@rtsdk/topia";

export const handleDropPiece = async (req: Request, res: Response) => {
  try {
    const credentials = getCredentials(req.body);
    const { displayName, identityId, sceneDropId, urlSlug, visitorId } = credentials;
    const { username } = req.body;

    let text = "",
      shouldUpdateGame = false,
      analytics = [];

    const column = parseInt(req.params.column);
    if (isNaN(column)) throw "Column id is required.";

    const { keyAsset } = await getDroppedAssetDataObject(credentials);

    let {
      columns,
      isGameOver,
      isResetInProgress,
      keyAssetId,
      lastPlayerTurn,
      player1,
      player2,
      resetCount,
      turnCount,
    } = keyAsset.dataObject as GameDataType;

    if (isResetInProgress) throw "Reset in progress.";

    const columnStart =
      column === 0
        ? 0
        : column === 1
        ? 6
        : column === 2
        ? 12
        : column === 3
        ? 18
        : column === 4
        ? 24
        : column === 5
        ? 30
        : 36;
    const claimedSpace = columnStart + columns[column].length;

    const updatedData = {
      ...keyAsset.dataObject,
      lastInteraction: new Date(),
      turnCount: turnCount + 1,
    };

    try {
      try {
        const timestamp = new Date(Math.round(new Date().getTime() / 5000) * 5000);
        await lockDataObject(`${keyAssetId}-${resetCount}-${turnCount}-${timestamp}`, keyAsset);
      } catch (error) {
        return res.status(409).json({ message: "Move already in progress." });
      }

      if (isGameOver) {
        text = "Game over! Press Reset to play again.";
      } else if (!player1.visitorId || !player2.visitorId) {
        text = "Two players are needed to get started.";
      } else if (player1.visitorId !== visitorId && player2.visitorId !== visitorId) {
        text = "Game in progress.";
      } else if (columns[column].length === 6) {
        text = "Cannot place your move here.";
      } else if (lastPlayerTurn === visitorId) {
        const username = player2.visitorId === visitorId ? player1.username : player2.username;
        text = `It's ${username}'s turn.`;
      } else {
        updatedData.lastPlayerTurn = visitorId;
        updatedData.columns[column]?.push(visitorId);
        if (player1.visitorId === visitorId) updatedData.player1["claimedSpaces"].push(claimedSpace);
        else updatedData.player2.claimedSpaces.push(claimedSpace);
        shouldUpdateGame = true;
      }

      const world = World.create(urlSlug, { credentials });
      const droppedAssets: DroppedAssetInterface[] = await world.fetchDroppedAssetsBySceneDropId({
        sceneDropId,
      });
      const gameText = droppedAssets.find((droppedAsset) => droppedAsset.uniqueName === "gameText");

      if (!gameText) throw "Text assets are missing. Please have an admin reset the board.";

      if (!shouldUpdateGame) {
        gameText.updateCustomTextAsset({}, text);
        throw text;
      }

      const promises = [];

      const position = getPosition(claimedSpace, keyAsset.position);
      promises.push(
        dropWebImageAsset({
          credentials,
          layer0: `${process.env.S3_BUCKET}${visitorId === player1.visitorId ? "player1" : "player2"}.png`,
          position: { x: Math.round(position.x), y: Math.round(position.y) },
          uniqueName: "claimedSpace",
        }),
      );

      const hasWinningCombo = await getGameStatus(
        player1.visitorId === visitorId ? updatedData.player1.claimedSpaces : updatedData.player2.claimedSpaces,
      );

      if (hasWinningCombo) {
        text = `${username} wins!`;
        updatedData.isGameOver = true;

        // drop crown
        const keyAssetPosition = keyAsset.position;
        const position = {
          x: player1.visitorId === visitorId ? keyAssetPosition.x - 400 : keyAssetPosition.x + 400,
          y: keyAssetPosition.y - 580,
        };
        promises.push(
          dropWebImageAsset({
            credentials,
            layer0: `${process.env.S3_BUCKET}crown.png`,
            position,
            uniqueName: "crown",
          }),
        );

        const visitor = await Visitor.create(visitorId, urlSlug, { credentials });
        promises.push(visitor.triggerParticle({ name: "crown_float" }));

        addNewRowToGoogleSheets([
          {
            displayName,
            identityId,
            event: "completions",
            urlSlug,
          },
        ]);
      }

      promises.push(keyAsset.updateDataObject(updatedData, { analytics }), gameText.updateCustomTextAsset({}, text));

      await Promise.all(promises);
    } catch (error) {
      await keyAsset.updateDataObject({ turnCount: turnCount + 1 });
      throw error;
    }
    return res.status(200).send({ message: "Move successfully made." });
  } catch (error) {
    return errorHandler({
      error,
      functionName: "handleDropPiece",
      message: "Error making a move.",
      req,
      res,
    });
  }
};
