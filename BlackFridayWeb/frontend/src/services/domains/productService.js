import { coerceArray, coercePagination, normalizeProduct } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function listProducts(filters = {}) {
  const payload = await apiClient.request(endpoints.products.list, {
    auth: false,
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
  const payload = await apiClient.request(endpoints.products.detail(id), {
    auth: false
  });
  return normalizeProduct(payload);
}

export async function resetProductStock(id, stock, options = {}) {
  const payload = await apiClient.request(endpoints.products.resetStock(id), {
    auth: false,
    method: "POST",
    body: {
      clearLogs: options.clearLogs ?? true,
      clearOrders: options.clearOrders ?? true,
      stock
    }
  });

  return normalizeProduct(payload?.data?.product ?? payload?.product ?? payload);
}
