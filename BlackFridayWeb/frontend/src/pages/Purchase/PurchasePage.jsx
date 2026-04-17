import { useEffect, useMemo, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import InlineError from "../../components/feedback/InlineError";
import { SectionCard, StatCard } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";
import { getProductById, listProducts } from "../../services/domains/productService";
import { getRecentPurchases, submitPurchase } from "../../services/domains/purchaseService";
import { formatCurrency, formatNumber, formatShortDateTime } from "../../utils/formatters";

async function loadPurchaseWorkspace() {
  const [products, activity] = await Promise.all([
    listProducts({ page: 1, pageSize: 100 }),
    getRecentPurchases()
  ]);

  return {
    products: products.items,
    activity
  };
}

function PurchasePage() {
  const workspaceQuery = useApi(loadPurchaseWorkspace);
  const productQuery = useApi((productId) => getProductById(productId));
  const { showToast } = useToast();
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    workspaceQuery.execute().catch(() => null);
  }, []);

  useEffect(() => {
    if (!selectedProductId) return;
    productQuery.execute(selectedProductId).catch(() => null);
  }, [selectedProductId]);

  const selectedProduct = useMemo(
    () =>
      productQuery.data ??
      workspaceQuery.data?.products.find((item) => String(item.id) === String(selectedProductId)) ??
      null,
    [productQuery.data, workspaceQuery.data, selectedProductId]
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError("");

    try {
      const purchaseResult = await submitPurchase(selectedProductId, Number(quantity));
      setResult(purchaseResult);
      showToast({
        tone: purchaseResult.success ? "success" : "warn",
        title: purchaseResult.success ? "Purchase accepted" : "Purchase returned a warning",
        description: purchaseResult.message
      });
      await workspaceQuery.execute();
      if (selectedProductId) {
        await productQuery.execute(selectedProductId);
      }
    } catch (error) {
      setSubmitError(error.message);
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => workspaceQuery.execute()} refreshing={workspaceQuery.loading} />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.25fr 1fr" }}>
        <SectionCard title="Purchase Request" description="Submit a real purchase request through the shared API layer.">
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
            <Field label="Product">
              <Select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)}>
                <option value="">Choose a product</option>
                {(workspaceQuery.data?.products ?? []).map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity">
              <Input type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
            </Field>
            <InlineError message={submitError} />
            <Button type="submit" disabled={!selectedProductId || submitting}>
              {submitting ? "Submitting" : "Submit Purchase"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard title="Selected Product" description="Current product posture before submitting a purchase.">
          {selectedProduct ? (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              <StatCard label="Stock" value={formatNumber(selectedProduct.stock ?? 0)} />
              <StatCard label="Price" value={formatCurrency(selectedProduct.price)} />
              <StatusBadge status={(selectedProduct.stock ?? 0) > 0 ? "ACTIVE" : "OFFLINE"} label={(selectedProduct.stock ?? 0) > 0 ? "Purchasable" : "Unavailable"} />
            </div>
          ) : (
            <EmptyState title="Choose a product first" description="Product details will appear here after selection." />
          )}
        </SectionCard>
      </div>

      {result ? (
        <SectionCard title="Latest Purchase Result" description="The last response returned by the backend.">
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <StatusBadge status={result.success ? "SUCCESS" : "FAILED"} />
            <div>{result.message}</div>
            <div>Order ID: {result.orderId ?? "—"}</div>
            <div>Request ID: {result.requestId ?? "—"}</div>
            <div>New Stock: {formatNumber(result.newStock)}</div>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Recent Purchase Activity" description="Live purchase activity from backend responses, without mocked transactions.">
        {workspaceQuery.data?.activity?.length ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {workspaceQuery.data.activity.slice(0, 8).map((entry) => (
              <div
                key={entry.id}
                style={{
                  padding: "0.9rem 1rem",
                  borderRadius: "1rem",
                  border: "1px solid var(--color-border)",
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "1rem"
                }}
              >
                <div>
                  <strong>{entry.productName}</strong>
                  <div style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
                    {entry.requestId ?? entry.id}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <StatusBadge status={entry.status} />
                  <div style={{ color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                    {formatShortDateTime(entry.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No recent purchases yet" description="Activity will show up here when the backend exposes or accepts purchase records." />
        )}
      </SectionCard>
    </div>
  );
}

export default PurchasePage;
