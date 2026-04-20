import { coerceArray, coercePagination, normalizeOrder } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listOrders(filters = {}, productsById = new Map()) {
  const payload = await apiClient.request(endpoints.admin.orders, {
    query: {
      productId: filters.productId,
      requestId: filters.requestId,
      status: filters.status
    }
  });

  const items = coerceArray(payload)
    .map((entry) => normalizeOrder(entry, productsById))
    .filter((entry) => {
      const haystack = `${entry.productName} ${entry.buyerRef ?? ""} ${entry.requestId ?? ""}`.toLowerCase();

      if (filters.search && !haystack.includes(String(filters.search).toLowerCase())) {
        return false;
      }

      if (filters.from && entry.createdAt && new Date(entry.createdAt) < new Date(filters.from)) {
        return false;
      }

      if (filters.to && entry.createdAt && new Date(entry.createdAt) > new Date(filters.to)) {
        return false;
      }

      return true;
    });

  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}

export async function getOrderById(id, productsById = new Map()) {
  const payload = await apiClient.request(endpoints.admin.orderDetail(id));
  return normalizeOrder(payload, productsById);
}
