import { coerceArray, coerceObject } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function getLockState(config) {
  const payload = await apiClient.request(endpoints.lock.state, {
    method: "POST",
    body: config
  });
  return coerceObject(payload);
}

export async function getLockQueue(config) {
  const payload = await apiClient.request(endpoints.lock.queue, {
    method: "POST",
    body: config
  });
  return coerceObject(payload);
}

export async function getLockEvents(config) {
  const payload = await apiClient.request(endpoints.lock.events, {
    method: "POST",
    body: config
  });
  return coerceArray(payload);
}
