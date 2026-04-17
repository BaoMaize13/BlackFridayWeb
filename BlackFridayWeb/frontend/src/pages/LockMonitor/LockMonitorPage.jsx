import { Activity, LockKeyhole, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import InlineError from "../../components/feedback/InlineError";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import { Field, Input } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useToast } from "../../hooks/useToast";
import { getLockEvents, getLockQueue, getLockState } from "../../services/domains/lockService";
import { formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultConfig = {
  productId: "",
  timeout: "5000",
  leaseDuration: "2000",
  retryCount: "3",
  refreshInterval: "5"
};

function toArray(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value?.items)) return value.items;
  if (Array.isArray(value?.queue)) return value.queue;
  if (Array.isArray(value?.events)) return value.events;
  if (Array.isArray(value?.records)) return value.records;
  return [];
}

function normalizeState(payload) {
  const value = payload?.lock_state ?? payload?.lockState ?? payload ?? {};
  return {
    owner: value.owner ?? value.holder ?? value.clientId ?? null,
    acquiredAt: value.acquired_at ?? value.acquiredAt ?? null,
    expiresAt: value.expires_at ?? value.expiresAt ?? null,
    lockType: value.type ?? value.lock_type ?? value.lockType ?? null,
    status:
      value.status ??
      (value.owner || value.holder ? "ACTIVE" : "IDLE")
  };
}

function normalizeQueue(payload) {
  return toArray(payload).map((item, index) => ({
    id: item.id ?? item.request_id ?? item.requestId ?? `${index + 1}`,
    requestId: item.request_id ?? item.requestId ?? item.id ?? `${index + 1}`,
    clientId: item.client_id ?? item.clientId ?? item.owner ?? "unknown-client",
    retries: item.retries ?? item.retry_count ?? item.retryCount ?? 0,
    arrivedAt: item.arrived_at ?? item.arrivedAt ?? item.timestamp ?? null
  }));
}

function normalizeEvents(payload) {
  return toArray(payload).map((item, index) => ({
    id: item.id ?? `${index + 1}`,
    type: item.type ?? item.event_type ?? item.name ?? "EVENT",
    actor: item.actor ?? item.client_id ?? item.clientId ?? item.owner ?? "system",
    detail: item.detail ?? item.details ?? item.message ?? "No event detail returned.",
    timestamp: item.timestamp ?? item.ts ?? item.createdAt ?? item.created_at ?? null
  }));
}

async function loadLockWorkspace(config) {
  const [stateResult, queueResult, eventsResult] = await Promise.allSettled([
    getLockState(config),
    getLockQueue(config),
    getLockEvents(config)
  ]);

  const fulfilledCount = [stateResult, queueResult, eventsResult].filter(
    (entry) => entry.status === "fulfilled"
  ).length;

  if (!fulfilledCount) {
    throw new Error("Lock monitor endpoints did not return any data.");
  }

  const warnings = [stateResult, queueResult, eventsResult]
    .filter((entry) => entry.status === "rejected")
    .map((entry) => entry.reason?.message ?? "Unknown endpoint error");

  return {
    state: stateResult.status === "fulfilled" ? normalizeState(stateResult.value) : normalizeState(null),
    queue: queueResult.status === "fulfilled" ? normalizeQueue(queueResult.value) : [],
    events: eventsResult.status === "fulfilled" ? normalizeEvents(eventsResult.value) : [],
    warnings
  };
}

function LockMonitorPage() {
  const [form, setForm] = useState(defaultConfig);
  const [formError, setFormError] = useState("");
  const [activeConfig, setActiveConfig] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const query = useApi(loadLockWorkspace);
  const { showToast } = useToast();

  const snapshot = query.data;
  const state = snapshot?.state ?? {};
  const queue = snapshot?.queue ?? [];
  const events = snapshot?.events ?? [];
  const refreshMs = Math.max(1000, (Number(form.refreshInterval) || 5) * 1000);

  useEffect(() => {
    if (!autoRefresh || !activeConfig) return undefined;

    const timerId = window.setInterval(() => {
      query.execute(activeConfig).catch(() => null);
    }, refreshMs);

    return () => window.clearInterval(timerId);
  }, [autoRefresh, activeConfig, refreshMs]);

  const expiryText = useMemo(() => {
    if (!state.expiresAt) return "—";
    const diff = new Date(state.expiresAt).getTime() - Date.now();
    if (Number.isNaN(diff)) return "—";
    return diff <= 0 ? "Expired" : `${Math.ceil(diff / 1000)}s remaining`;
  }, [state.expiresAt, query.loading]);

  const handleChange = (key) => (event) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
  };

  const buildConfig = () => ({
    product_id: form.productId || undefined,
    productId: form.productId || undefined,
    timeout: Number(form.timeout) || 5000,
    lock_timeout: Number(form.timeout) || 5000,
    lease_duration: Number(form.leaseDuration) || 2000,
    retry_count: Number(form.retryCount) || 3
  });

  const startMonitoring = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.productId.trim()) {
      setFormError("A real product id is required before starting lock monitoring.");
      return;
    }

    const config = buildConfig();
    setActiveConfig(config);

    try {
      await query.execute(config);
      showToast({
        tone: "success",
        title: "Lock monitoring started",
        description: autoRefresh
          ? "Live polling is active."
          : "Use Refresh or enable auto refresh to keep the snapshot live."
      });
    } catch (error) {
      setFormError(error.message);
    }
  };

  const stopMonitoring = () => {
    setActiveConfig(null);
    setAutoRefresh(false);
    setFormError("");
    query.reset();
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader
        onRefresh={activeConfig ? () => query.execute(activeConfig) : undefined}
        refreshing={query.loading}
        actions={
          activeConfig ? (
            <>
              <Button
                tone={autoRefresh ? "success" : "secondary"}
                onClick={() => setAutoRefresh((current) => !current)}
              >
                <RefreshCw size={16} />
                {autoRefresh ? "Auto Refresh On" : "Auto Refresh Off"}
              </Button>
              <Button tone="ghost" onClick={stopMonitoring}>
                Stop Monitoring
              </Button>
            </>
          ) : null
        }
      />

      <SectionCard
        title="Monitor Config"
        description="Attach the monitor to a real product and lock policy so the frontend can poll current state, queue, and timeline endpoints."
      >
        <form onSubmit={startMonitoring} style={{ display: "grid", gap: "1rem" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr repeat(4, minmax(0, 1fr))", gap: "1rem" }}>
            <Field label="Product ID / SKU">
              <Input value={form.productId} onChange={handleChange("productId")} placeholder="product-001" disabled={query.loading} />
            </Field>
            <Field label="Timeout (ms)">
              <Input type="number" min="100" value={form.timeout} onChange={handleChange("timeout")} disabled={query.loading} />
            </Field>
            <Field label="Lease Duration (ms)">
              <Input type="number" min="100" value={form.leaseDuration} onChange={handleChange("leaseDuration")} disabled={query.loading} />
            </Field>
            <Field label="Retry Count">
              <Input type="number" min="0" value={form.retryCount} onChange={handleChange("retryCount")} disabled={query.loading} />
            </Field>
            <Field label="Refresh Interval (s)">
              <Input type="number" min="1" value={form.refreshInterval} onChange={handleChange("refreshInterval")} disabled={query.loading} />
            </Field>
          </div>
          <InlineError message={formError || query.error} />
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" disabled={query.loading}>
              <Activity size={16} />
              {query.loading ? "Connecting" : activeConfig ? "Refresh Monitor" : "Start Monitoring"}
            </Button>
          </div>
        </form>
      </SectionCard>

      {query.loading && !snapshot ? (
        <SectionCard title="Connecting to Lock Monitor" description="Waiting for lock state, queue, and event data.">
          <TableSkeleton rows={6} />
        </SectionCard>
      ) : null}

      {!query.loading && query.error && !snapshot ? (
        <ErrorState
          title="Lock monitor unavailable"
          description={query.error}
          action={
            <Button tone="secondary" onClick={() => activeConfig && query.execute(activeConfig)}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!query.loading && !query.error && !snapshot ? (
        <EmptyState
          title="No active monitoring session"
          description="Start monitoring to surface current lock ownership, queue depth, and event timeline from the backend."
        />
      ) : null}

      {snapshot ? (
        <>
          <div className="stat-grid">
            <StatCard label="Lock Status" value={state.status ?? "IDLE"} />
            <StatCard label="Queue Depth" value={formatNumber(queue.length)} />
            <StatCard label="Events" value={formatNumber(events.length)} />
            <StatCard label="Auto Refresh" value={autoRefresh ? "On" : "Off"} />
          </div>

          {snapshot.warnings?.length ? (
            <SectionCard title="Partial Endpoint Coverage" description="Some lock monitor endpoints failed, but the page kept the available data visible.">
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {snapshot.warnings.map((warning, index) => (
                  <InlineError key={`${warning}-${index}`} message={warning} />
                ))}
              </div>
            </SectionCard>
          ) : null}

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <SectionCard title="Current Lock State" description="Live ownership and lease posture for the targeted product.">
              <div style={{ display: "grid", gap: "0.9rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <StatusBadge status={state.status} label={state.owner ? "Acquired" : "Released"} />
                  <StatusBadge status={state.owner ? "ACTIVE" : "IDLE"} label={state.lockType ?? "Unknown lock"} />
                </div>
                <div style={{ display: "grid", gap: "0.45rem", color: "var(--color-text-secondary)" }}>
                  <div>Owner: {state.owner ?? "No active owner"}</div>
                  <div>Acquired at: {formatShortDateTime(state.acquiredAt)}</div>
                  <div>Lease: {expiryText}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Config Summary" description="The active monitor uses the same config shown below for every refresh cycle.">
              <div style={{ display: "grid", gap: "0.45rem", color: "var(--color-text-secondary)" }}>
                <div>Product ID: {form.productId}</div>
                <div>Timeout: {formatNumber(form.timeout)} ms</div>
                <div>Lease duration: {formatNumber(form.leaseDuration)} ms</div>
                <div>Retry count: {formatNumber(form.retryCount)}</div>
              </div>
            </SectionCard>
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "0.9fr 1.1fr" }}>
            <SectionCard title="Queue Panel" description="Requests currently waiting for lock acquisition.">
              {queue.length ? (
                <div style={{ display: "grid", gap: "0.75rem", maxHeight: "24rem", overflow: "auto" }}>
                  {queue.map((item, index) => (
                    <div key={`${item.id}-${index}`} style={{ padding: "0.85rem 0.95rem", borderRadius: "0.95rem", border: "1px solid var(--color-border)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                        <div>
                          <strong>{item.requestId}</strong>
                          <div style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>{item.clientId}</div>
                        </div>
                        <div style={{ textAlign: "right", color: "var(--color-text-secondary)" }}>
                          <div>Retries: {formatNumber(item.retries)}</div>
                          <div style={{ marginTop: "0.25rem", color: "var(--color-text-muted)" }}>
                            {formatShortDateTime(item.arrivedAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No waiting requests" description="The queue endpoint returned an empty state for the current product." />
              )}
            </SectionCard>

            <SectionCard title="Events Timeline" description="Recent lock acquisition, release, retry, and timeout events.">
              {events.length ? (
                <div style={{ display: "grid", gap: "0.75rem", maxHeight: "24rem", overflow: "auto" }}>
                  {events
                    .slice()
                    .reverse()
                    .map((event) => (
                      <div key={`${event.id}-${event.timestamp}`} style={{ padding: "0.85rem 0.95rem", borderRadius: "0.95rem", border: "1px solid var(--color-border)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                          <StatusBadge status={event.type} label={event.type} />
                          <span className="mono" style={{ color: "var(--color-text-muted)", fontSize: "0.76rem" }}>
                            {formatShortDateTime(event.timestamp)}
                          </span>
                        </div>
                        <div style={{ marginTop: "0.55rem", color: "var(--color-text-secondary)" }}>
                          Actor: {event.actor}
                        </div>
                        <div style={{ marginTop: "0.25rem", color: "var(--color-text-muted)" }}>
                          {event.detail}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <EmptyState title="No events returned" description="The backend did not return timeline events for this monitoring session." />
              )}
            </SectionCard>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default LockMonitorPage;
