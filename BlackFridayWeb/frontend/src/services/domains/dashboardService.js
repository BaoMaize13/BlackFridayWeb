import { normalizeHealth } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function getHealth() {
  const payload = await apiClient.request(endpoints.health, {
    auth: false
  });
  return normalizeHealth(payload);
}
