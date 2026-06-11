import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

type NavItem = {
  path: string;
  label: string;
  end?: boolean;
  icon: ReactNode;
  statusDot?: boolean;
};

const NAV: NavItem[] = [
  {
    path: "/playaround",
    label: "Playaround",
    end: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" d="M3 11l19-9-9 19-2-8-8-2z" />
      </svg>
    ),
  },
  {
    path: "/playaround/services",
    label: "Giám sát",
    statusDot: true,
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    path: "/playaround/api",
    label: "API",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" d="M8 9l-3 3 3 3M16 9l3 3-3 3M14 4l-4 16" />
      </svg>
    ),
  },
  {
    path: "/playaround/session",
    label: "Phiên",
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path strokeLinecap="round" d="M12 3 20 7v5c0 4.5-3.2 8.7-8 10-4.8-1.3-8-5.5-8-10V7l8-4z" />
      </svg>
    ),
  },
];

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  servicesOk,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  servicesOk: boolean | null;
}) {
  return (
    <aside
      className={`console-sidebar relative z-30 flex shrink-0 flex-col border-r border-white/[0.08] bg-black transition-[width] duration-200 ${
        collapsed ? "w-14" : "w-52"
      }`}
    >
      <div className={`flex h-11 items-center border-b border-white/[0.08] ${collapsed ? "justify-center px-2" : "justify-between px-3"}`}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">Console</p>
            <p className="text-[10px] text-neutral-600">Routing VN</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/[0.08] text-neutral-500 transition hover:border-white/20 hover:text-white"
          title={collapsed ? "Mở sidebar" : "Thu gọn sidebar"}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            {collapsed ? (
              <path strokeLinecap="round" d="M9 18l6-6-6-6" />
            ) : (
              <path strokeLinecap="round" d="M15 18l-6-6 6-6" />
            )}
          </svg>
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${
                isActive
                  ? "bg-white/[0.08] text-white"
                  : "text-neutral-500 hover:bg-white/[0.04] hover:text-neutral-300"
              } ${collapsed ? "justify-center px-0" : ""}`
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={`relative shrink-0 ${isActive ? "text-white" : "text-neutral-500 group-hover:text-neutral-300"}`}
                >
                  {item.icon}
                  {item.statusDot && servicesOk !== null && (
                    <span
                      className={`absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full ${
                        servicesOk ? "bg-emerald-400" : "bg-rose-500"
                      }`}
                    />
                  )}
                </span>
                {!collapsed && <span className="truncate text-xs font-medium">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {!collapsed && (
        <div className="border-t border-white/[0.08] p-3">
          <p className="text-[10px] uppercase tracking-wider text-neutral-700">Internal</p>
          <p className="mt-1 text-[10px] leading-relaxed text-neutral-600">Giám sát OSRM · Geo · API</p>
        </div>
      )}
    </aside>
  );
}
