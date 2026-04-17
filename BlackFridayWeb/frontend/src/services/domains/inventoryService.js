import { coerceArray, normalizeLog, normalizeProduct } from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";
import { listLogs } from "./logService";
import { listProducts } from "./productService";

export async function getInventoryOverview() {
  try {
    return await apiClient.requestFirst(endpoints.inventory.overview);
  } catch {
    const { items } = await listProducts({ page: 1, pageSize: 100 });
    return {
      totalProducts: items.length,
      inStock: items.filter((product) => (product.stock ?? 0) > 0).length,
      outOfStock: items.filter((product) => (product.stock ?? 0) <= 0).length,
      lowStock: items.filter((product) => (product.stock ?? 0) > 0 && (product.stock ?? 0) <= 10).length
    };
  }
}

export async function listInventory(filters = {}) {
  const payload = await apiClient.requestFirst(
    endpoints.inventory.list.map((path) => ({
      path,
      query: {
        page: filters.page,
        limit: filters.pageSize,
        size: filters.pageSize,
        search: filters.search
      }
    }))
  );

  return coerceArray(payload).map(normalizeProduct);
}

export async function getInventoryHistory(productsById = new Map()) {
  try {
    const payload = await apiClient.requestFirst(endpoints.inventory.history);
    return coerceArray(payload).map((entry) => normalizeLog(entry, productsById));
  } catch {
    const { items } = await listLogs({ page: 1, pageSize: 100 }, productsById);
    return items.filter(
      (entry) =>
        entry.action?.toUpperCase().includes("STOCK") ||
        entry.stockBefore !== null ||
        entry.stockAfter !== null
    );
  }
}

export async function updateInventoryStock(productId, stock) {
  const payload = await apiClient.request(endpoints.inventory.update(productId), {
    method: "PUT",
    body: { stock }
  });
  return normalizeProduct(payload);
}

export async function resetInventoryStock(stock) {
  return apiClient.request(endpoints.inventory.reset, {
    method: "POST",
    body: { stock }
  });
}
