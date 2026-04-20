const ADMIN_BASE_PATH = "/api/admin";

export const endpoints = {
  auth: {
    login: import.meta.env.VITE_AUTH_LOGIN_PATH || "/api/auth/login",
    register: import.meta.env.VITE_AUTH_REGISTER_PATH || "/api/auth/register",
    me: import.meta.env.VITE_AUTH_ME_PATH || "/api/auth/me",
    logout: import.meta.env.VITE_AUTH_LOGOUT_PATH || "/api/auth/logout"
  },
  health: "/api/health",
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
    noLock: "/api/purchase/no-lock",
    withLock: "/api/purchase/with-lock"
  }
};
