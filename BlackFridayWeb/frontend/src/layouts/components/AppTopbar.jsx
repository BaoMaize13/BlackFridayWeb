import { LogOut, Menu, Server, ShieldAlert } from "lucide-react";

import { useAuth } from "../../hooks/useAuth";
import { formatShortDateTime } from "../../utils/formatters";
import Button from "../../components/ui/Button";
import StatusBadge from "../../components/ui/StatusBadge";

export function AppTopbar({ health, onOpenSidebar }) {
  const { logout, sessionLabel } = useAuth();

  return (
    <header className="app-topbar">
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <button className="app-topbar__menu" type="button" onClick={onOpenSidebar}>
          <Menu size={18} />
        </button>
        <div>
          <div className="app-topbar__eyebrow">Giao diện vận hành distributed locking</div>
          <div className="app-topbar__headline">Workspace giám sát & điều phối đã sẵn sàng tích hợp</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <div className="app-topbar__chip">
          <Server size={15} />
          <span>{health?.serverId ?? "Chưa có Server ID"}</span>
        </div>
        <div className="app-topbar__chip">
          <ShieldAlert size={15} />
          <span>{health?.timestamp ? formatShortDateTime(health.timestamp) : "Chưa nhận health ping"}</span>
        </div>
        <StatusBadge status={health?.status ?? "DEGRADED"} />
        <div className="app-topbar__chip">{sessionLabel ?? "Phiên đăng nhập đã xác thực"}</div>
        <Button tone="ghost" onClick={logout}>
          <LogOut size={16} />
          Đăng xuất
        </Button>
      </div>
    </header>
  );
}

export default AppTopbar;
