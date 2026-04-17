import { formatNumber } from "../../utils/formatters";

export function BarChart({ items }) {
  if (!items?.length) return null;

  const max = Math.max(...items.map((item) => item.value || 0), 1);

  return (
    <div className="chart-bars">
      {items.map((item) => (
        <div key={item.label} className="chart-bar">
          <div
            className="chart-bar__fill"
            style={{
              height: `${Math.max(12, ((item.value || 0) / max) * 180)}px`
            }}
          />
          <strong>{formatNumber(item.value || 0)}</strong>
          <span style={{ color: "var(--color-text-muted)", fontSize: "0.78rem" }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

export default BarChart;
