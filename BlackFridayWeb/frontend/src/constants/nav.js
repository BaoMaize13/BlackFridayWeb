import { ROUTES } from "./routes";

export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ key: "dashboard", label: "Dashboard", icon: "layout-dashboard", to: ROUTES.dashboard }]
  },
  {
    label: "Operations",
    items: [
      { key: "products", label: "Products", icon: "package-search", to: ROUTES.products },
      { key: "inventory", label: "Inventory", icon: "warehouse", to: ROUTES.inventory },
      { key: "purchase", label: "Purchase", icon: "shopping-cart", to: ROUTES.purchase },
      { key: "purchaseHistory", label: "Purchase History", icon: "scroll-text", to: ROUTES.purchaseHistory },
      { key: "orders", label: "Orders", icon: "receipt-text", to: ROUTES.orders }
    ]
  },
  {
    label: "Concurrency",
    items: [
      { key: "noLock", label: "No Lock Simulation", icon: "shield-off", to: ROUTES.noLockSimulation },
      { key: "withLock", label: "With Lock Simulation", icon: "shield-check", to: ROUTES.withLockSimulation },
      { key: "compare", label: "Compare Simulation", icon: "git-compare-arrows", to: ROUTES.compareSimulation },
      { key: "lockMonitor", label: "Lock Monitor", icon: "lock-keyhole", to: ROUTES.lockMonitor }
    ]
  },
  {
    label: "Observability",
    items: [
      { key: "logs", label: "Purchase Logs", icon: "logs", to: ROUTES.logs },
      { key: "testCases", label: "Test Cases", icon: "flask-conical", to: ROUTES.testCases },
      { key: "testReport", label: "Test Report", icon: "chart-column-increasing", to: ROUTES.testReport }
    ]
  },
  {
    label: "Admin",
    items: [{ key: "settings", label: "Settings", icon: "settings-2", to: ROUTES.settings }]
  }
];
