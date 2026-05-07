import {
  normalizePurchaseResponse
} from "../api/adapters";
import { apiClient } from "../api/apiClient";
import { endpoints } from "../api/endpoints";
import { getOrderById, listOrders } from "./orderService";

function resolveActorUserId(explicitUserId) {
  if (explicitUserId) {
    return String(explicitUserId);
  }

  return "frontend-demo-user";
}

function buildRequestId(prefix) {
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${randomSuffix}`;
}

async function submitPurchase(path, payload, modeLabel) {
  const requestPayload = {
    productId: Number(payload.productId),
    quantity: Number(payload.quantity ?? 1) || 1,
    requestId: payload.requestId || buildRequestId(`fe-${modeLabel}`),
    userId: resolveActorUserId(payload.userId)
  };
  const responsePayload = await apiClient.request(path, {
    auth: false,
    method: "POST",
    body: requestPayload
  });

  return normalizePurchaseResponse(responsePayload);
}

export async function submitPurchaseNoLock(payload) {
  return submitPurchase(endpoints.purchase.noLock, payload, "no-lock");
}

export async function submitPurchaseWithLock(payload) {
  return submitPurchase(endpoints.purchase.withLock, payload, "with-lock");
}

export async function getRecentPurchases(productsById = new Map()) {
  const response = await listOrders({ page: 1, pageSize: 25 }, productsById);
  return response.items.slice(0, 10);
}

export async function getPurchaseHistory(filters = {}, productsById = new Map()) {
  return listOrders(filters, productsById);
}

export async function getPurchaseHistoryDetail(id, productsById = new Map()) {
  return getOrderById(id, productsById);
}
