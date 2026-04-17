export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="table-shell">
      <div className="section-card__body" style={{ display: "grid", gap: "0.75rem" }}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="skeleton" style={{ height: "3rem", borderRadius: "0.9rem" }} />
        ))}
      </div>
    </div>
  );
}

export default TableSkeleton;
