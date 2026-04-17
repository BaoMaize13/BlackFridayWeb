export function EmptyState({ title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-state__icon">0</div>
      <div>
        <h3 style={{ margin: "0 0 0.35rem" }}>{title}</h3>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export default EmptyState;
