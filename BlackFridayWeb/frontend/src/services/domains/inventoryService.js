import { coerceArray, normalizeLog, normalizeProduct } from "../api/adapters";
import { listLogs } from "./logService";
import { listProducts } from "./productService";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";

export async function getInventoryOverview() {
  const { items } = await listProducts({ page: 1, pageSize: 100 });
  return {
    totalProducts: items.length,
    inStock: items.filter((product) => (product.stock ?? 0) > 0).length,
    outOfStock: items.filter((product) => (product.stock ?? 0) <= 0).length,
    lowStock: items.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 10).length
  };
}

export async function listInventory(filters = {}) {
  const payload = await apiClient.request(endpoints.admin.products, {
    query: {
      code: filters.code
    }
  });

  return coerceArray(payload).map(normalizeProduct);
}

export async function getInventoryHistory(productsById = new Map()) {
  const { items } = await listLogs({ page: 1, pageSize: 100 }, productsById);
  return items.filter(
    (entry) =>
      entry.action?.toUpperCase().includes("STOCK") ||
      entry.stockBefore !== null ||
      entry.stockAfter !== null
  );
}

export async function updateInventoryStock(productId, stock) {
  const payload = await apiClient.request(endpoints.admin.updateProductStock(productId), {
    method: "PATCH",
    body: { stock }
  });
  return normalizeProduct(payload);
}

export async function resetInventoryStock(productId, stock) {
  const payload = await apiClient.request(endpoints.admin.resetProduct(productId), {
    method: "POST",
    body: {
      clearLogs: true,
      clearOrders: true,
      stock
    }
  });
  return normalizeProduct(payload?.data?.product ?? payload);
}
