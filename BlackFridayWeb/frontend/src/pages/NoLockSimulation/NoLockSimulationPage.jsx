import { AlertTriangle, ShieldOff } from "lucide-react";
import { useMemo, useState } from "react";

import BarChart from "../../components/charts/BarChart";
import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import InlineError from "../../components/feedback/InlineError";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import { Field, Input } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";
import { runNoLockSimulation } from "../../services/domains/simulationService";
import { formatDurationMs, formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultConfig = {
  productId: "",
  threads: "10",
  quantity: "1",
  totalRequests: "50",
  initialStock: ""
};

function buildPayload(config) {
  return {
    product_id: config.productId || undefined,
    productId: config.productId || undefined,
    threads: Number(config.threads) || 10,
    quantity: Number(config.quantity) || 1,
    total_requests: Number(config.totalRequests) || 50,
    totalRequests: Number(config.totalRequests) || 50,
    initial_stock: config.initialStock ? Number(config.initialStock) : undefined,
    initialStock: config.initialStock ? Number(config.initialStock) : undefined
  };
}

function NoLockSimulationPage() {
  const [form, setForm] = useState(defaultConfig);
  const [formError, setFormError] = useState("");
  const query = useApi(runNoLockSimulation);
  const { showToast } = useToast();

  const result = query.data;
  const summary = result?.summary ?? null;
  const chartItems = useMemo(
    () => [
      { label: "Success", value: summary?.successCount ?? 0 },
      { label: "Failed", value: summary?.failureCount ?? 0 },
      { label: "Requests", value: summary?.totalRequests ?? 0 }
    ],
    [summary]
  );

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.productId.trim()) {
      setFormError("A real product id is required so the simulation can hit the backend contract.");
      return;
    }

    try {
      const response = await query.execute(buildPayload(form));
      showToast({
        tone:
          response.summary?.oversellDetected || response.summary?.consistent === false
            ? "warn"
            : "success",
        title: "No-lock simulation completed",
        description:
          response.summary?.oversellDetected
            ? "Oversell risk surfaced from the backend response."
            : "The backend completed the run without explicit oversell detection."
      });
    } catch (error) {
      setFormError(error.message);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader
        onRefresh={result ? () => query.execute(buildPayload(form)) : undefined}
        refreshing={query.loading}
        actions={
          <Button
            tone="ghost"
            onClick={() => {
              setForm(defaultConfig);
              setFormError("");
              query.reset();
            }}
          >
            Reset Workspace
          </Button>
        }
      />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
        <SectionCard
          title="Simulation Config"
          description="Run the unlocked concurrency path against the backend without adding any frontend-side mock behavior."
        >
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
            <Field
              label="Product ID / SKU"
              hint="Use a backend-recognized product identifier so the run targets a real record."
            >
              <Input
                value={form.productId}
                onChange={handleChange("productId")}
                placeholder="product-001"
                disabled={query.loading}
              />
            </Field>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "1rem" }}>
              <Field label="Threads">
                <Input type="number" min="1" value={form.threads} onChange={handleChange("threads")} disabled={query.loading} />
              </Field>
              <Field label="Quantity / Request">
                <Input type="number" min="1" value={form.quantity} onChange={handleChange("quantity")} disabled={query.loading} />
              </Field>
              <Field label="Total Requests">
                <Input type="number" min="1" value={form.totalRequests} onChange={handleChange("totalRequests")} disabled={query.loading} />
              </Field>
            </div>
            <Field
              label="Initial Stock (Optional)"
              hint="Send only when the backend compare/simulation flow supports explicit stock reset or override."
            >
              <Input type="number" min="0" value={form.initialStock} onChange={handleChange("initialStock")} disabled={query.loading} />
            </Field>
            <InlineError message={formError || query.error} />
            <Button type="submit" tone="danger" disabled={query.loading}>
              <ShieldOff size={16} />
              {query.loading ? "Running Simulation" : "Run No-Lock Simulation"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Risk Framing"
          description="This path intentionally exposes race-condition behavior so the oversell story stays visible in demos."
        >
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <StatusBadge status="CRITICAL" label="No Protection" />
              <StatusBadge status="OVERSOLD" label="Oversell Risk" />
              <StatusBadge status="RUNNING" label="Concurrent Stress" />
            </div>
            <div style={{ display: "grid", gap: "0.75rem", color: "var(--color-text-secondary)" }}>
              <div>
                Requests compete without a lock boundary, so the frontend focuses on showing inconsistency,
                negative stock outcomes, and failure clustering.
              </div>
              <div>
                The UI never fabricates results. If the backend does not return detailed metrics, the page falls
                back to structured empty states instead of synthetic telemetry.
              </div>
            </div>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                padding: "1rem",
                borderRadius: "1rem",
                border: "1px solid rgba(239,68,68,0.2)",
                background: "rgba(127,29,29,0.12)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "#fda4af" }}>
                <AlertTriangle size={16} />
                <strong>High-risk demo mode</strong>
              </div>
              <div style={{ color: "var(--color-text-secondary)" }}>
                Use this screen to show why distributed locking matters, not as a recommended operating mode.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {query.loading && !result ? (
        <SectionCard title="Running Simulation" description="Waiting for the backend to finish the uncontrolled concurrency run.">
          <TableSkeleton rows={7} />
        </SectionCard>
      ) : null}

      {!query.loading && query.error && !result ? (
        <ErrorState
          title="Simulation unavailable"
          description={query.error}
          action={
            <Button tone="secondary" onClick={() => query.execute(buildPayload(form))}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!query.loading && !query.error && !result ? (
        <EmptyState
          title="No simulation data yet"
          description="Configure the product and concurrency parameters, then run the no-lock scenario to collect backend evidence."
        />
      ) : null}

      {result ? (
        <>
          <div className="stat-grid">
            <StatCard label="Requests" value={formatNumber(summary?.totalRequests ?? 0)} />
            <StatCard label="Success" value={formatNumber(summary?.successCount ?? 0)} />
            <StatCard label="Failed" value={formatNumber(summary?.failureCount ?? 0)} />
            <StatCard label="Duration" value={formatDurationMs(summary?.durationMs)} />
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
            <SectionCard title="Outcome Summary" description="Backend-reported concurrency outcome without protective locking.">
              <div style={{ display: "grid", gap: "0.9rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <StatusBadge
                    status={summary?.oversellDetected ? "OVERSOLD" : "IDLE"}
                    label={summary?.oversellDetected ? "Oversell detected" : "No oversell flag"}
                  />
                  <StatusBadge
                    status={summary?.consistent === false ? "FAILED" : "SUCCESS"}
                    label={summary?.consistent === false ? "Inconsistent state" : "Consistency not broken"}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.45rem", color: "var(--color-text-secondary)" }}>
                  <div>Product ID: {summary?.productId ?? form.productId}</div>
                  <div>Initial stock: {formatNumber(summary?.initialStock)}</div>
                  <div>Final stock: {formatNumber(summary?.finalStock)}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Distribution" description="Success/failure shape from the backend response.">
              <BarChart items={chartItems} />
            </SectionCard>
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
            <SectionCard title="Request Details" description="Per-request output returned by the simulation endpoint.">
              {result.results.length ? (
                <DataTable
                  columns={[
                    { key: "thread", header: "Thread" },
                    { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
                    { key: "stockBefore", header: "Before", render: (item) => formatNumber(item.stockBefore) },
                    { key: "stockAfter", header: "After", render: (item) => formatNumber(item.stockAfter) },
                    { key: "quantity", header: "Qty", render: (item) => formatNumber(item.quantity) },
                    { key: "timestamp", header: "Timestamp", render: (item) => formatShortDateTime(item.timestamp) }
                  ]}
                  rows={result.results}
                  getRowKey={(item) => item.id}
                />
              ) : (
                <EmptyState
                  title="No row-level results returned"
                  description="The simulation completed, but the backend did not expose per-request detail rows."
                />
              )}
            </SectionCard>

            <SectionCard title="Event Logs" description="Raw log lines emitted during the unlocked run.">
              {result.logs.length ? (
                <div style={{ display: "grid", gap: "0.75rem", maxHeight: "24rem", overflow: "auto" }}>
                  {result.logs.map((entry, index) => (
                    <div
                      key={`${entry.timestamp ?? index}-${index}`}
                      style={{
                        padding: "0.8rem 0.9rem",
                        borderRadius: "0.9rem",
                        border: "1px solid var(--color-border)",
                        background:
                          String(entry.level).toUpperCase() === "ERROR"
                            ? "rgba(127,29,29,0.12)"
                            : "rgba(17,30,51,0.72)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                        <StatusBadge status={entry.level} />
                        <span className="mono" style={{ color: "var(--color-text-muted)", fontSize: "0.76rem" }}>
                          {formatShortDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <div style={{ marginTop: "0.55rem", color: "var(--color-text-secondary)" }}>
                        {entry.message}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No logs returned"
                  description="The backend did not return event logs for this run, so the frontend stays empty instead of inventing a timeline."
                />
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default NoLockSimulationPage;
