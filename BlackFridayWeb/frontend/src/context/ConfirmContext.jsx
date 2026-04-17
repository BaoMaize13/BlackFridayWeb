import { createContext, useCallback, useMemo, useRef, useState } from "react";

import ConfirmDialog from "../components/feedback/ConfirmDialog";

export const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const resolverRef = useRef(null);
  const [dialogState, setDialogState] = useState({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    tone: "danger"
  });

  const close = useCallback((result) => {
    setDialogState((current) => ({ ...current, open: false }));
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }, []);

  const confirm = useCallback((options) => {
    setDialogState({
      open: true,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? "Confirm",
      cancelLabel: options.cancelLabel ?? "Cancel",
      tone: options.tone ?? "danger"
    });

    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const value = useMemo(
    () => ({
      confirm
    }),
    [confirm]
  );

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={dialogState.open}
        title={dialogState.title}
        description={dialogState.description}
        confirmLabel={dialogState.confirmLabel}
        cancelLabel={dialogState.cancelLabel}
        tone={dialogState.tone}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    </ConfirmContext.Provider>
  );
}
