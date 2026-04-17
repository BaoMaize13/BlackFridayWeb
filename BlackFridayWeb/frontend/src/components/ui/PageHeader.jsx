import { ArrowRight, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";

import { NAV_GROUPS } from "../../constants/nav";
import { usePageMeta } from "../../hooks/usePageMeta";
import Button from "./Button";

function flattenNav() {
  return NAV_GROUPS.flatMap((group) => group.items);
}

export function PageHeader({ actions, onRefresh, refreshing = false }) {
  const meta = usePageMeta();
  const navIndex = flattenNav().reduce((acc, item) => {
    acc[item.to] = item;
    return acc;
  }, {});

  return (
    <div className="section-card">
      <div className="section-card__body" style={{ display: "grid", gap: "1rem" }}>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <div>
            <div style={{ color: "var(--color-text-muted)", fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              {meta.breadcrumbs.join(" / ")}
            </div>
            <h1 style={{ margin: "0.35rem 0 0.45rem", fontSize: "clamp(1.6rem, 2vw, 2.1rem)" }}>{meta.title}</h1>
            <p style={{ margin: 0, color: "var(--color-text-secondary)", maxWidth: "52rem" }}>{meta.description}</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-start" }}>
            {onRefresh ? (
              <Button tone="secondary" onClick={onRefresh} disabled={refreshing}>
                <RefreshCw size={16} />
                {refreshing ? "Refreshing" : "Refresh"}
              </Button>
            ) : null}
            {actions}
          </div>
        </div>
        {meta.quickActions?.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {meta.quickActions.map((path) => (
              <Link key={path} to={path}>
                <Button tone="ghost">
                  {navIndex[path]?.label ?? path}
                  <ArrowRight size={16} />
                </Button>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default PageHeader;
