import { Outlet } from "react-router-dom";

function AuthLayout() {
  return (
    <div className="fullscreen-shell">
      <Outlet />
    </div>
  );
}

export default AuthLayout;
