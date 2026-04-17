import {
  coerceArray,
  coercePagination,
  normalizeOrder,
  normalizePurchaseResponse
} from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function submitPurchase(productId, quantity) {
  const payload = await apiClient.request(endpoints.purchase.submit, {
    method: "POST",
    body: {
      product_id: productId,
      quantity
    }
  });
  return normalizePurchaseResponse(payload);
}

export async function getRecentPurchases(productsById = new Map()) {
  const payload = await apiClient.requestFirst(endpoints.purchase.recent);
  return coerceArray(payload).map((entry) => normalizeOrder(entry, productsById));
}

export async function getPurchaseHistory(filters = {}, productsById = new Map()) {
  const payload = await apiClient.requestFirst(
    endpoints.purchase.history.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        search: filters.search,
        status: filters.status,
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

export async function getPurchaseHistoryDetail(id, productsById = new Map()) {
  const payload = await apiClient.requestFirst(endpoints.purchase.detail(id));
  return normalizeOrder(payload, productsById);
}
