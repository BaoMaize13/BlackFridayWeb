export function PageSkeleton({ cardCount = 4, rows = 5 }) {
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <div className="stat-grid">
        {Array.from({ length: cardCount }).map((_, index) => (
          <div key={index} className="stat-card skeleton" style={{ minHeight: "8rem" }} />
        ))}
      </div>
      <div className="section-card">
        <div className="section-card__body" style={{ display: "grid", gap: "0.85rem" }}>
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index} className="skeleton" style={{ height: "3.25rem", borderRadius: "1rem" }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default PageSkeleton;
