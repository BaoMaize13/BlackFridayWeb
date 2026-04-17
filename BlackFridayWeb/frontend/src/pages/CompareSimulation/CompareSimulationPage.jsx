import { GitCompareArrows, ShieldAlert, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import ComparisonBars from "../../components/charts/ComparisonBars";
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
import {
  runCompareSimulation,
  runNoLockSimulation,
  runWithLockSimulation
} from "../../services/domains/simulationService";
import { isEndpointUnavailable } from "../../utils/errors";
import { formatDurationMs, formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultConfig = {
  productId: "",
  threads: "10",
  quantity: "1",
  totalRequests: "50",
  lockType: "pessimistic"
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
    lockType: config.lockType || "pessimistic"
  };
}

function buildFallbackCompare(noLock, withLock) {
  return {
    source: "paired-run-fallback",
    summary: {
      productId: noLock.summary.productId ?? withLock.summary.productId ?? null,
      totalRequests: noLock.summary.totalRequests ?? withLock.summary.totalRequests ?? 0,
      initialStock: noLock.summary.initialStock ?? withLock.summary.initialStock ?? null,
      durationMs: (noLock.summary.durationMs ?? 0) + (withLock.summary.durationMs ?? 0)
    },
    noLock,
    withLock,
    metrics: []
  };
}

async function runCompareWorkspace(payload) {
  try {
    const response = await runCompareSimulation(payload);
    return {
      ...response,
      source: "compare-endpoint"
    };
  } catch (error) {
    if (!isEndpointUnavailable(error)) {
      throw error;
    }

    const [noLock, withLock] = await Promise.all([
      runNoLockSimulation(payload),
      runWithLockSimulation(payload)
    ]);

    return buildFallbackCompare(noLock, withLock);
  }
}

function buildMetrics(result) {
  if (result.metrics?.length) {
    return result.metrics;
  }

  const noLock = result.noLock?.summary ?? {};
  const withLock = result.withLock?.summary ?? {};

  return [
    {
      label: "Success Count",
      noLock: noLock.successCount ?? 0,
      withLock: withLock.successCount ?? 0,
      verdict:
        (withLock.successCount ?? 0) >= (noLock.successCount ?? 0)
          ? "Protected path sustains at least the same throughput."
          : "Protected path reduced throughput."
    },
    {
      label: "Failure Count",
      noLock: noLock.failureCount ?? 0,
      withLock: withLock.failureCount ?? 0,
      verdict:
        (withLock.failureCount ?? 0) <= (noLock.failureCount ?? 0)
          ? "Locking reduced failure pressure."
          : "Failures increased even with locking."
    },
    {
      label: "Oversell Flag",
      noLock: noLock.oversellDetected ? "YES" : "NO",
      withLock: withLock.oversellDetected ? "YES" : "NO",
      verdict:
        noLock.oversellDetected && !withLock.oversellDetected
          ? "Protected path removed oversell exposure."
          : "Oversell difference was not eliminated."
    },
    {
      label: "Consistency",
      noLock: noLock.consistent === false ? "BROKEN" : "OK",
      withLock: withLock.consistent === false ? "BROKEN" : "OK",
      verdict:
        noLock.consistent === false && withLock.consistent !== false
          ? "Locking restored consistency."
          : "Consistency improvement is not obvious from current data."
    },
    {
      label: "Duration",
      noLock: formatDurationMs(noLock.durationMs),
      withLock: formatDurationMs(withLock.durationMs),
      verdict: "Compare safety gains against latency cost."
    }
  ];
}

function getVerdict(result) {
  const noLock = result.noLock?.summary ?? {};
  const withLock = result.withLock?.summary ?? {};

  if (noLock.oversellDetected && !withLock.oversellDetected && withLock.consistent !== false) {
    return {
      title: "Locking clearly improves concurrency safety",
      tone: "success",
      description:
        "The unlocked path shows oversell or inconsistency signals while the protected path keeps state coherent."
    };
  }

  if (withLock.consistent === false || withLock.oversellDetected) {
    return {
      title: "Protected path still needs backend attention",
      tone: "warn",
      description:
        "The backend returned residual issues even with locking, so the comparison should be used to inspect queue and contention details."
    };
  }

  return {
    title: "Comparison completed with mixed evidence",
    tone: "info",
    description:
      "The frontend captured both runs, but the backend data does not yet produce a strong no-lock versus with-lock contrast."
  };
}

function CompareSimulationPage() {
  const [form, setForm] = useState(defaultConfig);
  const [formError, setFormError] = useState("");
  const query = useApi(runCompareWorkspace);
  const { showToast } = useToast();

  const result = query.data;
  const metrics = useMemo(() => (result ? buildMetrics(result) : []), [result]);
  const verdict = result ? getVerdict(result) : null;

  const comparisonLeft = useMemo(
    () =>
      result?.noLock
        ? [
            { label: "Success", value: result.noLock.summary.successCount ?? 0 },
            { label: "Failed", value: result.noLock.summary.failureCount ?? 0 },
            { label: "Duration", value: result.noLock.summary.durationMs ?? 0 }
          ]
        : [],
    [result]
  );
  const comparisonRight = useMemo(
    () =>
      result?.withLock
        ? [
            { label: "Success", value: result.withLock.summary.successCount ?? 0 },
            { label: "Failed", value: result.withLock.summary.failureCount ?? 0 },
            { label: "Duration", value: result.withLock.summary.durationMs ?? 0 }
          ]
        : [],
    [result]
  );

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.productId.trim()) {
      setFormError("A real product id is required before running the comparison.");
      return;
    }

    try {
      const response = await query.execute(buildPayload(form));
      const nextVerdict = getVerdict(response);
      showToast({
        tone: nextVerdict.tone === "success" ? "success" : "warn",
        title: "Comparison completed",
        description:
          response.source === "compare-endpoint"
            ? "Dedicated compare endpoint responded successfully."
            : "Compare endpoint was unavailable, so the frontend paired real no-lock and protected runs."
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

      <SectionCard
        title="Comparison Config"
        description="Run the oversell story side by side so the demo can move cleanly from risk exposure to protected resolution."
      >
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
            <Field label="Product ID / SKU">
              <Input value={form.productId} onChange={handleChange("productId")} placeholder="product-001" disabled={query.loading} />
            </Field>
            <Field label="Threads">
              <Input type="number" min="1" value={form.threads} onChange={handleChange("threads")} disabled={query.loading} />
            </Field>
            <Field label="Quantity / Request">
              <Input type="number" min="1" value={form.quantity} onChange={handleChange("quantity")} disabled={query.loading} />
            </Field>
            <Field label="Total Requests">
              <Input type="number" min="1" value={form.totalRequests} onChange={handleChange("totalRequests")} disabled={query.loading} />
            </Field>
            <Field label="Lock Strategy">
              <Select value={form.lockType} onChange={handleChange("lockType")} disabled={query.loading}>
                <option value="pessimistic">Pessimistic</option>
                <option value="optimistic">Optimistic</option>
                <option value="mutex">Mutex</option>
                <option value="semaphore">Semaphore</option>
              </Select>
            </Field>
          </div>
          <InlineError message={formError || query.error} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" disabled={query.loading}>
              <GitCompareArrows size={16} />
              {query.loading ? "Running Compare" : "Run Comparison"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {query.loading && !result ? (
        <SectionCard title="Running Comparison" description="Collecting both unlocked and protected evidence from the backend.">
          <TableSkeleton rows={7} />
        </SectionCard>
      ) : null}

      {!query.loading && query.error && !result ? (
        <ErrorState
          title="Comparison unavailable"
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
          title="No comparison data yet"
          description="Submit a product and concurrency profile to generate the no-lock versus with-lock narrative."
        />
      ) : null}

      {result ? (
        <>
          <div className="stat-grid">
            <StatCard label="Product" value={result.summary.productId ?? form.productId} />
            <StatCard label="Requests" value={formatNumber(result.summary.totalRequests ?? 0)} />
            <StatCard label="Duration" value={formatDurationMs(result.summary.durationMs)} />
            <StatCard label="Source" value={result.source === "compare-endpoint" ? "Compare API" : "Fallback Pair"} />
          </div>

          <SectionCard title={verdict?.title} description={verdict?.description}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <StatusBadge status={verdict?.tone === "success" ? "SUCCESS" : verdict?.tone === "warn" ? "WARN" : "INFO"} />
              <StatusBadge
                status={result.noLock?.summary.oversellDetected ? "OVERSOLD" : "IDLE"}
                label={`No Lock: ${result.noLock?.summary.oversellDetected ? "Oversell" : "No flag"}`}
              />
              <StatusBadge
                status={result.withLock?.summary.consistent === false ? "FAILED" : "CONSISTENT"}
                label={`With Lock: ${result.withLock?.summary.consistent === false ? "Broken" : "Consistent"}`}
              />
            </div>
          </SectionCard>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <SectionCard title="No Lock" description="Unlocked execution path and its concurrency symptoms.">
              <div style={{ display: "grid", gap: "0.7rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <ShieldAlert size={16} color="#fda4af" />
                  <StatusBadge
                    status={result.noLock?.summary.oversellDetected ? "OVERSOLD" : "WARN"}
                    label={result.noLock?.summary.oversellDetected ? "Oversell risk surfaced" : "Unlocked run"}
                  />
                </div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Success: {formatNumber(result.noLock?.summary.successCount ?? 0)}
                </div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Failed: {formatNumber(result.noLock?.summary.failureCount ?? 0)}
                </div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Final stock: {formatNumber(result.noLock?.summary.finalStock)}
                </div>
              </div>
            </SectionCard>

            <SectionCard title="With Lock" description="Protected execution path, queue behavior, and consistency posture.">
              <div style={{ display: "grid", gap: "0.7rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
                  <ShieldCheck size={16} color="#86efac" />
                  <StatusBadge
                    status={result.withLock?.summary.consistent === false ? "WARN" : "CONSISTENT"}
                    label={result.withLock?.summary.consistent === false ? "Needs attention" : "Protected state"}
                  />
                </div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Success: {formatNumber(result.withLock?.summary.successCount ?? 0)}
                </div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Queue depth: {formatNumber(result.withLock?.summary.waitingQueue ?? 0)}
                </div>
                <div style={{ color: "var(--color-text-secondary)" }}>
                  Contentions: {formatNumber(result.withLock?.summary.contentionCount ?? 0)}
                </div>
              </div>
            </SectionCard>
          </div>

          {result.noLock && result.withLock ? (
            <ComparisonBars left={comparisonLeft} right={comparisonRight} />
          ) : null}

          <SectionCard title="Metrics Comparison" description="Structured comparison that keeps the demo argument explicit.">
            <DataTable
              columns={[
                { key: "label", header: "Metric" },
                { key: "noLock", header: "No Lock" },
                { key: "withLock", header: "With Lock" },
                { key: "verdict", header: "Verdict" }
              ]}
              rows={metrics}
              getRowKey={(item) => item.label}
            />
          </SectionCard>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <SectionCard title="No-Lock Logs" description="Evidence stream from the uncontrolled run.">
              {result.noLock?.logs?.length ? (
                <div style={{ display: "grid", gap: "0.75rem", maxHeight: "22rem", overflow: "auto" }}>
                  {result.noLock.logs.map((entry, index) => (
                    <div key={`nolock-${index}`} style={{ padding: "0.8rem 0.9rem", borderRadius: "0.9rem", border: "1px solid var(--color-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                        <StatusBadge status={entry.level} />
                        <span className="mono" style={{ color: "var(--color-text-muted)", fontSize: "0.76rem" }}>
                          {formatShortDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <div style={{ marginTop: "0.55rem", color: "var(--color-text-secondary)" }}>{entry.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No no-lock logs" description="The backend did not return detailed log lines for the unlocked run." />
              )}
            </SectionCard>

            <SectionCard title="Protected Logs" description="Evidence stream from the lock-controlled run.">
              {result.withLock?.logs?.length ? (
                <div style={{ display: "grid", gap: "0.75rem", maxHeight: "22rem", overflow: "auto" }}>
                  {result.withLock.logs.map((entry, index) => (
                    <div key={`withlock-${index}`} style={{ padding: "0.8rem 0.9rem", borderRadius: "0.9rem", border: "1px solid var(--color-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                        <StatusBadge status={entry.level} />
                        <span className="mono" style={{ color: "var(--color-text-muted)", fontSize: "0.76rem" }}>
                          {formatShortDateTime(entry.timestamp)}
                        </span>
                      </div>
                      <div style={{ marginTop: "0.55rem", color: "var(--color-text-secondary)" }}>{entry.message}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No protected logs" description="The backend did not return detailed log lines for the protected run." />
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default CompareSimulationPage;
