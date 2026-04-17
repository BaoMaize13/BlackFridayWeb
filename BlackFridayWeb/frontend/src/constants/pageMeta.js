import { ROUTES } from "./routes";

export const PAGE_META = {
  login: {
    title: "Secure Access",
    description: "Authenticate into the oversell and distributed locking control surface.",
    breadcrumbs: ["Login"],
    quickActions: []
  },
  dashboard: {
    title: "System Dashboard",
    description: "Monitor oversell posture, backend readiness, recent activity, and concurrency telemetry from one place.",
    breadcrumbs: ["Dashboard"],
    quickActions: [ROUTES.products, ROUTES.noLockSimulation, ROUTES.withLockSimulation, ROUTES.compareSimulation]
  },
  products: {
    title: "Product Catalog",
    description: "Manage the inventory catalog, review stock posture, and jump into operational or simulation flows.",
    breadcrumbs: ["Operations", "Products"],
    quickActions: [ROUTES.inventory, ROUTES.purchase, ROUTES.purchaseHistory]
  },
  productDetail: {
    title: "Product Detail",
    description: "Inspect one product across stock, transaction signals, recent events, and concurrency-related actions.",
    breadcrumbs: ["Operations", "Products", "Detail"],
    quickActions: [ROUTES.inventory, ROUTES.purchase, ROUTES.noLockSimulation, ROUTES.withLockSimulation]
  },
  inventory: {
    title: "Inventory Control",
    description: "Review stock posture, update quantities safely, reset inventory, and inspect stock mutation history.",
    breadcrumbs: ["Operations", "Inventory"],
    quickActions: [ROUTES.products, ROUTES.purchase, ROUTES.purchaseHistory]
  },
  purchase: {
    title: "Purchase Execution",
    description: "Submit purchase requests against the real backend contract and observe result, stock, and recent activity.",
    breadcrumbs: ["Operations", "Purchase"],
    quickActions: [ROUTES.products, ROUTES.purchaseHistory, ROUTES.orders]
  },
  purchaseHistory: {
    title: "Purchase History",
    description: "Trace purchase attempts over time with filters, detail view, and status-aware diagnostics.",
    breadcrumbs: ["Operations", "Purchase History"],
    quickActions: [ROUTES.orders, ROUTES.logs, ROUTES.products]
  },
  noLock: {
    title: "No Lock Simulation",
    description: "Demonstrate race conditions, oversell exposure, and uncontrolled concurrency without protection.",
    breadcrumbs: ["Concurrency", "No Lock Simulation"],
    quickActions: [ROUTES.withLockSimulation, ROUTES.compareSimulation, ROUTES.lockMonitor]
  },
  withLock: {
    title: "With Lock Simulation",
    description: "Validate lock-protected execution, queue behavior, and data consistency under concurrent pressure.",
    breadcrumbs: ["Concurrency", "With Lock Simulation"],
    quickActions: [ROUTES.noLockSimulation, ROUTES.compareSimulation, ROUTES.lockMonitor]
  },
  compare: {
    title: "Compare Simulation",
    description: "Tell the oversell story side by side by comparing unlocked and protected concurrency runs.",
    breadcrumbs: ["Concurrency", "Compare Simulation"],
    quickActions: [ROUTES.noLockSimulation, ROUTES.withLockSimulation, ROUTES.testReport]
  },
  orders: {
    title: "Order Registry",
    description: "Audit order creation outcomes, failure reasons, and request-level operational detail.",
    breadcrumbs: ["Operations", "Orders"],
    quickActions: [ROUTES.purchaseHistory, ROUTES.logs, ROUTES.products]
  },
  lockMonitor: {
    title: "Lock Monitor",
    description: "Inspect the live lock state, queue depth, and event timeline for distributed coordination.",
    breadcrumbs: ["Concurrency", "Lock Monitor"],
    quickActions: [ROUTES.withLockSimulation, ROUTES.compareSimulation, ROUTES.logs]
  },
  logs: {
    title: "Purchase Logs",
    description: "Filter technical logs, inspect event detail, and trace stock-changing purchase behavior.",
    breadcrumbs: ["Observability", "Purchase Logs"],
    quickActions: [ROUTES.orders, ROUTES.lockMonitor, ROUTES.testReport]
  },
  testCases: {
    title: "Test Cases",
    description: "Review and trigger concurrency-focused test cases without breaking the backend contract.",
    breadcrumbs: ["Observability", "Test Cases"],
    quickActions: [ROUTES.testReport, ROUTES.compareSimulation]
  },
  testReport: {
    title: "Test Report",
    description: "Review execution outcomes, pass/fail distribution, and evidence from concurrency validation runs.",
    breadcrumbs: ["Observability", "Test Report"],
    quickActions: [ROUTES.testCases, ROUTES.compareSimulation, ROUTES.logs]
  },
  settings: {
    title: "System Settings",
    description: "Manage integration-ready system settings, maintenance actions, and configuration history safely.",
    breadcrumbs: ["Admin", "Settings"],
    quickActions: [ROUTES.dashboard, ROUTES.lockMonitor]
  },
  notFound: {
    title: "Page Not Found",
    description: "The requested route is not part of the configured frontend workspace.",
    breadcrumbs: ["Not Found"],
    quickActions: [ROUTES.dashboard]
  }
};
