export function Field({ label, hint, children }) {
  return (
    <label className="field">
      {label ? <span className="field__label">{label}</span> : null}
      {children}
      {hint ? <span className="field__hint">{hint}</span> : null}
    </label>
  );
}

export function Input(props) {
  return <input className={`control ${props.className ?? ""}`.trim()} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`control ${className}`.trim()} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className = "", rows = 4, ...props }) {
  return <textarea rows={rows} className={`control ${className}`.trim()} {...props} />;
}
