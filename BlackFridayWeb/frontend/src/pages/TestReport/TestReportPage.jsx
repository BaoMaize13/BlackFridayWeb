import { useEffect, useMemo, useState } from "react";

import BarChart from "../../components/charts/BarChart";
import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import Drawer from "../../components/ui/Drawer";
import FilterToolbar from "../../components/ui/FilterToolbar";
import { SectionCard, StatCard } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { useApi } from "../../hooks/useApi";
import { useFilters } from "../../hooks/useFilters";
import { usePagination } from "../../hooks/usePagination";
import { getTestReport, listTestReports } from "../../services/domains/testService";
import { formatPercent, formatShortDateTime } from "../../utils/formatters";

const defaultFilters = {
  reportId: "",
  testCaseId: "",
  product: "",
  result: ""
};

function normalizeSuccessRate(value) {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "—";
  return numeric <= 1 ? formatPercent(numeric * 100) : formatPercent(numeric);
}

function TestReportPage() {
  const [selected, setSelected] = useState(null);
  const [submittedFilters, setSubmittedFilters] = useState(defaultFilters);
  const { filters, updateFilter, resetFilters } = useFilters(defaultFilters);
  const pagination = usePagination({ pageSize: 10 });
  const query = useApi(() => listTestReports({ page: 1, pageSize: 200, ...submittedFilters }));
  const detailQuery = useApi(getTestReport);

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
    const passed = items.filter((item) => item.result === "PASSED").length;
    const failed = items.filter((item) => item.result === "FAILED").length;
    const warning = items.filter((item) => item.result === "WARNING").length;

    return {
      total: items.length,
      passed,
      failed,
      warning,
      successRate: items.length ? (passed / items.length) * 100 : null
    };
  }, [items]);

  const handleOpen = async (report) => {
    setSelected(report);
    if (report.id) {
      try {
        await detailQuery.execute(report.id);
      } catch {
        // Keep the fallback row data visible in the drawer.
      }
    }
  };

  const detail = detailQuery.data ?? selected;

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => query.execute()} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Total Reports" value={summary.total} />
        <StatCard label="Passed" value={summary.passed} />
        <StatCard label="Failed" value={summary.failed} />
        <StatCard label="Success Rate" value={formatPercent(summary.successRate)} />
      </div>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1.1fr 0.9fr" }}>
        <FilterToolbar
          filters={
            <>
              <Field label="Report ID">
                <Input value={filters.reportId} onChange={(event) => updateFilter("reportId", event.target.value)} placeholder="Report id" />
              </Field>
              <Field label="Test Case ID">
                <Input value={filters.testCaseId} onChange={(event) => updateFilter("testCaseId", event.target.value)} placeholder="Test case id" />
              </Field>
              <Field label="Product">
                <Input value={filters.product} onChange={(event) => updateFilter("product", event.target.value)} placeholder="Product id" />
              </Field>
              <Field label="Result">
                <Select value={filters.result} onChange={(event) => updateFilter("result", event.target.value)}>
                  <option value="">All results</option>
                  <option value="PASSED">Passed</option>
                  <option value="FAILED">Failed</option>
                  <option value="WARNING">Warning</option>
                </Select>
              </Field>
            </>
          }
          actions={
            <>
              <Button onClick={() => { pagination.setPage(1); setSubmittedFilters(filters); }}>
                Apply
              </Button>
              <Button tone="secondary" onClick={() => { resetFilters(); pagination.reset(); setSubmittedFilters(defaultFilters); }}>
                Reset
              </Button>
            </>
          }
        />

        <SectionCard title="Report Distribution" description="High-level distribution so demo viewers can read system health before drilling into individual reports.">
          <BarChart
            items={[
              { label: "Passed", value: summary.passed },
              { label: "Failed", value: summary.failed },
              { label: "Warning", value: summary.warning }
            ]}
          />
        </SectionCard>
      </div>

      <SectionCard title="Report Registry" description="Structured report table with detail drawer and adapter-backed fallback handling.">
        {query.loading && !query.data ? <TableSkeleton rows={6} /> : null}
        {!query.loading && query.error ? (
          <ErrorState
            title="Reports unavailable"
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
            title="No reports matched"
            description="This frontend is ready for backend-generated reports, but the current query returned nothing."
          />
        ) : null}
        {!query.loading && !query.error && pagedItems.length ? (
          <>
            <DataTable
              columns={[
                { key: "id", header: "Report" },
                { key: "testCaseId", header: "Test Case" },
                { key: "productId", header: "Product" },
                { key: "result", header: "Result", render: (item) => <StatusBadge status={item.result} /> },
                { key: "successRate", header: "Success Rate", render: (item) => normalizeSuccessRate(item.successRate) },
                { key: "createdAt", header: "Created", render: (item) => formatShortDateTime(item.createdAt) },
                {
                  key: "actions",
                  header: "Detail",
                  render: (item) => (
                    <Button tone="ghost" onClick={() => handleOpen(item)}>
                      Open
                    </Button>
                  )
                }
              ]}
              rows={pagedItems}
              getRowKey={(item) => item.id}
            />

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

      <Drawer open={Boolean(selected)} title={`Report ${selected?.id ?? ""}`.trim()} onClose={() => { setSelected(null); detailQuery.reset(); }}>
        {detailQuery.loading && selected ? (
          <TableSkeleton rows={4} />
        ) : detail ? (
          <div style={{ display: "grid", gap: "0.85rem" }}>
            <div><strong>Report ID:</strong> {detail.id ?? "—"}</div>
            <div><strong>Test Case ID:</strong> {detail.testCaseId ?? "—"}</div>
            <div><strong>Product ID:</strong> {detail.productId ?? "—"}</div>
            <div><strong>Result:</strong> <StatusBadge status={detail.result} /></div>
            <div><strong>Success Rate:</strong> {normalizeSuccessRate(detail.successRate)}</div>
            <div><strong>Created:</strong> {formatShortDateTime(detail.createdAt)}</div>
            <div>
              <strong>Summary:</strong>
              <div style={{ marginTop: "0.35rem", color: "var(--color-text-secondary)" }}>
                {typeof detail.summary === "string"
                  ? detail.summary
                  : detail.summary
                    ? JSON.stringify(detail.summary, null, 2)
                    : "No summary payload returned."}
              </div>
            </div>
            {detailQuery.error ? (
              <ErrorState
                title="Detail endpoint failed"
                description={detailQuery.error}
              />
            ) : null}
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default TestReportPage;
