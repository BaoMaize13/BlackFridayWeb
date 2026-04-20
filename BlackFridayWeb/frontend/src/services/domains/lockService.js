import { throwUnsupportedFeature } from "../api/unsupported";

export async function getLockState(config) {
  return throwUnsupportedFeature("Lock monitor endpoints");
}

export async function getLockQueue(config) {
  return throwUnsupportedFeature("Lock queue endpoints");
}

export async function getLockEvents(config) {
  return throwUnsupportedFeature("Lock event endpoints");
}
