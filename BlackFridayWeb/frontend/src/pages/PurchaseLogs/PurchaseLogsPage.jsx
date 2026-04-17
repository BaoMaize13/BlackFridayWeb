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
import { listLogs } from "../../services/domains/logService";
import { formatShortDateTime } from "../../utils/formatters";

const defaultFilters = {
  search: "",
  requestId: "",
  level: "",
  type: ""
};

function PurchaseLogsPage() {
  const [selected, setSelected] = useState(null);
  const [submittedFilters, setSubmittedFilters] = useState(defaultFilters);
  const { filters, updateFilter, resetFilters } = useFilters(defaultFilters);
  const query = useApi(() => listLogs({ page: 1, pageSize: 150, ...submittedFilters }));

  useEffect(() => {
    query.execute().catch(() => null);
  }, [submittedFilters]);

  const items = query.data?.items ?? [];

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => setSubmittedFilters({ ...submittedFilters })} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Total Logs" value={items.length} />
        <StatCard label="Errors" value={items.filter((item) => item.level === "ERROR").length} />
        <StatCard label="Warnings" value={items.filter((item) => item.level === "WARN").length} />
      </div>

      <FilterToolbar
        filters={
          <>
            <Field label="Search">
              <Input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Message text" />
            </Field>
            <Field label="Request ID">
              <Input value={filters.requestId} onChange={(event) => updateFilter("requestId", event.target.value)} />
            </Field>
            <Field label="Level">
              <Select value={filters.level} onChange={(event) => updateFilter("level", event.target.value)}>
                <option value="">All levels</option>
                <option value="INFO">Info</option>
                <option value="WARN">Warn</option>
                <option value="ERROR">Error</option>
              </Select>
            </Field>
            <Field label="Type">
              <Input value={filters.type} onChange={(event) => updateFilter("type", event.target.value)} placeholder="Action type" />
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

      <SectionCard title="Log Stream" description="Technical event stream returned by purchase or log endpoints.">
        {query.loading && !query.data ? <TableSkeleton /> : null}
        {!query.loading && query.error ? <ErrorState title="Logs unavailable" description={query.error} action={<Button tone="secondary" onClick={() => setSubmittedFilters({ ...submittedFilters })}>Retry</Button>} /> : null}
        {!query.loading && !query.error && !items.length ? <EmptyState title="No logs returned" description="The log page is wired, but the backend has not returned purchase events yet." /> : null}
        {!query.loading && !query.error && items.length ? (
          <DataTable
            columns={[
              { key: "createdAt", header: "Time", render: (item) => formatShortDateTime(item.createdAt) },
              { key: "action", header: "Action" },
              { key: "productName", header: "Product" },
              { key: "level", header: "Level", render: (item) => <StatusBadge status={item.level} /> },
              { key: "message", header: "Message" },
              { key: "actions", header: "Detail", render: (item) => <Button tone="ghost" onClick={() => setSelected(item)}>Open</Button> }
            ]}
            rows={items}
            getRowKey={(item) => item.id}
          />
        ) : null}
      </SectionCard>

      <Drawer open={Boolean(selected)} title="Log Detail" onClose={() => setSelected(null)}>
        {selected ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div><strong>Time:</strong> {formatShortDateTime(selected.createdAt)}</div>
            <div><strong>Action:</strong> {selected.action}</div>
            <div><strong>Level:</strong> <StatusBadge status={selected.level} /></div>
            <div><strong>Product:</strong> {selected.productName}</div>
            <div><strong>Request:</strong> {selected.requestId ?? "—"}</div>
            <div><strong>Message:</strong> {selected.message}</div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}

export default PurchaseLogsPage;
