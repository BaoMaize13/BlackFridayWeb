import { coerceArray, coercePagination, normalizeLog } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listLogs(filters = {}, productsById = new Map()) {
  const payload = await apiClient.request(endpoints.admin.attemptLogs, {
    query: {
      action: filters.type,
      productId: filters.productId,
      requestId: filters.requestId
    }
  });

  const items = coerceArray(payload)
    .map((entry) => normalizeLog(entry, productsById))
    .filter((entry) => {
      const haystack = `${entry.message} ${entry.action} ${entry.productName}`.toLowerCase();

      if (filters.search && !haystack.includes(String(filters.search).toLowerCase())) {
        return false;
      }

      if (filters.message && !entry.message.toLowerCase().includes(String(filters.message).toLowerCase())) {
        return false;
      }

      if (filters.level && entry.level !== filters.level) {
        return false;
      }

      return true;
    });

  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}
