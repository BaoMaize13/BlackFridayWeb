import { useEffect, useMemo, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import InlineError from "../../components/feedback/InlineError";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../hooks/useToast";
import {
  getInventoryHistory,
  getInventoryOverview,
  listInventory,
  resetInventoryStock,
  updateInventoryStock
} from "../../services/domains/inventoryService";
import { formatNumber, formatShortDateTime } from "../../utils/formatters";

async function loadInventoryWorkspace() {
  const [overview, inventory, history] = await Promise.all([
    getInventoryOverview(),
    listInventory({ page: 1, pageSize: 100 }),
    getInventoryHistory()
  ]);

  return {
    overview,
    inventory,
    history
  };
}

function InventoryPage() {
  const [selectedProductId, setSelectedProductId] = useState("");
  const [stockValue, setStockValue] = useState("");
  const [resetValue, setResetValue] = useState("10");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const query = useApi(loadInventoryWorkspace);
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    query.execute().catch(() => null);
  }, []);

  const selectedProduct = useMemo(
    () => query.data?.inventory.find((item) => String(item.id) === String(selectedProductId)) ?? null,
    [query.data, selectedProductId]
  );

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedProductId) {
      setFormError("Choose a product before updating stock.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    try {
      await updateInventoryStock(selectedProductId, Number(stockValue));
      showToast({
        tone: "success",
        title: "Inventory updated",
        description: "The frontend sent the stock update to the real backend contract."
      });
      await query.execute();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!selectedProductId) {
      setFormError("Choose a product before resetting stock.");
      return;
    }

    const accepted = await confirm({
      title: "Reset inventory stock",
      description:
        "This sends a real reset request to the backend. Continue only if that endpoint is supported.",
      confirmLabel: "Reset Inventory"
    });

    if (!accepted) return;

    setSubmitting(true);
    setFormError("");

    try {
      await resetInventoryStock(selectedProductId, Number(resetValue));
      showToast({
        tone: "success",
        title: "Reset request sent",
        description: "The backend accepted the inventory reset action."
      });
      await query.execute();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Product",
      render: (product) => (
        <div>
          <strong>{product.name}</strong>
          <div className="mono" style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            {product.code ?? "No code"}
          </div>
        </div>
      )
    },
    { key: "stock", header: "Stock", render: (product) => formatNumber(product.stock ?? 0) },
    { key: "version", header: "Version", render: (product) => formatNumber(product.version ?? 0) },
    { key: "updatedAt", header: "Updated", render: (product) => formatShortDateTime(product.updatedAt) }
  ];

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => query.execute()} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Products" value={formatNumber(query.data?.overview?.totalProducts ?? 0)} />
        <StatCard label="In Stock" value={formatNumber(query.data?.overview?.inStock ?? 0)} />
        <StatCard label="Out of Stock" value={formatNumber(query.data?.overview?.outOfStock ?? 0)} />
        <StatCard label="Low Stock" value={formatNumber(query.data?.overview?.lowStock ?? 0)} />
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.4fr 1fr" }}>
        <SectionCard title="Inventory Table" description="Canonical inventory view with live stock and version information.">
          {query.loading && !query.data ? <TableSkeleton /> : null}
          {!query.loading && query.error ? <ErrorState title="Inventory unavailable" description={query.error} action={<Button tone="secondary" onClick={() => query.execute()}>Retry</Button>} /> : null}
          {!query.loading && !query.error && !query.data?.inventory.length ? (
            <EmptyState title="No inventory records returned" description="The page is production-ready, but the backend has not exposed inventory data yet." />
          ) : null}
          {!query.loading && !query.error && query.data?.inventory.length ? (
            <DataTable columns={columns} rows={query.data.inventory} getRowKey={(product) => product.id} />
          ) : null}
        </SectionCard>

        <div style={{ display: "grid", gap: "1rem" }}>
          <SectionCard title="Update Stock" description="Send a real stock update request without inventing frontend state.">
            <form onSubmit={handleUpdate} style={{ display: "grid", gap: "0.9rem" }}>
              <Field label="Product">
                <Select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                  <option value="">Choose a product</option>
                  {(query.data?.inventory ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="New Stock">
                <Input type="number" min="0" value={stockValue} onChange={(event) => setStockValue(event.target.value)} placeholder="Enter stock value" />
              </Field>
              {selectedProduct ? (
                <div style={{ color: "var(--color-text-muted)" }}>
                  Current stock: {formatNumber(selectedProduct.stock ?? 0)}
                </div>
              ) : null}
              <InlineError message={formError} />
              <Button type="submit" disabled={submitting}>
                {submitting ? "Updating" : "Update Stock"}
              </Button>
            </form>
          </SectionCard>

          <SectionCard title="Reset Inventory" description="Trigger the backend reset endpoint only after confirmation.">
            <div style={{ display: "grid", gap: "0.9rem" }}>
              <Field label="Product">
                <Select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                  <option value="">Choose a product</option>
                  {(query.data?.inventory ?? []).map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Reset Value">
                <Input type="number" min="0" value={resetValue} onChange={(event) => setResetValue(event.target.value)} />
              </Field>
              <Button tone="danger" onClick={handleReset} disabled={submitting}>
                {submitting ? "Submitting" : "Reset Inventory"}
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>

      <SectionCard title="Inventory History" description="Stock-related events derived from history or log endpoints.">
        {query.data?.history?.length ? (
          <DataTable
            columns={[
              { key: "productName", header: "Product" },
              { key: "action", header: "Action" },
              { key: "stockBefore", header: "Before", render: (entry) => formatNumber(entry.stockBefore) },
              { key: "stockAfter", header: "After", render: (entry) => formatNumber(entry.stockAfter) },
              { key: "createdAt", header: "Time", render: (entry) => formatShortDateTime(entry.createdAt) }
            ]}
            rows={query.data.history}
            getRowKey={(entry) => entry.id}
          />
        ) : (
          <EmptyState title="No stock history yet" description="History will appear here as soon as the backend exposes inventory changes." />
        )}
      </SectionCard>
    </div>
  );
}

export default InventoryPage;
