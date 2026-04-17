import { coerceArray, normalizeSettings } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function getSettings() {
  const payload = await apiClient.request(endpoints.settings.current);
  return normalizeSettings(payload);
}

export async function updateSettings(settings) {
  const payload = await apiClient.request(endpoints.settings.current, {
    method: "POST",
    body: settings
  });
  return normalizeSettings(payload);
}

export async function getSettingsHistory() {
  const payload = await apiClient.request(endpoints.settings.history);
  return coerceArray(payload);
}

export async function triggerSystemAction(action) {
  return apiClient.request(endpoints.settings.action(action), {
    method: "POST"
  });
}
