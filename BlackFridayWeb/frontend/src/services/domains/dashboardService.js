import { coerceObject, normalizeHealth } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function getHealth() {
  const payload = await apiClient.request(endpoints.health, {
    auth: false
  });
  return normalizeHealth(payload);
}

export async function getAdminStats(query = {}) {
  const payload = await apiClient.request(endpoints.admin.stats, {
    query
  });

  return coerceObject(payload);
}

export async function getAdminMetrics(query = {}) {
  const payload = await apiClient.request(endpoints.admin.metrics, {
    query
  });

  return coerceObject(payload);
}
