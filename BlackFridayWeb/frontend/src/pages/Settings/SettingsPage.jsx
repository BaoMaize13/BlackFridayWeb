import { useEffect, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import InlineError from "../../components/feedback/InlineError";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useConfirm } from "../../hooks/useConfirm";
import { useToast } from "../../hooks/useToast";
import {
  getSettings,
  getSettingsHistory,
  triggerSystemAction,
  updateSettings
} from "../../services/domains/settingsService";
import { formatNumber, formatShortDateTime } from "../../utils/formatters";

function ToggleRow({ label, description, value, onToggle, disabled }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "1rem",
        alignItems: "center",
        padding: "1rem",
        borderRadius: "1rem",
        border: "1px solid var(--color-border)",
        background: "rgba(9,18,31,0.46)"
      }}
    >
      <div>
        <strong>{label}</strong>
        <div style={{ marginTop: "0.35rem", color: "var(--color-text-muted)" }}>{description}</div>
      </div>
      <Button tone={value ? "success" : "secondary"} onClick={onToggle} disabled={disabled}>
        {value ? "Enabled" : "Disabled"}
      </Button>
    </div>
  );
}

async function loadSettingsWorkspace() {
  const [settingsResult, historyResult] = await Promise.allSettled([
    getSettings(),
    getSettingsHistory()
  ]);

  if (settingsResult.status !== "fulfilled") {
    throw settingsResult.reason;
  }

  return {
    settings: settingsResult.value,
    history: historyResult.status === "fulfilled" ? historyResult.value : [],
    historyError: historyResult.status === "rejected" ? historyResult.reason?.message ?? "History unavailable." : null
  };
}

function SettingsPage() {
  const query = useApi(loadSettingsWorkspace);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState("");
  const [formError, setFormError] = useState("");
  const { confirm } = useConfirm();
  const { showToast } = useToast();

  useEffect(() => {
    query.execute().catch(() => null);
  }, []);

  useEffect(() => {
    if (query.data?.settings) {
      setForm(query.data.settings);
    }
  }, [query.data]);

  const patchForm = (key, value) => {
    setForm((current) => ({ ...(current ?? {}), [key]: value }));
  };

  const handleSave = async (scope) => {
    if (!form) return;
    setSaving(scope);
    setFormError("");

    try {
      const payload =
        scope === "lock"
          ? {
              lockEnabled: form.lockEnabled,
              lockType: form.lockType,
              lockTimeoutMs: Number(form.lockTimeoutMs) || null,
              retryCount: Number(form.retryCount) || null,
              retryIntervalMs: Number(form.retryIntervalMs) || null,
              leaseDurationMs: Number(form.leaseDurationMs) || null,
              queueStrategy: form.queueStrategy || null
            }
          : {
              autoRefreshEnabled: form.autoRefreshEnabled,
              refreshIntervalSec: Number(form.refreshIntervalSec) || null
            };

      const nextSettings = await updateSettings(payload);
      showToast({
        tone: "success",
        title: scope === "lock" ? "Lock settings updated" : "Monitoring settings updated",
        description: "The frontend submitted the change to the backend contract successfully."
      });

      setForm((current) => ({ ...current, ...nextSettings }));
      await query.execute();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving("");
    }
  };

  const handleAction = async (action, title, description) => {
    const accepted = await confirm({
      title,
      description,
      confirmLabel: "Run Action",
      tone: "danger"
    });

    if (!accepted) return;

    setSaving(action);
    setFormError("");

    try {
      await triggerSystemAction(action);
      showToast({
        tone: "success",
        title: "Maintenance action submitted",
        description: `${action} was sent to the backend.`
      });
      await query.execute();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving("");
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => query.execute()} refreshing={query.loading} />

      {query.loading && !query.data ? (
        <SectionCard title="Loading Settings" description="Fetching current configuration and settings history.">
          <TableSkeleton rows={6} />
        </SectionCard>
      ) : null}

      {!query.loading && query.error && !query.data ? (
        <ErrorState
          title="Settings unavailable"
          description={query.error}
          action={
            <Button tone="secondary" onClick={() => query.execute()}>
              Retry
            </Button>
          }
        />
      ) : null}

      {!query.loading && !query.error && !query.data?.settings ? (
        <EmptyState
          title="No settings returned"
          description="The settings workspace is ready, but the backend did not provide a configuration payload."
        />
      ) : null}

      {form ? (
        <>
          <div className="stat-grid">
            <StatCard label="Lock Status" value={form.lockEnabled ? "Enabled" : "Disabled"} />
            <StatCard label="Lock Type" value={form.lockType ?? "—"} />
            <StatCard label="Timeout" value={formatNumber(form.lockTimeoutMs)} hint="ms" />
            <StatCard label="Auto Refresh" value={form.autoRefreshEnabled ? "Enabled" : "Disabled"} />
          </div>

          {query.data?.historyError ? <InlineError message={query.data.historyError} /> : null}
          {formError ? <InlineError message={formError} /> : null}

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <SectionCard title="System Overview" description="Current configuration snapshot from the backend.">
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <StatusBadge status={form.lockEnabled ? "ACTIVE" : "DISABLED"} label={form.lockEnabled ? "Lock enabled" : "Lock disabled"} />
                  <StatusBadge status={form.autoRefreshEnabled ? "ACTIVE" : "IDLE"} label={form.autoRefreshEnabled ? "Auto refresh enabled" : "Auto refresh off"} />
                </div>
                <div style={{ display: "grid", gap: "0.45rem", color: "var(--color-text-secondary)" }}>
                  <div>Retry count: {formatNumber(form.retryCount)}</div>
                  <div>Retry interval: {formatNumber(form.retryIntervalMs)} ms</div>
                  <div>Lease duration: {formatNumber(form.leaseDurationMs)} ms</div>
                  <div>Queue strategy: {form.queueStrategy ?? "—"}</div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Maintenance Actions" description="High-impact actions require explicit confirmation and never fabricate success states.">
              <div style={{ display: "grid", gap: "0.75rem" }}>
                <Button
                  tone="secondary"
                  disabled={Boolean(saving)}
                  onClick={() =>
                    handleAction(
                      "reset-stock",
                      "Reset stock to initial state",
                      "This sends a real maintenance action to the backend and may change actual inventory."
                    )
                  }
                >
                  {saving === "reset-stock" ? "Submitting" : "Reset Stock"}
                </Button>
                <Button
                  tone="secondary"
                  disabled={Boolean(saving)}
                  onClick={() =>
                    handleAction(
                      "clear-logs",
                      "Clear system logs",
                      "This may remove backend log evidence that teams rely on for debugging."
                    )
                  }
                >
                  {saving === "clear-logs" ? "Submitting" : "Clear Logs"}
                </Button>
                <Button
                  tone="danger"
                  disabled={Boolean(saving)}
                  onClick={() =>
                    handleAction(
                      "clear-reports",
                      "Clear all test reports",
                      "This removes report history from the backend if the endpoint supports it."
                    )
                  }
                >
                  {saving === "clear-reports" ? "Submitting" : "Clear Reports"}
                </Button>
                <Button
                  tone="danger"
                  disabled={Boolean(saving)}
                  onClick={() =>
                    handleAction(
                      "reset-env",
                      "Reset the environment",
                      "This is the most destructive action in the frontend workspace and should only be used when the backend is ready for it."
                    )
                  }
                >
                  {saving === "reset-env" ? "Submitting" : "Reset Entire System"}
                </Button>
              </div>
            </SectionCard>
          </div>

          <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
            <SectionCard title="Lock Configuration" description="Primary distributed-lock settings prepared for production integration.">
              <div style={{ display: "grid", gap: "1rem" }}>
                <ToggleRow
                  label="Distributed Lock"
                  description="Enable or disable the backend lock control path."
                  value={Boolean(form.lockEnabled)}
                  onToggle={() => patchForm("lockEnabled", !form.lockEnabled)}
                  disabled={Boolean(saving)}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <Field label="Lock Type">
                    <Select value={form.lockType ?? ""} onChange={(event) => patchForm("lockType", event.target.value)} disabled={Boolean(saving)}>
                      <option value="">Select type</option>
                      <option value="DISTRIBUTED_LOCK">Distributed Lock</option>
                      <option value="PESSIMISTIC_LOCK">Pessimistic Lock</option>
                      <option value="OPTIMISTIC_LOCK">Optimistic Lock</option>
                      <option value="SEMAPHORE_LOCK">Semaphore Lock</option>
                    </Select>
                  </Field>
                  <Field label="Timeout (ms)">
                    <Input type="number" min="0" value={form.lockTimeoutMs ?? ""} onChange={(event) => patchForm("lockTimeoutMs", event.target.value)} disabled={Boolean(saving)} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <Field label="Retry Count">
                    <Input type="number" min="0" value={form.retryCount ?? ""} onChange={(event) => patchForm("retryCount", event.target.value)} disabled={Boolean(saving)} />
                  </Field>
                  <Field label="Retry Interval (ms)">
                    <Input type="number" min="0" value={form.retryIntervalMs ?? ""} onChange={(event) => patchForm("retryIntervalMs", event.target.value)} disabled={Boolean(saving)} />
                  </Field>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                  <Field label="Lease Duration (ms)">
                    <Input type="number" min="0" value={form.leaseDurationMs ?? ""} onChange={(event) => patchForm("leaseDurationMs", event.target.value)} disabled={Boolean(saving)} />
                  </Field>
                  <Field label="Queue Strategy">
                    <Select value={form.queueStrategy ?? ""} onChange={(event) => patchForm("queueStrategy", event.target.value)} disabled={Boolean(saving)}>
                      <option value="">Select strategy</option>
                      <option value="FIFO">FIFO</option>
                      <option value="LIFO">LIFO</option>
                      <option value="PRIORITY">Priority</option>
                    </Select>
                  </Field>
                </div>
                <Button onClick={() => handleSave("lock")} disabled={Boolean(saving)}>
                  {saving === "lock" ? "Saving" : "Save Lock Settings"}
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Monitoring Configuration" description="Frontend-visible settings for polling and live observability behavior.">
              <div style={{ display: "grid", gap: "1rem" }}>
                <ToggleRow
                  label="Auto Refresh"
                  description="Enable backend-backed refresh cadence for monitor pages and live views."
                  value={Boolean(form.autoRefreshEnabled)}
                  onToggle={() => patchForm("autoRefreshEnabled", !form.autoRefreshEnabled)}
                  disabled={Boolean(saving)}
                />
                <Field label="Refresh Interval (s)">
                  <Input type="number" min="1" value={form.refreshIntervalSec ?? ""} onChange={(event) => patchForm("refreshIntervalSec", event.target.value)} disabled={Boolean(saving)} />
                </Field>
                <Button onClick={() => handleSave("monitoring")} disabled={Boolean(saving)}>
                  {saving === "monitoring" ? "Saving" : "Save Monitoring Settings"}
                </Button>
              </div>
            </SectionCard>
          </div>

          <SectionCard title="Configuration History" description="Recent settings changes returned by the backend history endpoint.">
            {query.data?.history?.length ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {query.data.history.slice(0, 12).map((entry, index) => (
                  <div key={`${entry.id ?? index}-${index}`} style={{ padding: "0.9rem 1rem", borderRadius: "1rem", border: "1px solid var(--color-border)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                      <strong>{entry.field ?? entry.key ?? "Setting update"}</strong>
                      <span className="mono" style={{ color: "var(--color-text-muted)", fontSize: "0.78rem" }}>
                        {formatShortDateTime(entry.timestamp ?? entry.createdAt)}
                      </span>
                    </div>
                    <div style={{ marginTop: "0.4rem", color: "var(--color-text-secondary)" }}>
                      {String(entry.old_value ?? entry.oldValue ?? "—")} {" -> "} {String(entry.new_value ?? entry.newValue ?? "—")}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No configuration history yet"
                description="History entries will appear here as soon as the backend persists settings changes."
              />
            )}
          </SectionCard>
        </>
      ) : null}
    </div>
  );
}

export default SettingsPage;
