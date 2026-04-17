export function SectionCard({ title, description, actions, children, className = "" }) {
  return (
    <section className={`section-card ${className}`.trim()}>
      {(title || actions) && (
        <div className="section-card__header">
          <div>
            {title ? <h2 className="section-card__title">{title}</h2> : null}
            {description ? <p className="section-card__description">{description}</p> : null}
          </div>
          {actions}
        </div>
      )}
      <div className="section-card__body">{children}</div>
    </section>
  );
}

export function StatCard({ label, value, hint, icon }) {
  return (
    <article className="stat-card">
      <div className="stat-card__eyebrow">
        <span>{label}</span>
        {icon}
      </div>
      <div className="stat-card__value">{value}</div>
      {hint ? <div className="stat-card__hint">{hint}</div> : null}
    </article>
  );
}
