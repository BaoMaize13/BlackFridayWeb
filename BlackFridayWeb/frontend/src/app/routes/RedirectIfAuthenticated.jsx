import { Navigate, Outlet } from "react-router-dom";

import { ROUTES } from "../../constants/routes";
import { useAuth } from "../../hooks/useAuth";

function RedirectIfAuthenticated() {
  const { status } = useAuth();

  if (status === "authenticated") {
    return <Navigate to={ROUTES.dashboard} replace />;
  }

  return <Outlet />;
}

export default RedirectIfAuthenticated;
