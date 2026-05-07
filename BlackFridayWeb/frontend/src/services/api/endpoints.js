const ADMIN_BASE_PATH = "/api/admin";

export const endpoints = {
  auth: {
    login: import.meta.env.VITE_AUTH_LOGIN_PATH || "/api/auth/login",
    register: import.meta.env.VITE_AUTH_REGISTER_PATH || "/api/auth/register",
    me: import.meta.env.VITE_AUTH_ME_PATH || "/api/auth/me",
    logout: import.meta.env.VITE_AUTH_LOGOUT_PATH || "/api/auth/logout"
  },
  health: "/api/health",
  products: {
    list: "/api/products",
    detail: (id) => `/api/products/${id}`,
    resetStock: (id) => `/api/products/${id}/reset-stock`,
    resetAll: "/api/products/reset-all"
  },
  admin: {
    products: `${ADMIN_BASE_PATH}/products`,
    productDetail: (id) => `${ADMIN_BASE_PATH}/products/${id}`,
    updateProductStock: (id) => `${ADMIN_BASE_PATH}/products/${id}/stock`,
    resetProduct: (id) => `${ADMIN_BASE_PATH}/products/${id}/reset`,
    orders: `${ADMIN_BASE_PATH}/orders`,
    orderDetail: (id) => `${ADMIN_BASE_PATH}/orders/${id}`,
    attemptLogs: `${ADMIN_BASE_PATH}/attempt-logs`,
    attemptLogTrace: (requestId) => `${ADMIN_BASE_PATH}/attempt-logs/${requestId}`,
    stats: `${ADMIN_BASE_PATH}/stats`,
    metrics: `${ADMIN_BASE_PATH}/metrics`
  },
  purchase: {
    history: "/api/purchase/history",
    noLock: "/api/purchase/no-lock",
    withLock: "/api/purchase/with-lock",
    optimisticLock: "/api/purchase/optimistic-lock"
  },
  simulation: {
    noLock: "/api/simulation/no-lock",
    withLock: "/api/simulation/with-lock",
    compare: "/api/simulation/compare",
    reports: "/api/simulation/reports",
    reportDetail: (id) => `/api/simulation/reports/${id}`
  },
  locks: {
    status: "/api/locks/status",
    metrics: "/api/locks/metrics",
    clearExpired: "/api/locks/clear-expired"
  }
};
