import { normalizeCompareSimulation, normalizeSimulationResult } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function runNoLockSimulation(config) {
  const payload = await apiClient.request(endpoints.simulation.noLock, {
    method: "POST",
    body: config
  });
  return normalizeSimulationResult(payload);
}

export async function runWithLockSimulation(config) {
  const payload = await apiClient.request(endpoints.simulation.withLock, {
    method: "POST",
    body: config
  });
  return normalizeSimulationResult(payload);
}

export async function runCompareSimulation(config) {
  const payload = await apiClient.request(endpoints.simulation.compare, {
    method: "POST",
    body: config
  });
  return normalizeCompareSimulation(payload);
}
