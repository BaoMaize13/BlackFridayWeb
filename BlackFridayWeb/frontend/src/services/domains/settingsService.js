import { throwUnsupportedFeature } from "../api/unsupported";

export async function getSettings() {
  return throwUnsupportedFeature("Settings APIs");
}

export async function updateSettings(settings) {
  return throwUnsupportedFeature("Settings update APIs");
}

export async function getSettingsHistory() {
  return throwUnsupportedFeature("Settings history APIs");
}

export async function triggerSystemAction(action) {
  return throwUnsupportedFeature("System action APIs");
}
