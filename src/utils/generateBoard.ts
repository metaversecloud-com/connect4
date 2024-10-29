import {
  dropTextAsset,
  dropWebImageAsset,
  errorHandler,
  getDroppedAsset,
  initializeDroppedAssetDataObject,
} from "./index.js";
import { Credentials } from "../types/credentialsInterface.js";
import { defaultGameText } from "../constants.js";

export const generateBoard = async (credentials: Credentials) => {
  try {
    const { assetId } = credentials;
    const keyAsset = await getDroppedAsset(credentials);
    const { position: resetBtnCenter } = keyAsset;
    const boardCenter = {
      x: resetBtnCenter.x,
      y: resetBtnCenter.y - 300,
    };

    initializeDroppedAssetDataObject(keyAsset);

    await Promise.all([
      dropWebImageAsset({
        credentials,
        layer1: `${process.env.BUCKET}board.png`,
        position: boardCenter,
        uniqueName: `${assetId}_connect4_board`,
      }),
      dropTextAsset({
        credentials,
        position: {
          x: boardCenter.x,
          y: boardCenter.y - 375,
        },
        style: { textSize: 22 },
        text: defaultGameText,
        uniqueName: `${assetId}_connect4_gameText`,
      }),
      dropTextAsset({
        credentials,
        position: {
          x: resetBtnCenter.x - 400,
          y: boardCenter.y - 130,
        },
        style: { textSize: 20, textWidth: 150 },
        text: "",
        uniqueName: `${assetId}_connect4_player1Text`,
      }),
      dropTextAsset({
        credentials,
        position: {
          x: resetBtnCenter.x + 400,
          y: boardCenter.y - 130,
        },
        style: { textSize: 20, textWidth: 150 },
        text: "",
        uniqueName: `${assetId}_connect4_player2Text`,
      }),
    ]);

    const [player1, player2, column1, column2, column3, column4, column5, column6, column7] = await Promise.all([
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}player1.png`,
        position: {
          x: resetBtnCenter.x - 400,
          y: boardCenter.y - 200,
        },
        uniqueName: `${assetId}_connect4_o`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}player2.png`,
        position: {
          x: resetBtnCenter.x + 400,
          y: boardCenter.y - 200,
        },
        uniqueName: `${assetId}_connect4_x`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x - 255,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x - 170,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x - 85,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x + 85,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x + 170,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
      dropWebImageAsset({
        credentials,
        layer0: `${process.env.BUCKET}selector.png`,
        position: {
          x: boardCenter.x + 255,
          y: boardCenter.y - 305,
        },
        uniqueName: `${assetId}_connect4_selector`,
      }),
    ]);

    const webhookPayload = {
      dataObject: {},
      description: "",
      isUniqueOnly: false,
      type: "assetClicked",
      shouldSetClickType: true,
    };

    await Promise.all([
      player1.addWebhook({
        ...webhookPayload,
        title: "Player 1 Selected",
        url: `${process.env.APP_URL}select-player/1`,
      }),
      player2.addWebhook({
        ...webhookPayload,
        title: "Player 2 Selected",
        url: `${process.env.APP_URL}select-player/2`,
      }),
      column1.addWebhook({
        ...webhookPayload,
        description: "Column 1",
        title: "Column 1 Clicked",
        url: `${process.env.APP_URL}click/0`,
      }),
      column2.addWebhook({
        ...webhookPayload,
        description: "Column 2",
        title: "Column 2 Clicked",
        url: `${process.env.APP_URL}click/1`,
      }),
      column3.addWebhook({
        ...webhookPayload,
        description: "Column 3",
        title: "Column 3 Clicked",
        url: `${process.env.APP_URL}click/2`,
      }),
      column4.addWebhook({
        ...webhookPayload,
        description: "Column 4",
        title: "Column 4 Clicked",
        url: `${process.env.APP_URL}click/3`,
      }),
      column5.addWebhook({
        ...webhookPayload,
        description: "Column 5",
        title: "Column 5 Clicked",
        url: `${process.env.APP_URL}click/4`,
      }),
      column6.addWebhook({
        ...webhookPayload,
        description: "Column 6",
        title: "Column 6 Clicked",
        url: `${process.env.APP_URL}click/5`,
      }),
      column7.addWebhook({
        ...webhookPayload,
        description: "Column 7",
        title: "Column 7 Clicked",
        url: `${process.env.APP_URL}click/6`,
      }),
    ]);

    return { success: true };
  } catch (error) {
    return errorHandler({
      error,
      functionName: "generateBoard",
      message: "Error generating game board.",
    });
  }
};
