import { useEffect, useState } from "react";

import Drawer from "../../components/ui/Drawer";
import { SectionCard, StatCard } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import FilterToolbar from "../../components/ui/FilterToolbar";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { useApi } from "../../hooks/useApi";
import { useFilters } from "../../hooks/useFilters";
import { usePagination } from "../../hooks/usePagination";
import { getPurchaseHistory } from "../../services/domains/purchaseService";
import { formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultFilters = {
  search: "",
  status: "",
  from: "",
  to: ""
};

async function loadHistoryWorkspace(filters) {
  const response = await getPurchaseHistory({ page: 1, pageSize: 200, ...filters });
  return response.items;
}

function PurchaseHistoryPage() {
  const [selected, setSelected] = useState(null);
  const [submittedFilters, setSubmittedFilters] = useState(defaultFilters);
  const { filters, updateFilter, resetFilters } = useFilters(defaultFilters);
  const pagination = usePagination({ pageSize: 10 });
  const query = useApi(loadHistoryWorkspace);

  useEffect(() => {
    query.execute(submittedFilters).catch(() => null);
  }, [submittedFilters]);

  const items = query.data ?? [];
  const filteredPage = items.slice(
    (pagination.page - 1) * pagination.pageSize,
    pagination.page * pagination.pageSize
  );

  useEffect(() => {
    pagination.setTotal(items.length);
  }, [items.length]);

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => setSubmittedFilters({ ...submittedFilters })} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Total Attempts" value={formatNumber(items.length)} />
        <StatCard label="Success" value={formatNumber(items.filter((item) => item.status === "SUCCESS").length)} />
        <StatCard label="Failed" value={formatNumber(items.filter((item) => item.status === "FAILED").length)} />
      </div>

      <FilterToolbar
        filters={
          <>
            <Field label="Search">
              <Input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Request or product" />
            </Field>
            <Field label="Status">
              <Select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">All statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </Select>
            </Field>
            <Field label="From">
              <Input type="datetime-local" value={filters.from} onChange={(event) => updateFilter("from", event.target.value)} />
            </Field>
            <Field label="To">
              <Input type="datetime-local" value={filters.to} onChange={(event) => updateFilter("to", event.target.value)} />
            </Field>
          </>
        }
        actions={
          <>
            <Button onClick={() => { pagination.setPage(1); setSubmittedFilters(filters); }}>Apply</Button>
            <Button tone="secondary" onClick={() => { resetFilters(); setSubmittedFilters(defaultFilters); }}>Reset</Button>
          </>
        }
      />

      <SectionCard title="History Table" description="Purchase attempts and their backend-reported outcomes.">
        {query.loading && !query.data ? <TableSkeleton /> : null}
        {!query.loading && query.error ? <ErrorState title="History unavailable" description={query.error} action={<Button tone="secondary" onClick={() => setSubmittedFilters({ ...submittedFilters })}>Retry</Button>} /> : null}
        {!query.loading && !query.error && !filteredPage.length ? <EmptyState title="No purchase history found" description="No backend-backed history matched the current filters." /> : null}
        {!query.loading && !query.error && filteredPage.length ? (
          <>
            <DataTable
              columns={[
                { key: "requestId", header: "Request", render: (item) => item.requestId ?? item.id },
                { key: "productName", header: "Product" },
                { key: "quantity", header: "Qty", render: (item) => formatNumber(item.quantity) },
                { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
                { key: "createdAt", header: "Created", render: (item) => formatShortDateTime(item.createdAt) },
                {
                  key: "actions",
                  header: "Detail",
                  render: (item) => <Button tone="ghost" onClick={() => setSelected(item)}>Open</Button>
                }
              ]}
              rows={filteredPage}
              getRowKey={(item) => item.id}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1rem" }}>
              <div style={{ color: "var(--color-text-muted)" }}>
                Page {pagination.page} of {pagination.totalPages}
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <Button tone="ghost" disabled={pagination.page <= 1} onClick={() => pagination.setPage(pagination.page - 1)}>Previous</Button>
                <Button tone="ghost" disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.setPage(pagination.page + 1)}>Next</Button>
              </div>
            </div>
          </>
        ) : null}
      </SectionCard>

      <Drawer open={Boolean(selected)} title="Purchase Detail" onClose={() => setSelected(null)}>
        {selected ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div><strong>Request:</strong> {selected.requestId ?? selected.id}</div>
            <div><strong>Product:</strong> {selected.productName}</div>
            <div><strong>Quantity:</strong> {formatNumber(selected.quantity)}</div>
            <div><strong>Status:</strong> <StatusBadge status={selected.status} /></div>
            <div><strong>Buyer Ref:</strong> {selected.buyerRef ?? "—"}</div>
            <div><strong>Failure:</strong> {selected.failureReason ?? "—"}</div>
            <div><strong>Created:</strong> {formatShortDateTime(selected.createdAt)}</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default PurchaseHistoryPage;
