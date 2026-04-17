export function ErrorState({ title, description, action }) {
  return (
    <div className="error-state">
      <div className="error-state__icon">!</div>
      <div>
        <h3 style={{ margin: "0 0 0.35rem" }}>{title}</h3>
        <p style={{ margin: 0, color: "var(--color-text-muted)" }}>{description}</p>
      </div>
      {action}
    </div>
  );
}

export default ErrorState;
