import { Navigate, Outlet, useLocation } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";

function ProtectedRoute() {
  const location = useLocation();
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="fullscreen-shell">
        <div className="auth-card">
          <div className="spinner" />
          <h1>Restoring secure session</h1>
          <p>Validating persisted credentials before loading the control surface.</p>
        </div>
      </div>
    );
  }

  if (status !== "authenticated") {
    return <Navigate to={ROUTES.login} replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
