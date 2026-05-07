import { Link, useParams } from "react-router-dom";
import { ArrowRight, Clock3, Package, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import PageSkeleton from "../../components/feedback/PageSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";
import { listLogs } from "../../services/domains/logService";
import { listOrders } from "../../services/domains/orderService";
import { getProductById, resetProductStock } from "../../services/domains/productService";
import { submitPurchaseNoLock, submitPurchaseWithLock } from "../../services/domains/purchaseService";
import { formatCurrency, formatNumber, formatShortDateTime, safeText } from "../../utils/formatters";

async function loadProductContext(id) {
  const product = await getProductById(id);
  const [ordersResult, logsResult] = await Promise.allSettled([
    listOrders({ page: 1, pageSize: 100, productId: id }),
    listLogs({ page: 1, pageSize: 100, productId: id })
  ]);

  const orders = ordersResult.status === "fulfilled" ? ordersResult.value.items.filter((entry) => String(entry.productId) === String(product.id)) : [];
  const logs = logsResult.status === "fulfilled" ? logsResult.value.items.filter((entry) => String(entry.productId) === String(product.id)) : [];

  return {
    product,
    orders,
    logs
  };
}

function ProductDetailPage() {
  const { id } = useParams();
  const query = useApi(() => loadProductContext(id));
  const { showToast } = useToast();
  const [actionBusy, setActionBusy] = useState("");

  useEffect(() => {
    query.execute().catch(() => null);
  }, [id]);

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
        <ErrorState title="Chi tiết sản phẩm tạm thời chưa khả dụng" description={query.error} action={<Button tone="secondary" onClick={() => query.execute()}>Thử lại</Button>} />
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

  const { product, orders, logs } = query.data;
  const recentEvents = [...orders, ...logs]
    .sort((left, right) => new Date(right.createdAt ?? right.timestamp ?? 0) - new Date(left.createdAt ?? left.timestamp ?? 0))
    .slice(0, 6);

  const runAction = async (key, action, successMessage) => {
    setActionBusy(key);
    try {
      await action();
      showToast({
        tone: "success",
        title: successMessage
      });
      await query.execute();
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Action failed",
        description: error.message
      });
    } finally {
      setActionBusy("");
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader
        onRefresh={() => query.execute()}
        refreshing={query.loading}
        actions={
          <>
            <Link to={ROUTES.inventory}>
              <Button tone="ghost">Inventory</Button>
            </Link>
            <Link to={ROUTES.purchase}>
              <Button tone="primary">Purchase</Button>
            </Link>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard label="Code" value={safeText(product.code)} icon={<Package size={16} />} hint="Primary product identifier" />
        <StatCard label="Current Stock" value={formatNumber(product.stock ?? 0)} icon={<ShieldCheck size={16} />} hint={product.stock > 0 ? "Available for transactions" : "Unavailable"} />
        <StatCard label="Price" value={formatCurrency(product.price)} icon={<Wallet size={16} />} hint="Unit price from backend" />
        <StatCard label="Version" value={formatNumber(product.version ?? 0)} icon={<Clock3 size={16} />} hint={`Updated ${formatShortDateTime(product.updatedAt)}`} />
      </div>

      <SectionCard title="Product Snapshot" description="Real product fields and direct operational context.">
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <div><strong>Name:</strong> {product.name}</div>
          <div><strong>Created:</strong> {formatShortDateTime(product.createdAt)}</div>
          <div><strong>Updated:</strong> {formatShortDateTime(product.updatedAt)}</div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <StatusBadge status={(product.stock ?? 0) > 0 ? "ACTIVE" : "OFFLINE"} label={(product.stock ?? 0) > 0 ? "In Stock" : "Out of Stock"} />
            <StatusBadge status={orders.length ? "ACTIVE" : "IDLE"} label={`${orders.length} Orders`} />
            <StatusBadge status={logs.length ? "ACTIVE" : "IDLE"} label={`${logs.length} Logs`} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            {[1, 5, 10].map((stock) => (
              <Button
                key={stock}
                tone="secondary"
                disabled={Boolean(actionBusy)}
                onClick={() => runAction(`reset-${stock}`, () => resetProductStock(product.id, stock), `Stock reset to ${stock}`)}
              >
                {actionBusy === `reset-${stock}` ? "Resetting" : `Reset ${stock}`}
              </Button>
            ))}
            <Button
              tone="danger"
              disabled={Boolean(actionBusy)}
              onClick={() => runAction("no-lock", () => submitPurchaseNoLock({ productId: product.id, quantity: 1 }), "No-lock purchase sent")}
            >
              {actionBusy === "no-lock" ? "Sending" : "Test No-Lock"}
            </Button>
            <Button
              tone="success"
              disabled={Boolean(actionBusy)}
              onClick={() => runAction("with-lock", () => submitPurchaseWithLock({ productId: product.id, quantity: 1 }), "With-lock purchase sent")}
            >
              {actionBusy === "with-lock" ? "Sending" : "Test With-Lock"}
            </Button>
          </div>
        </div>
      </SectionCard>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.2fr 1fr" }}>
        <SectionCard title="Recent Activity" description="Latest orders and stock-related log entries tied to this product.">
          {recentEvents.length ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {recentEvents.map((event, index) => (
                <div key={`${event.id}-${index}`} style={{ padding: "0.9rem 1rem", border: "1px solid var(--color-border)", borderRadius: "1rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                    <div>
                      <strong>{event.productName ?? event.action ?? "Sự kiện sản phẩm"}</strong>
                      <div style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                        {event.message ?? event.requestId ?? event.failureReason ?? "Chưa có thông tin bổ sung"}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusBadge status={event.status ?? event.level} />
                      <div style={{ color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                        {formatShortDateTime(event.createdAt ?? event.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có hoạt động cho sản phẩm này" description="Khi có order hoặc log liên quan, dữ liệu sẽ tự động hiển thị tại đây." />
          )}
        </SectionCard>

        <SectionCard title="Operational Paths" description="Jump directly into the next relevant flow for this product.">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {[
              { to: ROUTES.inventory, label: "Adjust inventory" },
              { to: ROUTES.purchase, label: "Run purchase flow" },
              { to: ROUTES.noLockSimulation, label: "Run no-lock simulation" },
              { to: ROUTES.withLockSimulation, label: "Run protected simulation" }
            ].map((item) => (
              <Link key={item.to} to={item.to}>
                <Button tone="ghost" style={{ width: "100%", justifyContent: "space-between" }}>
                  <span>{item.label}</span>
                  <ArrowRight size={16} />
                </Button>
              </Link>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

export default ProductDetailPage;
