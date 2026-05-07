import { Database, FileBarChart2, Package, ScrollText, Server, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";

import BarChart from "../../components/charts/BarChart";
import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import PageSkeleton from "../../components/feedback/PageSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { useApi } from "../../hooks/useApi";
import { listLogs } from "../../services/domains/logService";
import { listOrders } from "../../services/domains/orderService";
import { listProducts } from "../../services/domains/productService";
import { getAdminMetrics, getAdminStats, getHealth } from "../../services/domains/dashboardService";
import { formatPercent, formatShortDateTime, safeText } from "../../utils/formatters";

async function loadDashboardSnapshot() {
  const [healthResult, statsResult, metricsResult, productsResult, ordersResult, logsResult] =
    await Promise.allSettled([
      getHealth(),
      getAdminStats(),
      getAdminMetrics({ includeServerBreakdown: true }),
      listProducts({ page: 1, pageSize: 100 }),
      listOrders({ page: 1, pageSize: 100 }),
      listLogs({ page: 1, pageSize: 100 })
    ]);

  const fulfilled = [healthResult, statsResult, metricsResult, productsResult, ordersResult, logsResult].filter(
    (entry) => entry.status === "fulfilled"
  );

  if (!fulfilled.length) {
    throw new Error("Không có endpoint Dashboard nào phản hồi thành công.");
  }

  const products = productsResult.status === "fulfilled" ? productsResult.value.items : [];
  const orders = ordersResult.status === "fulfilled" ? ordersResult.value.items : [];
  const logs = logsResult.status === "fulfilled" ? logsResult.value.items : [];
  const stats = statsResult.status === "fulfilled" ? statsResult.value : null;
  const metrics = metricsResult.status === "fulfilled" ? metricsResult.value : null;

  const successfulOrders = stats?.successOrders ?? orders.filter((order) => order.status === "SUCCESS").length;
  const failedOrders = stats?.failedOrders ?? orders.filter((order) => order.status === "FAILED").length;
  const recentActivity = [
    ...orders.map((order) => ({
      id: `order-${order.id}`,
      label: order.productName,
      meta: `Order ${order.requestId ?? order.id}`,
      status: order.status,
      timestamp: order.createdAt
    })),
    ...logs.map((log) => ({
      id: `log-${log.id}`,
      label: log.action,
      meta: log.message,
      status: log.level,
      timestamp: log.createdAt
    }))
  ]
    .filter((item) => item.timestamp)
    .sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp))
    .slice(0, 8);

  return {
    health: healthResult.status === "fulfilled" ? healthResult.value : null,
    metrics,
    products,
    orders,
    logs,
    statsSnapshot: stats,
    stats: {
      productCount: stats?.totalProducts ?? products.length,
      orderCount: stats?.totalOrders ?? orders.length,
      successRate:
        stats?.totalOrders
          ? (successfulOrders / stats.totalOrders) * 100
          : orders.length
            ? (successfulOrders / orders.length) * 100
            : null,
      signalCount:
        failedOrders +
        logs.filter((entry) => entry.level === "ERROR").length +
        (metrics?.errors?.lockTimeout ?? 0)
    },
    recentActivity,
    chartItems: [
      { label: "Success", value: successfulOrders },
      { label: "Failed", value: failedOrders },
      { label: "Logs", value: logs.length },
      { label: "Products", value: products.length }
    ]
  };
}

function DashboardPage() {
  const query = useApi(loadDashboardSnapshot);

  useEffect(() => {
    query.execute().catch(() => null);
  }, []);

  if (query.loading && !query.data) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <PageHeader />
        <PageSkeleton />
      </div>
    );
  }

  if (query.error && !query.data) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <PageHeader onRefresh={() => query.execute()} />
        <ErrorState
          title="Dashboard tạm thời chưa khả dụng"
          description={query.error}
          action={<button className="button button--secondary" onClick={() => query.execute()}>Thử lại</button>}
        />
      </div>
    );
  }

  if (!query.data) {
    return (
      <div style={{ display: "grid", gap: "1rem" }}>
        <PageHeader onRefresh={() => query.execute()} refreshing={query.loading} />
        <PageSkeleton />
      </div>
    );
  }

  const data = query.data;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => query.execute()} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Backend" value={safeText(data.health?.status, "Tạm thời chưa khả dụng")} icon={<Server size={16} />} hint={safeText(data.health?.environment, "Chưa có metadata health")} />
        <StatCard label="Products" value={data.stats.productCount} icon={<Package size={16} />} hint="Products returned by real endpoints" />
        <StatCard label="Total Purchases" value={data.statsSnapshot?.totalOrders ?? data.orders.length} icon={<ShieldCheck size={16} />} hint={formatPercent(data.stats.successRate)} />
        <StatCard label="Oversell Signals" value={data.metrics?.consistencyCheck?.oversellDetected ? 1 : 0} icon={<ScrollText size={16} />} hint="From latest metrics endpoint" />
      </div>

      <SectionCard title="Quick Actions" description="Run the exact demo flows from real backend APIs.">
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link to={ROUTES.noLockSimulation}><Button tone="danger">Run No-Lock Simulation</Button></Link>
          <Link to={ROUTES.withLockSimulation}><Button tone="success">Run With-Lock Simulation</Button></Link>
          <Link to={ROUTES.compareSimulation}><Button>Compare No-Lock vs With-Lock</Button></Link>
          <Link to={ROUTES.testReport}><Button tone="secondary">View Test Report</Button></Link>
          <Link to={ROUTES.lockMonitor}><Button tone="ghost">Current Lock Status</Button></Link>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "2fr 1fr" }}>
        <SectionCard
          title="System Readiness"
          description="Current backend metadata and service posture."
        >
          {data.health ? (
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <StatusBadge status={data.health.status} />
                <StatusBadge status={data.health.services?.database?.status ?? "unknown"} label="Database" />
                <StatusBadge status={data.health.services?.redis?.status ?? "unknown"} label="Redis" />
              </div>
              <div style={{ display: "grid", gap: "0.45rem", color: "var(--color-text-secondary)" }}>
                <div>Server ID: {safeText(data.health.serverId)}</div>
                <div>Port: {safeText(data.health.serverPort)}</div>
                <div>Last health check: {formatShortDateTime(data.health.timestamp)}</div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="Health endpoint chưa sẵn sàng"
              description="Dashboard vẫn hoạt động, nhưng backend chưa trả về metadata health."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Activity Distribution"
          description="Counts from actual backend responses, without fabricated telemetry."
        >
          <BarChart items={data.chartItems} />
        </SectionCard>
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.4fr 1fr" }}>
        <SectionCard
          title="Recent Activity"
          description="Merged from real orders, logs, and reports when those endpoints respond."
        >
          {data.recentActivity.length ? (
            <div style={{ display: "grid", gap: "0.8rem" }}>
              {data.recentActivity.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "1rem",
                    padding: "0.9rem 1rem",
                    borderRadius: "1rem",
                    border: "1px solid var(--color-border)",
                    background: "rgba(18,32,56,0.7)"
                  }}
                >
                  <div>
                    <strong>{item.label}</strong>
                    <div style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>{item.meta}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <StatusBadge status={item.status} />
                    <div style={{ color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                      {formatShortDateTime(item.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent activity yet"
              description="The dashboard will surface real order, log, or report events as soon as those endpoints respond."
            />
          )}
        </SectionCard>

        <SectionCard
          title="Integration Coverage"
          description="Which real domains already returned data."
        >
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {[
              ["Health", Boolean(data.health), Server],
              ["Products", Boolean(data.products.length), Package],
              ["Orders", Boolean(data.orders.length), Database],
              ["Metrics", Boolean(data.metrics), FileBarChart2]
            ].map(([label, available, Icon]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <Icon size={16} />
                  <span>{label}</span>
                </div>
                <StatusBadge status={available ? "ACTIVE" : "IDLE"} label={available ? "Live" : "Waiting"} />
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default DashboardPage;
