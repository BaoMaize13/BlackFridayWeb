import { coerceArray, coercePagination, normalizeLog } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listLogs(filters = {}, productsById = new Map()) {
  const payload = await apiClient.requestFirst(
    endpoints.logs.list.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        search: filters.search,
        request_id: filters.requestId,
        message: filters.message,
        level: filters.level,
        type: filters.type,
        productId: filters.productId
      }
    }))
  );

  const items = coerceArray(payload).map((entry) => normalizeLog(entry, productsById));
  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}
