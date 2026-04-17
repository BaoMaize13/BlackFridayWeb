import { createBrowserRouter, Navigate } from "react-router-dom";

import { PAGE_META } from "../constants/pageMeta";
import { ROUTES } from "../constants/routes";
import AppLayout from "../layouts/AppLayout";
import AuthLayout from "../layouts/AuthLayout";
import CompareSimulationPage from "../pages/CompareSimulation/CompareSimulationPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";
import InventoryPage from "../pages/Inventory/InventoryPage";
import LockMonitorPage from "../pages/LockMonitor/LockMonitorPage";
import LoginPage from "../pages/Login/LoginPage";
import NotFoundPage from "../pages/NotFound/NotFoundPage";
import NoLockSimulationPage from "../pages/NoLockSimulation/NoLockSimulationPage";
import OrderListPage from "../pages/OrderList/OrderListPage";
import ProductDetailPage from "../pages/ProductDetail/ProductDetailPage";
import ProductListPage from "../pages/ProductList/ProductListPage";
import PurchaseHistoryPage from "../pages/PurchaseHistory/PurchaseHistoryPage";
import PurchaseLogsPage from "../pages/PurchaseLogs/PurchaseLogsPage";
import PurchasePage from "../pages/Purchase/PurchasePage";
import SettingsPage from "../pages/Settings/SettingsPage";
import TestCasesPage from "../pages/TestCases/TestCasesPage";
import TestReportPage from "../pages/TestReport/TestReportPage";
import WithLockSimulationPage from "../pages/WithLockSimulation/WithLockSimulationPage";
import ProtectedRoute from "./routes/ProtectedRoute";
import RedirectIfAuthenticated from "./routes/RedirectIfAuthenticated";

const handle = (pageKey) => ({ pageKey, meta: PAGE_META[pageKey] });

export const router = createBrowserRouter([
  {
    path: ROUTES.root,
    element: <Navigate to={ROUTES.dashboard} replace />
  },
  {
    element: <RedirectIfAuthenticated />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          {
            path: ROUTES.login,
            element: <LoginPage />,
            handle: handle("login")
          }
        ]
      }
    ]
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: ROUTES.dashboard, element: <DashboardPage />, handle: handle("dashboard") },
          { path: ROUTES.products, element: <ProductListPage />, handle: handle("products") },
          { path: ROUTES.productDetail, element: <ProductDetailPage />, handle: handle("productDetail") },
          { path: ROUTES.inventory, element: <InventoryPage />, handle: handle("inventory") },
          { path: ROUTES.purchase, element: <PurchasePage />, handle: handle("purchase") },
          { path: ROUTES.purchaseHistory, element: <PurchaseHistoryPage />, handle: handle("purchaseHistory") },
          { path: ROUTES.noLockSimulation, element: <NoLockSimulationPage />, handle: handle("noLock") },
          { path: ROUTES.withLockSimulation, element: <WithLockSimulationPage />, handle: handle("withLock") },
          { path: ROUTES.compareSimulation, element: <CompareSimulationPage />, handle: handle("compare") },
          { path: ROUTES.orders, element: <OrderListPage />, handle: handle("orders") },
          { path: ROUTES.lockMonitor, element: <LockMonitorPage />, handle: handle("lockMonitor") },
          { path: ROUTES.logs, element: <PurchaseLogsPage />, handle: handle("logs") },
          { path: ROUTES.testCases, element: <TestCasesPage />, handle: handle("testCases") },
          { path: ROUTES.testReport, element: <TestReportPage />, handle: handle("testReport") },
          { path: ROUTES.settings, element: <SettingsPage />, handle: handle("settings") }
        ]
      }
    ]
  },
  {
    path: "*",
    element: <NotFoundPage />,
    handle: handle("notFound")
  }
]);
