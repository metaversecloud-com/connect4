import { AssetFactory, DroppedAssetFactory, Topia, UserFactory, VisitorFactory, WorldActivityFactory, WorldFactory } from "@rtsdk/topia";

const config = {
  apiDomain: process.env.INSTANCE_DOMAIN || "api-stage.topia.io",
  apiProtocol: process.env.INSTANCE_PROTOCOL || "https",
  interactiveKey: process.env.INTERACTIVE_KEY,
  interactiveSecret: process.env.INTERACTIVE_SECRET,
};

// creating instances of Topia
const myTopiaInstance = new Topia(config);


const Asset = new AssetFactory(myTopiaInstance);
const DroppedAsset = new DroppedAssetFactory(myTopiaInstance);
const User = new UserFactory(myTopiaInstance);
const Visitor = new VisitorFactory(myTopiaInstance);
const World = new WorldFactory(myTopiaInstance);
const WorldActivity = new WorldActivityFactory(myTopiaInstance);

export { Asset, DroppedAsset, myTopiaInstance, User, Visitor, World, WorldActivity };
