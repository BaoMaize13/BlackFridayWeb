import { coerceArray, coercePagination, normalizeOrder } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listOrders(filters = {}, productsById = new Map()) {
  const payload = await apiClient.requestFirst(
    endpoints.orders.list.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        search: filters.search,
        status: filters.status,
        productId: filters.productId,
        request_id: filters.requestId,
        from: filters.from,
        to: filters.to
      }
    }))
  );

  const items = coerceArray(payload).map((entry) => normalizeOrder(entry, productsById));
  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}

export async function getOrderById(id, productsById = new Map()) {
  const payload = await apiClient.requestFirst(endpoints.orders.detail(id));
  return normalizeOrder(payload, productsById);
}
