import { DroppedAsset } from "@rtsdk/topia";

export interface Credentials {
  interactiveNonce: string;
  interactivePublicKey: string;
  urlSlug: string;
  visitorId: string;
  assetId: string;
}


export type GameDataType = {
  board: string;
  playerOne: {
    profileId: string;
    username: string;
    visitorId: number;
  }
  playerTwo: {
    profileId: string;
    username: string;
    visitorId: number;
  },
  isGameStarted: boolean;
};

export interface DroppedAssetExt extends DroppedAsset{
  uniqueName: string;
}