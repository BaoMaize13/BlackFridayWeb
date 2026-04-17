import { coerceArray, coercePagination, normalizeProduct } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listProducts(filters = {}) {
  const payload = await apiClient.requestFirst(
    endpoints.products.list.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        search: filters.search,
        status: filters.status,
        stock_level: filters.stockLevel
      }
    }))
  );

  const items = coerceArray(payload).map(normalizeProduct);
  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}

export async function getProductById(id) {
  const payload = await apiClient.requestFirst(endpoints.products.detail(id));
  return normalizeProduct(payload);
}
