import { FlaskConical, Play, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import Drawer from "../../components/ui/Drawer";
import FilterToolbar from "../../components/ui/FilterToolbar";
import { SectionCard, StatCard } from "../../components/ui/Card";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useFilters } from "../../hooks/useFilters";
import { usePagination } from "../../hooks/usePagination";
import { useToast } from "../../hooks/useToast";
import { listTestCases, runTestCase } from "../../services/domains/testService";
import { formatPercent, formatShortDateTime } from "../../utils/formatters";

const defaultFilters = {
  search: "",
  type: "",
  status: ""
};

function getTypeTone(type) {
  switch (String(type).toUpperCase()) {
    case "LOCK":
      return "info";
    case "NO_LOCK":
      return "warn";
    case "CONSISTENCY":
      return "success";
    default:
      return "muted";
  }
}

function TestCasesPage() {
  const [selected, setSelected] = useState(null);
  const [runningId, setRunningId] = useState(null);
  const [submittedFilters, setSubmittedFilters] = useState(defaultFilters);
  const { filters, updateFilter, resetFilters } = useFilters(defaultFilters);
  const pagination = usePagination({ pageSize: 9 });
  const query = useApi(() => listTestCases({ page: 1, pageSize: 200, ...submittedFilters }));
  const { showToast } = useToast();

  useEffect(() => {
    query.execute().catch(() => null);
  }, [submittedFilters]);

  const items = query.data?.items ?? [];
  const pagedItems = items.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  useEffect(() => {
    pagination.setTotal(items.length);
  }, [items.length]);

  const summary = useMemo(() => {
    const passed = items.filter((item) => item.status === "PASSED").length;
    const executable = items.filter((item) => item.status !== "RUNNING").length;
    const lastExecuted = items
      .map((item) => item.lastExecutedAt)
      .filter(Boolean)
      .sort((left, right) => new Date(right) - new Date(left))[0];

    return {
      total: items.length,
      executable,
      passRate: items.length ? (passed / items.length) * 100 : null,
      lastExecuted
    };
  }, [items]);

  const handleRun = async (testCase) => {
    const testId = testCase.id;
    if (!testId) return;

    setRunningId(testId);
    try {
      await runTestCase(testId);
      showToast({
        tone: "success",
        title: "Test execution requested",
        description: `Run request sent for ${testCase.name}.`
      });
      await query.execute();
    } catch (error) {
      showToast({
        tone: "danger",
        title: "Test execution failed",
        description: error.message
      });
    } finally {
      setRunningId(null);
    }
  };

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => query.execute()} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Total Cases" value={summary.total} />
        <StatCard label="Runnable" value={summary.executable} />
        <StatCard label="Pass Rate" value={formatPercent(summary.passRate)} />
        <StatCard label="Last Executed" value={formatShortDateTime(summary.lastExecuted)} />
      </div>

      <FilterToolbar
        filters={
          <>
            <Field label="Search">
              <Input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search test case name" />
            </Field>
            <Field label="Type">
              <Select value={filters.type} onChange={(event) => updateFilter("type", event.target.value)}>
                <option value="">All types</option>
                <option value="LOCK">Lock</option>
                <option value="NO_LOCK">No Lock</option>
                <option value="CONSISTENCY">Consistency</option>
                <option value="ISOLATION">Isolation</option>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="RUNNING">Running</option>
                <option value="PASSED">Passed</option>
                <option value="FAILED">Failed</option>
              </Select>
            </Field>
          </>
        }
        actions={
          <>
            <Button onClick={() => { pagination.setPage(1); setSubmittedFilters(filters); }}>
              <Search size={16} />
              Apply
            </Button>
            <Button tone="secondary" onClick={() => { resetFilters(); pagination.reset(); setSubmittedFilters(defaultFilters); }}>
              Reset
            </Button>
          </>
        }
      />

      <SectionCard title="Test Case Workspace" description="Card-based operational view designed for exploratory execution, not a generic registry table.">
        {query.loading && !query.data ? <TableSkeleton rows={6} /> : null}
        {!query.loading && query.error ? (
          <ErrorState
            title="Test cases unavailable"
            description={query.error}
            action={
              <Button tone="secondary" onClick={() => query.execute()}>
                Retry
              </Button>
            }
          />
        ) : null}
        {!query.loading && !query.error && !pagedItems.length ? (
          <EmptyState
            title="No test cases matched"
            description="The frontend is ready for backend-backed test definitions, but this query returned no cases."
          />
        ) : null}
        {!query.loading && !query.error && pagedItems.length ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))", gap: "1rem" }}>
              {pagedItems.map((testCase) => (
                <article
                  key={testCase.id}
                  className="section-card"
                  style={{ cursor: "pointer" }}
                  onClick={() => setSelected(testCase)}
                >
                  <div className="section-card__body" style={{ display: "grid", gap: "0.9rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                      <div>
                        <strong>{testCase.name}</strong>
                        <div className="mono" style={{ marginTop: "0.25rem", color: "var(--color-text-muted)" }}>
                          {testCase.id ?? "No id"}
                        </div>
                      </div>
                      <FlaskConical size={18} />
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem" }}>
                      <StatusBadge status={testCase.status} />
                      <StatusBadge status={testCase.type} label={testCase.type} tone={getTypeTone(testCase.type)} />
                    </div>
                    <div style={{ color: "var(--color-text-secondary)", minHeight: "3rem" }}>
                      {testCase.description || "Backend chưa cung cấp mô tả cho test case này."}
                    </div>
                    <div style={{ color: "var(--color-text-muted)", fontSize: "0.84rem" }}>
                      Last run: {formatShortDateTime(testCase.lastExecutedAt)}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
                      <Button tone="ghost" onClick={(event) => { event.stopPropagation(); setSelected(testCase); }}>
                        Detail
                      </Button>
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleRun(testCase);
                        }}
                        disabled={runningId === testCase.id}
                      >
                        <Play size={16} />
                        {runningId === testCase.id ? "Running" : "Run"}
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem", gap: "1rem", flexWrap: "wrap" }}>
              <div style={{ color: "var(--color-text-muted)" }}>
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Button tone="ghost" disabled={pagination.page <= 1} onClick={() => pagination.setPage(pagination.page - 1)}>
                  Previous
                </Button>
                <Button tone="ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.setPage(pagination.page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </SectionCard>

      <Drawer
        open={Boolean(selected)}
        title={selected?.name ?? "Test Case Detail"}
        onClose={() => setSelected(null)}
        actions={
          selected ? (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={() => handleRun(selected)} disabled={runningId === selected.id}>
                <Play size={16} />
                {runningId === selected.id ? "Running" : "Run Test"}
              </Button>
            </div>
          ) : null
        }
      >
        {selected ? (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div><strong>Test ID:</strong> {selected.id ?? "—"}</div>
            <div><strong>Type:</strong> <StatusBadge status={selected.type} label={selected.type} tone={getTypeTone(selected.type)} /></div>
            <div><strong>Status:</strong> <StatusBadge status={selected.status} /></div>
            <div><strong>Last executed:</strong> {formatShortDateTime(selected.lastExecutedAt)}</div>
            <div>
              <strong>Description:</strong>
              <div style={{ marginTop: "0.35rem", color: "var(--color-text-secondary)" }}>
                {selected.description || "Backend chưa cung cấp mô tả cho test case này."}
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default TestCasesPage;
