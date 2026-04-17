import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { getHealth } from "../services/domains/dashboardService";
import { useApi } from "../hooks/useApi";
import AppSidebar from "./components/AppSidebar";
import AppTopbar from "./components/AppTopbar";

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const healthQuery = useApi(getHealth);

  useEffect(() => {
    healthQuery.execute().catch(() => null);
  }, []);

  return (
    <div className="app-shell">
      <div className={`app-shell__sidebar-wrap ${sidebarOpen ? "is-open" : ""}`}>
        <AppSidebar onNavigate={() => setSidebarOpen(false)} />
      </div>
      {sidebarOpen ? (
        <button
          className="app-shell__backdrop"
          type="button"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
      <div className="app-shell__main">
        <AppTopbar health={healthQuery.data} onOpenSidebar={() => setSidebarOpen(true)} />
        <main className="app-shell__content">
          <Outlet context={{ health: healthQuery.data, refreshHealth: healthQuery.execute }} />
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
