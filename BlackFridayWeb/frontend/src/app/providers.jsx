import { AuthProvider } from "../context/AuthContext";
import { ConfirmProvider } from "../context/ConfirmContext";
import { ToastProvider } from "../context/ToastContext";

export function AppProviders({ children }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <ConfirmProvider>{children}</ConfirmProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
