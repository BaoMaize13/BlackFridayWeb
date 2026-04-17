export function FilterToolbar({ filters, actions }) {
  return (
    <div className="section-card">
      <div className="section-card__body filter-toolbar">
        <div className="filter-toolbar__grid">{filters}</div>
        {actions ? <div className="filter-toolbar__actions">{actions}</div> : null}
      </div>
    </div>
  );
}

export default FilterToolbar;
