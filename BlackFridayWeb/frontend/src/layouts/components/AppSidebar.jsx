import {
  Activity,
  BarChart3,
  FlaskConical,
  GitCompareArrows,
  LayoutDashboard,
  LockKeyhole,
  Logs,
  PackageSearch,
  ReceiptText,
  ScrollText,
  Settings2,
  ShieldCheck,
  ShieldOff,
  ShoppingCart,
  Warehouse
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { NAV_GROUPS } from "../../constants/nav";

const iconMap = {
  "layout-dashboard": LayoutDashboard,
  "package-search": PackageSearch,
  warehouse: Warehouse,
  "shopping-cart": ShoppingCart,
  "scroll-text": ScrollText,
  "shield-off": ShieldOff,
  "shield-check": ShieldCheck,
  "git-compare-arrows": GitCompareArrows,
  "lock-keyhole": LockKeyhole,
  logs: Logs,
  "flask-conical": FlaskConical,
  "chart-column-increasing": BarChart3,
  "settings-2": Settings2,
  "receipt-text": ReceiptText,
  activity: Activity
};

export function AppSidebar({ onNavigate }) {
  return (
    <aside className="app-sidebar">
      <div className="app-sidebar__brand">
        <div className="app-sidebar__brand-mark">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>BlackFridayWeb</strong>
          <div className="app-sidebar__brand-copy">Oversell & lock control plane</div>
        </div>
      </div>
      <nav className="app-sidebar__nav">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="app-sidebar__group">
            <div className="app-sidebar__group-label">{group.label}</div>
            {group.items.map((item) => {
              const Icon = iconMap[item.icon] ?? Activity;
              return (
                <NavLink
                  key={item.key}
                  to={item.to}
                  className={({ isActive }) =>
                    `app-sidebar__link ${isActive ? "is-active" : ""}`
                  }
                  onClick={onNavigate}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

export default AppSidebar;
