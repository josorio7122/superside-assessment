import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import "./shell.css";

interface NavItem {
  id: "brands" | "generations" | "usage" | "plugin";
  label: string;
  to: string;
  match: string;
}

const NAV: NavItem[] = [
  { id: "brands", label: "Brands", to: "/brands", match: "/brands" },
  { id: "generations", label: "Generations", to: "/generations", match: "/generations" },
  { id: "usage", label: "Usage", to: "/usage", match: "/usage" },
  { id: "plugin", label: "Plugin", to: "/plugin", match: "/plugin" },
];

export function Shell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const activeId =
    NAV.find((n) => path === n.match || path.startsWith(`${n.match}/`))?.id ?? "brands";

  return (
    <div className="studio-shell">
      <div className="chrome">
        <div className="chrome-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="chrome-url">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          >
            <rect x="2" y="4.5" width="6" height="4.5" rx="0.5" />
            <path d="M3.5 4.5 V3 a1.5 1.5 0 0 1 3 0 V4.5" />
          </svg>
          <span>studio.superside.app{path === "/" ? "/brands" : path}</span>
        </div>
        <div className="chrome-actions" aria-hidden="true">
          <span className="chrome-btn"></span>
          <span className="chrome-btn"></span>
        </div>
      </div>

      <div className="app">
        <aside className="sidebar" aria-label="Studio navigation">
          <button type="button" className="sidebar-workspace" aria-label="Switch workspace">
            <span className="ws-mark" aria-hidden="true"></span>
            <span className="ws-text">
              <span className="ws-name">DesignTechCo</span>
              <span className="ws-meta mono">admin · pilot</span>
            </span>
            <svg
              className="ws-chevron"
              width="10"
              height="10"
              viewBox="0 0 10 10"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            >
              <path d="M3 4 L5 6 L7 4 M3 6.5 L5 8.5 L7 6.5" />
            </svg>
          </button>
          <nav>
            <ul>
              {NAV.map((n) => {
                const active = activeId === n.id;
                return (
                  <li key={n.id}>
                    <Link to={n.to} data-active={active ? "" : undefined}>
                      <span className="ico" aria-hidden="true">
                        {n.id === "brands" && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                            <rect x="2" y="2" width="4" height="4" />
                            <rect x="8" y="2" width="4" height="4" />
                            <rect x="2" y="8" width="4" height="4" />
                            <rect x="8" y="8" width="4" height="4" />
                          </svg>
                        )}
                        {n.id === "generations" && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                            <circle cx="7" cy="7" r="5.2" />
                            <path d="M7 4 V7 L9 8.5" />
                          </svg>
                        )}
                        {n.id === "usage" && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                            <path d="M2 11.5 L5 8 L7.5 10 L12 4" />
                            <path d="M9 4 H12 V7" />
                          </svg>
                        )}
                        {n.id === "plugin" && (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3">
                            <rect x="2" y="2" width="10" height="10" rx="1" />
                            <path d="M5 5.5 L7 7.5 L9 5.5" />
                          </svg>
                        )}
                      </span>
                      <span className="lbl">{n.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="sidebar-footer">
            <div className="sidebar-user">
              <span className="user-avatar">J</span>
              <div>
                <p>Jo Osorio</p>
                <p className="mono">jo@designtech.co</p>
              </div>
            </div>
          </div>
        </aside>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
