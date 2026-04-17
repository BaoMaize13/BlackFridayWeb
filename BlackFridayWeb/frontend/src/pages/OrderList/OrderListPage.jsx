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
import { listOrders } from "../../services/domains/orderService";
import { formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultFilters = {
  search: "",
  status: "",
  requestId: ""
};

function OrderListPage() {
  const [selected, setSelected] = useState(null);
  const [submittedFilters, setSubmittedFilters] = useState(defaultFilters);
  const { filters, updateFilter, resetFilters } = useFilters(defaultFilters);
  const query = useApi(() => listOrders({ page: 1, pageSize: 100, ...submittedFilters }));

  useEffect(() => {
    query.execute().catch(() => null);
  }, [submittedFilters]);

  const items = query.data?.items ?? [];

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => setSubmittedFilters({ ...submittedFilters })} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Orders" value={formatNumber(items.length)} />
        <StatCard label="Success" value={formatNumber(items.filter((item) => item.status === "SUCCESS").length)} />
        <StatCard label="Failed" value={formatNumber(items.filter((item) => item.status === "FAILED").length)} />
      </div>

      <FilterToolbar
        filters={
          <>
            <Field label="Search">
              <Input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Product or buyer ref" />
            </Field>
            <Field label="Request ID">
              <Input value={filters.requestId} onChange={(event) => updateFilter("requestId", event.target.value)} />
            </Field>
            <Field label="Status">
              <Select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">All statuses</option>
                <option value="SUCCESS">Success</option>
                <option value="FAILED">Failed</option>
                <option value="PENDING">Pending</option>
              </Select>
            </Field>
          </>
        }
        actions={
          <>
            <Button onClick={() => setSubmittedFilters(filters)}>Apply</Button>
            <Button tone="secondary" onClick={() => { resetFilters(); setSubmittedFilters(defaultFilters); }}>Reset</Button>
          </>
        }
      />

      <SectionCard title="Order Registry" description="Operational view of order creation outcomes and failure reasons.">
        {query.loading && !query.data ? <TableSkeleton /> : null}
        {!query.loading && query.error ? <ErrorState title="Orders unavailable" description={query.error} action={<Button tone="secondary" onClick={() => setSubmittedFilters({ ...submittedFilters })}>Retry</Button>} /> : null}
        {!query.loading && !query.error && !items.length ? <EmptyState title="No orders returned" description="Orders will appear here when the backend exposes the registry." /> : null}
        {!query.loading && !query.error && items.length ? (
          <DataTable
            columns={[
              { key: "requestId", header: "Request" },
              { key: "productName", header: "Product" },
              { key: "quantity", header: "Qty", render: (item) => formatNumber(item.quantity) },
              { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
              { key: "failureReason", header: "Failure", render: (item) => item.failureReason ?? "—" },
              { key: "createdAt", header: "Created", render: (item) => formatShortDateTime(item.createdAt) },
              { key: "actions", header: "Detail", render: (item) => <Button tone="ghost" onClick={() => setSelected(item)}>Open</Button> }
            ]}
            rows={items}
            getRowKey={(item) => item.id}
          />
        ) : null}
      </SectionCard>

      <Drawer open={Boolean(selected)} title="Order Detail" onClose={() => setSelected(null)}>
        {selected ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div><strong>Request:</strong> {selected.requestId}</div>
            <div><strong>Product:</strong> {selected.productName}</div>
            <div><strong>Quantity:</strong> {formatNumber(selected.quantity)}</div>
            <div><strong>Status:</strong> <StatusBadge status={selected.status} /></div>
            <div><strong>Buyer Ref:</strong> {selected.buyerRef ?? "—"}</div>
            <div><strong>Failure Reason:</strong> {selected.failureReason ?? "—"}</div>
            <div><strong>Created:</strong> {formatShortDateTime(selected.createdAt)}</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default OrderListPage;
