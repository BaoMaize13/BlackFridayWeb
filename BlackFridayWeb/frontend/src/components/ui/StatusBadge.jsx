import { getStatusTone } from "../../constants/statusMaps";

export function StatusBadge({ status, tone, label }) {
  const resolvedTone = tone ?? getStatusTone(status);
  const text = label ?? status ?? "Unknown";

  return (
    <span className={`status-badge status-badge--${resolvedTone}`}>
      <span className="status-badge__dot" />
      {text}
    </span>
  );
}

export default StatusBadge;
