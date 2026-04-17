import { ArrowRight, Package, Warehouse } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import EmptyState from "../../components/feedback/EmptyState";
import ErrorState from "../../components/feedback/ErrorState";
import TableSkeleton from "../../components/feedback/TableSkeleton";
import { SectionCard, StatCard } from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import FilterToolbar from "../../components/ui/FilterToolbar";
import { Field, Input, Select } from "../../components/ui/FormControls";
import PageHeader from "../../components/ui/PageHeader";
import StatusBadge from "../../components/ui/StatusBadge";
import Button from "../../components/ui/Button";
import { ROUTES } from "../../constants/routes";
import { useApi } from "../../hooks/useApi";
import { useFilters } from "../../hooks/useFilters";
import { usePagination } from "../../hooks/usePagination";
import { listProducts } from "../../services/domains/productService";
import { formatCurrency, formatNumber, formatShortDateTime } from "../../utils/formatters";

const defaultFilters = {
  search: "",
  stockLevel: "",
  status: ""
};

function filterProducts(items, filters) {
  return items.filter((product) => {
    const haystack = `${product.name} ${product.code}`.toLowerCase();
    const stock = product.stock ?? 0;
    const stockLevel =
      stock <= 0 ? "out" : stock <= 10 ? "low" : stock <= 50 ? "medium" : "high";
    const status = stock > 0 ? "active" : "inactive";

    if (filters.search && !haystack.includes(filters.search.toLowerCase())) return false;
    if (filters.stockLevel && stockLevel !== filters.stockLevel) return false;
    if (filters.status && status !== filters.status) return false;
    return true;
  });
}

function ProductListPage() {
  const pagination = usePagination({ pageSize: 12 });
  const { filters, updateFilter, resetFilters } = useFilters(defaultFilters);
  const [submittedFilters, setSubmittedFilters] = useState(defaultFilters);
  const query = useApi(async ({ page, pageSize, filters: activeFilters }) => {
    const response = await listProducts({ page: 1, pageSize: 200 });
    const filtered = filterProducts(response.items, activeFilters);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      items: filtered.slice(start, end),
      total: filtered.length,
      allItems: response.items
    };
  });

  useEffect(() => {
    query
      .execute({
        page: pagination.page,
        pageSize: pagination.pageSize,
        filters: submittedFilters
      })
      .then((result) => pagination.setTotal(result.total))
      .catch(() => null);
  }, [submittedFilters, pagination.page, pagination.pageSize]);

  const summary = useMemo(() => {
    const allItems = query.data?.allItems ?? [];
    return {
      total: allItems.length,
      lowStock: allItems.filter((item) => (item.stock ?? 0) > 0 && (item.stock ?? 0) <= 10).length,
      outOfStock: allItems.filter((item) => (item.stock ?? 0) <= 0).length
    };
  }, [query.data]);

  const columns = [
    {
      key: "code",
      header: "Product",
      render: (product) => (
        <div>
          <strong>{product.name}</strong>
          <div className="mono" style={{ color: "var(--color-text-muted)", marginTop: "0.25rem" }}>
            {product.code ?? "No SKU"}
          </div>
        </div>
      )
    },
    {
      key: "price",
      header: "Price",
      render: (product) => formatCurrency(product.price)
    },
    {
      key: "stock",
      header: "Stock",
      render: (product) => formatNumber(product.stock ?? 0)
    },
    {
      key: "status",
      header: "Status",
      render: (product) => (
        <StatusBadge
          status={(product.stock ?? 0) > 0 ? "ACTIVE" : "OFFLINE"}
          label={(product.stock ?? 0) > 0 ? "In Stock" : "Out"}
        />
      )
    },
    {
      key: "updatedAt",
      header: "Updated",
      render: (product) => formatShortDateTime(product.updatedAt)
    },
    {
      key: "actions",
      header: "Actions",
      render: (product) => (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <Link to={`/products/${product.id}`}>
            <Button tone="ghost">Detail</Button>
          </Link>
          <Link to={ROUTES.inventory}>
            <Button tone="ghost">Inventory</Button>
          </Link>
          <Link to={ROUTES.purchase}>
            <Button tone="ghost">Purchase</Button>
          </Link>
        </div>
      )
    }
  ];

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <PageHeader onRefresh={() => setSubmittedFilters({ ...submittedFilters })} refreshing={query.loading} />

      <div className="stat-grid">
        <StatCard label="Catalog Size" value={summary.total} icon={<Package size={16} />} hint="Products returned by backend" />
        <StatCard label="Low Stock" value={summary.lowStock} icon={<Warehouse size={16} />} hint="Real items below the low-stock threshold" />
        <StatCard label="Out of Stock" value={summary.outOfStock} icon={<ArrowRight size={16} />} hint="Actionable stock shortages" />
      </div>

      <FilterToolbar
        filters={
          <>
            <Field label="Search">
              <Input value={filters.search} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search name or SKU" />
            </Field>
            <Field label="Status">
              <Select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
            </Field>
            <Field label="Stock Level">
              <Select value={filters.stockLevel} onChange={(event) => updateFilter("stockLevel", event.target.value)}>
                <option value="">All stock levels</option>
                <option value="out">Out</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </Field>
          </>
        }
        actions={
          <>
            <Button tone="primary" onClick={() => { pagination.setPage(1); setSubmittedFilters(filters); }}>
              Apply Filters
            </Button>
            <Button tone="secondary" onClick={() => { resetFilters(); pagination.reset(); setSubmittedFilters(defaultFilters); }}>
              Reset
            </Button>
          </>
        }
      />

      <SectionCard title="Product Registry" description="Unified catalog table with quick access into detail, purchase, and inventory flows.">
        {query.loading && !query.data ? <TableSkeleton /> : null}
        {!query.loading && query.error ? (
          <ErrorState title="Product catalog unavailable" description={query.error} action={<Button tone="secondary" onClick={() => setSubmittedFilters({ ...submittedFilters })}>Retry</Button>} />
        ) : null}
        {!query.loading && !query.error && query.data && !query.data.items.length ? (
          <EmptyState title="No products matched the current filters" description="The frontend is ready for live data, but this query returned no products." />
        ) : null}
        {!query.loading && !query.error && query.data?.items.length ? (
          <>
            <DataTable columns={columns} rows={query.data.items} getRowKey={(product) => product.id} />
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
    </div>
  );
}

export default ProductListPage;
