import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { authService } from "../services/auth/authService";
import { AppError, mapErrorToMessage } from "../utils/errors";
import { clearStoredSession, getStoredSession, setStoredSession } from "../utils/storage";

export const AuthContext = createContext(null);

function ensureAdminWorkspaceAccess(user) {
  if (String(user?.role || "").toLowerCase() !== "admin") {
    throw new AppError("This frontend currently supports admin accounts only.", {
      status: 403,
      errorCode: "FORBIDDEN"
    });
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: "loading",
    user: null,
    token: null,
    sessionLabel: null,
    error: null
  });

  const restoreSession = useCallback(async () => {
    const stored = getStoredSession();

    if (!stored?.token) {
      setState({
        status: "unauthenticated",
        user: null,
        token: null,
        sessionLabel: null,
        error: null
      });
      return;
    }

    setState((current) => ({ ...current, status: "loading", error: null }));

    try {
      const validated = await authService.validate(stored.token);
      ensureAdminWorkspaceAccess(validated.user ?? stored.user);
      const nextState = {
        status: "authenticated",
        user: validated.user ?? stored.user ?? null,
        token: stored.token,
        sessionLabel: validated.sessionLabel ?? stored.sessionLabel ?? null,
        error: null
      };
      setStoredSession(nextState);
      setState(nextState);
    } catch (error) {
      clearStoredSession();
      setState({
        status: "unauthenticated",
        user: null,
        token: null,
        sessionLabel: null,
        error: mapErrorToMessage(error, "Stored session could not be restored.")
      });
    }
  }, []);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    const handleUnauthorized = () => {
      clearStoredSession();
      setState({
        status: "unauthenticated",
        user: null,
        token: null,
        sessionLabel: null,
        error: null
      });
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);

    return () => {
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  const login = useCallback(async (credentials) => {
    const payload = await authService.login(credentials);
    ensureAdminWorkspaceAccess(payload.user);
    const nextState = {
      status: "authenticated",
      user: payload.user ?? null,
      token: payload.token ?? null,
      sessionLabel: payload.sessionLabel ?? null,
      error: null
    };
    setStoredSession(nextState);
    setState(nextState);
    return nextState;
  }, []);

  const logout = useCallback(() => {
    clearStoredSession();
    setState({
      status: "unauthenticated",
      user: null,
      token: null,
      sessionLabel: null,
      error: null
    });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isAuthenticated: state.status === "authenticated",
      login,
      logout,
      restoreSession
    }),
    [state, login, logout, restoreSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
