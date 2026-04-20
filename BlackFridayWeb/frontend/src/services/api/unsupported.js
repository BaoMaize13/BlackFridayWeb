import { AppError } from "../../utils/errors";

export function createUnsupportedFeatureError(featureName) {
  return new AppError(`${featureName} is not exposed by the current backend API contract.`, {
    status: 501,
    errorCode: "FEATURE_UNAVAILABLE"
  });
}

export function throwUnsupportedFeature(featureName) {
  throw createUnsupportedFeatureError(featureName);
}
