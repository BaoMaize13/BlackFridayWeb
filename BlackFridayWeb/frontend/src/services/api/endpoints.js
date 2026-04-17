export const endpoints = {
  auth: {
    login: import.meta.env.VITE_AUTH_LOGIN_PATH || "/api/auth/login",
    validate: import.meta.env.VITE_AUTH_VALIDATE_PATH || "/api/auth/validate"
  },
  health: "/api/health",
  dashboard: {
    stats: ["/api/dashboard/stats"],
    systemStatus: ["/api/dashboard/system-status"],
    latestRun: ["/api/dashboard/latest-run"],
    activity: ["/api/dashboard/recent-activity"]
  },
  products: {
    list: ["/api/products", "/api/v1/products"],
    detail: (id) => [`/api/products/${id}`, `/api/inventory/${id}`]
  },
  inventory: {
    overview: ["/api/inventory/overview"],
    list: ["/api/inventory", "/api/products"],
    history: ["/api/inventory/history"],
    update: (id) => `/api/inventory/${id}/stock`,
    reset: "/api/inventory/reset"
  },
  purchase: {
    submit: "/api/purchase",
    recent: ["/api/purchases/recent", "/api/orders"],
    history: ["/api/purchase-history", "/api/orders"],
    detail: (id) => [`/api/purchase-history/${id}`, `/api/orders/${id}`]
  },
  orders: {
    list: ["/api/orders", "/api/purchase-history"],
    detail: (id) => [`/api/orders/${id}`, `/api/purchase-history/${id}`]
  },
  logs: {
    list: ["/api/logs", "/api/purchase-logs"]
  },
  simulation: {
    noLock: "/api/simulation/no-lock",
    withLock: "/api/simulation/with-lock",
    compare: "/api/simulation/compare"
  },
  lock: {
    state: "/api/lock/state",
    queue: "/api/lock/queue",
    events: "/api/lock/events"
  },
  tests: {
    cases: ["/api/test-cases"],
    run: (id) => `/api/test-cases/${id}/run`,
    reports: ["/api/test-reports"],
    report: (id) => `/api/test-reports/${id}`
  },
  settings: {
    current: "/api/system/settings",
    history: "/api/system/settings/history",
    action: (name) => `/api/system/actions/${name}`
  }
};
