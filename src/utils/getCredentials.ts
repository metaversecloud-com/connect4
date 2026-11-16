import { Credentials } from "../types/credentialsInterface";

// Throws when the credentials are missing or belong to another app; the calling route's catch answers the request.
export const getCredentials = (params: any): Credentials => {
  const requiredFields = ["interactiveNonce", "interactivePublicKey", "urlSlug", "visitorId"];
  const missingFields = requiredFields.filter((variable) => !params[variable]);
  if (missingFields.length > 0) {
    throw `Missing required body parameters: ${missingFields.join(", ")}`;
  }

  if (process.env.INTERACTIVE_KEY !== params.interactivePublicKey) {
    throw "Provided public key does not match";
  }

  return {
    assetId: params.assetId,
    displayName: params.displayName,
    identityId: params.identityId,
    interactiveNonce: params.interactiveNonce,
    interactivePublicKey: params.interactivePublicKey,
    profileId: params.profileId,
    sceneDropId: params.sceneDropId,
    urlSlug: params.urlSlug,
    visitorId: Number(params.visitorId),
  };
};
