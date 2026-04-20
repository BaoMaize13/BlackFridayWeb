import { coerceArray, coercePagination, normalizeProduct } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listProducts(filters = {}) {
  const payload = await apiClient.request(endpoints.admin.products, {
    query: {
      code: filters.code
    }
  });

  const items = coerceArray(payload).map(normalizeProduct);
  return {
    items,
    pagination: coercePagination(payload, items.length)
  };
}

export async function getProductById(id) {
  const payload = await apiClient.request(endpoints.admin.productDetail(id));
  return normalizeProduct(payload);
}
