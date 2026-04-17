import { useEffect } from "react";

export function AppToast({ toasts, onDismiss }) {
  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => onDismiss(toast.id), toast.duration)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [toasts, onDismiss]);

  if (!toasts.length) return null;

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast toast--${toast.tone}`}>
          <div>
            <strong>{toast.title}</strong>
            {toast.description ? (
              <div style={{ color: "var(--color-text-muted)", marginTop: "0.35rem" }}>
                {toast.description}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AppToast;
