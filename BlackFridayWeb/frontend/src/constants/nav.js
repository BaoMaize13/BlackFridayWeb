import { ROUTES } from "./routes";

export const NAV_GROUPS = [
  {
    label: "Tổng quan",
    items: [{ key: "dashboard", label: "Bảng điều khiển", icon: "layout-dashboard", to: ROUTES.dashboard }]
  },
  {
    label: "Vận hành",
    items: [
      { key: "products", label: "Sản phẩm", icon: "package-search", to: ROUTES.products },
      { key: "inventory", label: "Tồn kho", icon: "warehouse", to: ROUTES.inventory },
      { key: "purchase", label: "Mua hàng", icon: "shopping-cart", to: ROUTES.purchase },
      { key: "purchaseHistory", label: "Lịch sử mua hàng", icon: "scroll-text", to: ROUTES.purchaseHistory },
      { key: "orders", label: "Đơn hàng", icon: "receipt-text", to: ROUTES.orders }
    ]
  },
  {
    label: "Mô phỏng đồng thời",
    items: [
      { key: "noLock", label: "Mô phỏng no-lock", icon: "shield-off", to: ROUTES.noLockSimulation },
      { key: "withLock", label: "Mô phỏng with-lock", icon: "shield-check", to: ROUTES.withLockSimulation },
      { key: "compare", label: "So sánh mô phỏng", icon: "git-compare-arrows", to: ROUTES.compareSimulation }
    ]
  },
  {
    label: "Giám sát",
    items: [{ key: "logs", label: "Nhật ký mua hàng", icon: "logs", to: ROUTES.logs }]
  }
];
