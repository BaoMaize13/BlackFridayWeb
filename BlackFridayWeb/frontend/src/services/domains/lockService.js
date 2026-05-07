import { coerceObject } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function getLockState(config = {}) {
  const payload = await apiClient.request(endpoints.locks.status, {
    auth: false,
    query: {
      productId: config.productId ?? config.product_id
    }
  });
  const data = coerceObject(payload);
  const locks = Array.isArray(data.locks) ? data.locks : [];
  const activeLock = locks[0] ?? null;

  return {
    lockState: {
      owner: activeLock?.token ?? null,
      acquiredAt: null,
      expiresAt:
        activeLock?.ttlMs && activeLock.ttlMs > 0
          ? new Date(Date.now() + activeLock.ttlMs).toISOString()
          : null,
      lockType: "redis-distributed-lock",
      status: activeLock ? "ACTIVE" : "IDLE"
    },
    locks,
    redis: data.redis
  };
}

export async function getLockQueue() {
  return {
    queue: []
  };
}

export async function getLockEvents() {
  const payload = await apiClient.request(endpoints.locks.metrics, {
    auth: false
  });
  const data = coerceObject(payload);
  const metrics = coerceObject(data.metrics);

  return {
    events: Object.entries(metrics).map(([key, value]) => ({
      id: key,
      type: key,
      actor: "lock-service",
      detail: `${key}: ${value}`,
      timestamp: new Date().toISOString()
    }))
  };
}
