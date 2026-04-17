export function Drawer({ open, title, children, actions, onClose }) {
  if (!open) return null;

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer-panel">
        <div className="section-card__header">
          <div>
            <h2 className="section-card__title">{title}</h2>
          </div>
        </div>
        <div className="section-card__body">{children}</div>
        {actions ? <div className="section-card__body">{actions}</div> : null}
      </aside>
    </>
  );
}

export default Drawer;
