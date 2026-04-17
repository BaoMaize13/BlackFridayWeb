import { createContext, useCallback, useMemo, useState } from "react";

import AppToast from "../components/feedback/AppToast";

export const ToastContext = createContext(null);

let toastCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((payload) => {
    const nextToast = {
      id: `toast-${toastCounter += 1}`,
      tone: payload.tone ?? "info",
      title: payload.title ?? "Update",
      description: payload.description ?? "",
      duration: payload.duration ?? 4000
    };
    setToasts((current) => [...current, nextToast]);
    return nextToast.id;
  }, []);

  const value = useMemo(
    () => ({
      showToast,
      dismiss
    }),
    [showToast, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <AppToast toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
