import { LockKeyhole, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import BarChart from "../../components/charts/BarChart";
import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import InlineError from "../../components/feedback/InlineError";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";
import { runWithLockSimulation } from "../../services/domains/simulationService";
import { formatDurationMs, formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultConfig = {
  productId: "",
  threads: "10",
  quantity: "1",
  totalRequests: "50",
  lockType: "pessimistic",
  lockTimeout: "5000"
};

function buildPayload(config) {
  return {
    product_id: config.productId || undefined,
    productId: config.productId || undefined,
    threads: Number(config.threads) || 10,
    quantity: Number(config.quantity) || 1,
    total_requests: Number(config.totalRequests) || 50,
    totalRequests: Number(config.totalRequests) || 50,
    lock_type: config.lockType || "pessimistic",
    lockType: config.lockType || "pessimistic",
    lock_timeout: Number(config.lockTimeout) || 5000,
    lockTimeout: Number(config.lockTimeout) || 5000
  };
}

function WithLockSimulationPage() {
  const [form, setForm] = useState(defaultConfig);
  const [formError, setFormError] = useState("");
  const query = useApi(runWithLockSimulation);
  const { showToast } = useToast();

  const result = query.data;
  const summary = result?.summary ?? null;
  const chartItems = useMemo(
    () => [
      { label: "Success", value: summary?.successCount ?? 0 },
      { label: "Failed", value: summary?.failureCount ?? 0 },
      { label: "Contentions", value: summary?.contentionCount ?? 0 }
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
      setFormError("A real product id is required before the protected flow can run.");
      return;
    }

    try {
      const response = await query.execute(buildPayload(form));
      showToast({
        tone:
          response.summary?.consistent === false || response.summary?.oversellDetected
            ? "warn"
            : "success",
        title: "Protected simulation completed",
        description:
          response.summary?.consistent === false
            ? "The backend reported a consistency issue even with locking."
            : "The protected flow completed and the frontend captured the returned queue metrics."
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
          title="Protected Config"
          description="Run the same concurrency pressure with lock parameters so the backend can demonstrate queueing and consistency controls."
        >
          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
            <Field label="Product ID / SKU">
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <Field label="Lock Strategy">
                <Select value={form.lockType} onChange={handleChange("lockType")} disabled={query.loading}>
                  <option value="pessimistic">Pessimistic Lock</option>
                  <option value="optimistic">Optimistic Lock</option>
                  <option value="mutex">Mutex</option>
                  <option value="semaphore">Semaphore</option>
                </Select>
              </Field>
              <Field label="Lock Timeout (ms)">
                <Input type="number" min="100" value={form.lockTimeout} onChange={handleChange("lockTimeout")} disabled={query.loading} />
              </Field>
            </div>
            <InlineError message={formError || query.error} />
            <Button type="submit" tone="success" disabled={query.loading}>
              <ShieldCheck size={16} />
              {query.loading ? "Running Simulation" : "Run Protected Simulation"}
            </Button>
          </form>
        </SectionCard>

        <SectionCard
          title="Protection Signals"
          description="The page highlights queueing, consistency, and lock contention instead of generic success counters only."
        >
          <div style={{ display: "grid", gap: "1rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <StatusBadge status="SUCCESS" label="Protected Flow" />
              <StatusBadge status="WAITING" label="Queue Aware" />
              <StatusBadge status="CONSISTENT" label="Consistency Focus" />
            </div>
            <div style={{ display: "grid", gap: "0.75rem", color: "var(--color-text-secondary)" }}>
              <div>Lock type: {form.lockType}</div>
              <div>Timeout budget: {formatNumber(form.lockTimeout)} ms</div>
              <div>Backend queue and contention fields are rendered as-is when the endpoint provides them.</div>
            </div>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                padding: "1rem",
                borderRadius: "1rem",
                border: "1px solid rgba(34,197,94,0.22)",
                background: "rgba(20,83,45,0.16)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", color: "#86efac" }}>
                <LockKeyhole size={16} />
                <strong>Consistency-preserving mode</strong>
              </div>
              <div style={{ color: "var(--color-text-secondary)" }}>
                This screen is built to prove that lock-backed execution limits oversell and exposes queue behavior clearly.
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      {query.loading && !result ? (
        <SectionCard title="Running Protected Simulation" description="Waiting for the backend to finish the lock-controlled run.">
          <TableSkeleton rows={7} />
        </SectionCard>
      ) : null}

      {!query.loading && query.error && !result ? (
        <ErrorState
          title="Protected simulation unavailable"
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
          title="No protected run yet"
          description="Submit the config to compare lock-backed behavior against the no-lock scenario."
        />
      ) : null}

      {result ? (
        <>
          <div className="stat-grid">
            <StatCard label="Requests" value={formatNumber(summary?.totalRequests ?? 0)} />
            <StatCard label="Success" value={formatNumber(summary?.successCount ?? 0)} />
            <StatCard label="Queue Depth" value={formatNumber(summary?.waitingQueue ?? 0)} />
            <StatCard label="Duration" value={formatDurationMs(summary?.durationMs)} />
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
            <SectionCard title="Protection Outcome" description="Backend-reported consistency and lock execution summary.">
              <div style={{ display: "grid", gap: "0.9rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <StatusBadge
                    status={summary?.consistent === false ? "FAILED" : "CONSISTENT"}
                    label={summary?.consistent === false ? "Consistency violated" : "Consistency maintained"}
                  />
                  <StatusBadge
                    status={summary?.oversellDetected ? "OVERSOLD" : "SUCCESS"}
                    label={summary?.oversellDetected ? "Oversell detected" : "No oversell flag"}
                  />
                </div>
                <div style={{ display: "grid", gap: "0.45rem", color: "var(--color-text-secondary)" }}>
                  <div>Lock type: {summary?.lockType ?? form.lockType}</div>
                  <div>Contentions: {formatNumber(summary?.contentionCount ?? 0)}</div>
                  <div>Final stock: {formatNumber(summary?.finalStock)}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Distribution" description="Protected run metrics rendered from backend output.">
              <BarChart items={chartItems} />
            </SectionCard>
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
            <SectionCard title="Request Details" description="Per-request results, including lock wait when returned by the backend.">
              {result.results.length ? (
                <DataTable
                  columns={[
                    { key: "thread", header: "Thread" },
                    { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
                    { key: "stockBefore", header: "Before", render: (item) => formatNumber(item.stockBefore) },
                    { key: "stockAfter", header: "After", render: (item) => formatNumber(item.stockAfter) },
                    { key: "lockWaitMs", header: "Lock Wait", render: (item) => formatNumber(item.lockWaitMs) },
                    { key: "timestamp", header: "Timestamp", render: (item) => formatShortDateTime(item.timestamp) }
                  ]}
                  rows={result.results}
                  getRowKey={(item) => item.id}
                />
              ) : (
                <EmptyState
                  title="No row-level request details"
                  description="The backend finished the run but did not expose individual protected request rows."
                />
              )}
            </SectionCard>

            <SectionCard title="Lock & Queue Logs" description="Operational events emitted during the protected run.">
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
                          String(entry.message).toLowerCase().includes("lock")
                            ? "rgba(20,83,45,0.16)"
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
                  title="No protected logs returned"
                  description="The page is ready for queue and lock logs, but the backend did not return any for this run."
                />
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default WithLockSimulationPage;
