import { formatNumber } from "../../utils/formatters";

export function ComparisonBars({ left, right }) {
  if (!left?.length || !right?.length) return null;

  return (
    <div className="comparison-grid">
      {[{ label: "Unlocked", items: left }, { label: "Protected", items: right }].map((group) => (
        <section key={group.label} className="section-card">
          <div className="section-card__header">
            <div>
              <h3 className="section-card__title">{group.label}</h3>
            </div>
          </div>
          <div className="section-card__body chart-bars">
            {group.items.map((item) => (
              <div key={item.label} className="chart-bar">
                <div className="chart-bar__fill" style={{ height: `${Math.max(12, item.value || 0)}px` }} />
                <strong>{formatNumber(item.value || 0)}</strong>
                <span style={{ color: "var(--color-text-muted)", fontSize: "0.78rem" }}>{item.label}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export default ComparisonBars;
