import { Asset, DroppedAsset } from "../topiaInit.js";
import { Credentials } from "../../types/credentialsInterface";

export const dropTextAsset = async ({
  credentials,
  position,
  style = {},
  text = "",
  uniqueName,
}: {
  credentials: Credentials;
  position: { x: number; y: number };
  style?: {
    textColor?: string;
    textSize?: number;
    textWidth?: number;
  };
  text: string;
  uniqueName: string;
}) => {
  const { interactivePublicKey, sceneDropId, urlSlug } = credentials;

  const asset = Asset.create(process.env.TEXT_ASSET_ID || "textAsset", {
    credentials,
  });

  const droppedAsset = await DroppedAsset.drop(asset, {
    interactivePublicKey,
    isInteractive: true,
    isTextTopLayer: true,
    position,
    sceneDropId,
    text,
    uniqueName,
    urlSlug,
    yOrderAdjust: 500,
    ...style,
  });

  return droppedAsset;
};
