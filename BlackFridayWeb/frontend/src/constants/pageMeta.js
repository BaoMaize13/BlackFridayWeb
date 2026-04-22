import { ROUTES } from "./routes";

export const PAGE_META = {
  login: {
    title: "Truy cập an toàn",
    description: "Xác thực để truy cập workspace điều phối oversell và distributed locking.",
    breadcrumbs: ["Đăng nhập"],
    quickActions: []
  },
  dashboard: {
    title: "Bảng điều khiển hệ thống",
    description: "Theo dõi trạng thái oversell, mức sẵn sàng của backend, hoạt động gần đây và telemetry đồng thời tại một nơi.",
    breadcrumbs: ["Bảng điều khiển"],
    quickActions: [ROUTES.products, ROUTES.noLockSimulation, ROUTES.withLockSimulation, ROUTES.compareSimulation]
  },
  products: {
    title: "Danh mục sản phẩm",
    description: "Quản lý danh mục, theo dõi tồn kho và chuyển nhanh sang các luồng vận hành hoặc mô phỏng.",
    breadcrumbs: ["Vận hành", "Sản phẩm"],
    quickActions: [ROUTES.inventory, ROUTES.purchase, ROUTES.purchaseHistory]
  },
  productDetail: {
    title: "Chi tiết sản phẩm",
    description: "Phân tích một sản phẩm theo tồn kho, tín hiệu giao dịch, sự kiện gần đây và hành vi liên quan đồng thời.",
    breadcrumbs: ["Vận hành", "Sản phẩm", "Chi tiết"],
    quickActions: [ROUTES.inventory, ROUTES.purchase, ROUTES.noLockSimulation, ROUTES.withLockSimulation]
  },
  inventory: {
    title: "Điều phối tồn kho",
    description: "Theo dõi tồn kho, cập nhật số lượng an toàn, reset dữ liệu và kiểm tra lịch sử thay đổi stock.",
    breadcrumbs: ["Vận hành", "Tồn kho"],
    quickActions: [ROUTES.products, ROUTES.purchase, ROUTES.purchaseHistory]
  },
  purchase: {
    title: "Thực thi mua hàng",
    description: "Gửi yêu cầu mua hàng theo contract backend thực tế và theo dõi kết quả, tồn kho cùng hoạt động gần đây.",
    breadcrumbs: ["Vận hành", "Mua hàng"],
    quickActions: [ROUTES.products, ROUTES.purchaseHistory, ROUTES.orders]
  },
  purchaseHistory: {
    title: "Lịch sử mua hàng",
    description: "Theo vết các lần mua theo thời gian với bộ lọc, chế độ xem chi tiết và chẩn đoán theo trạng thái.",
    breadcrumbs: ["Vận hành", "Lịch sử mua hàng"],
    quickActions: [ROUTES.orders, ROUTES.logs, ROUTES.products]
  },
  noLock: {
    title: "Mô phỏng no-lock",
    description: "Trình diễn race condition, rủi ro oversell và hành vi đồng thời không có cơ chế bảo vệ.",
    breadcrumbs: ["Mô phỏng đồng thời", "No-lock"],
    quickActions: [ROUTES.withLockSimulation, ROUTES.compareSimulation, ROUTES.lockMonitor]
  },
  withLock: {
    title: "Mô phỏng with-lock",
    description: "Xác thực luồng lock-protected, hành vi queue và độ nhất quán dữ liệu dưới tải đồng thời.",
    breadcrumbs: ["Mô phỏng đồng thời", "With-lock"],
    quickActions: [ROUTES.noLockSimulation, ROUTES.compareSimulation, ROUTES.lockMonitor]
  },
  compare: {
    title: "So sánh mô phỏng",
    description: "Trình bày rõ bài toán oversell bằng cách so sánh trực tiếp giữa kịch bản no-lock và with-lock.",
    breadcrumbs: ["Mô phỏng đồng thời", "So sánh"],
    quickActions: [ROUTES.noLockSimulation, ROUTES.withLockSimulation, ROUTES.testReport]
  },
  orders: {
    title: "Quản lý đơn hàng",
    description: "Theo dõi kết quả tạo đơn, nguyên nhân thất bại và chi tiết vận hành ở cấp request.",
    breadcrumbs: ["Vận hành", "Đơn hàng"],
    quickActions: [ROUTES.purchaseHistory, ROUTES.logs, ROUTES.products]
  },
  lockMonitor: {
    title: "Giám sát lock",
    description: "Quan sát lock state theo thời gian thực, queue depth và timeline sự kiện trong môi trường distributed.",
    breadcrumbs: ["Mô phỏng đồng thời", "Giám sát lock"],
    quickActions: [ROUTES.withLockSimulation, ROUTES.compareSimulation, ROUTES.logs]
  },
  logs: {
    title: "Nhật ký mua hàng",
    description: "Lọc technical logs, phân tích chi tiết sự kiện và theo dõi các thay đổi stock theo từng giao dịch.",
    breadcrumbs: ["Giám sát", "Nhật ký mua hàng"],
    quickActions: [ROUTES.orders, ROUTES.lockMonitor, ROUTES.testReport]
  },
  testCases: {
    title: "Danh sách test case",
    description: "Rà soát và kích hoạt test case tập trung vào concurrency mà vẫn tuân thủ backend contract.",
    breadcrumbs: ["Giám sát", "Test case"],
    quickActions: [ROUTES.testReport, ROUTES.compareSimulation]
  },
  testReport: {
    title: "Báo cáo kiểm thử",
    description: "Tổng hợp kết quả chạy test, phân bố pass/fail và evidence từ các phiên kiểm thử concurrency.",
    breadcrumbs: ["Giám sát", "Báo cáo kiểm thử"],
    quickActions: [ROUTES.testCases, ROUTES.compareSimulation, ROUTES.logs]
  },
  settings: {
    title: "Thiết lập hệ thống",
    description: "Quản lý thiết lập tích hợp, thao tác bảo trì và lịch sử cấu hình một cách an toàn.",
    breadcrumbs: ["Quản trị", "Thiết lập"],
    quickActions: [ROUTES.dashboard, ROUTES.lockMonitor]
  },
  notFound: {
    title: "Không tìm thấy trang",
    description: "Route bạn yêu cầu không nằm trong workspace frontend hiện tại.",
    breadcrumbs: ["Không tìm thấy"],
    quickActions: [ROUTES.dashboard]
  }
};
