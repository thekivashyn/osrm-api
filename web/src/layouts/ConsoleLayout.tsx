import { useEffect, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { Header } from "../components/Header";
import { Sidebar } from "../components/Sidebar";
import { useServiceStatus } from "../hooks/useServiceStatus";
import RoutingView from "../views/RoutingView";

type ConsoleContext = { osrm: "ok" | "down" | "loading" };

const TITLES: Record<string, string> = {
  "/playaround": "Playaround",
  "/playaround/services": "Giám sát dịch vụ",
  "/playaround/api": "API",
  "/playaround/session": "Phiên truy cập",
};

export function ConsoleLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { osrm, geo } = useServiceStatus();
  const { pathname } = useLocation();
  const servicesOk =
    osrm === "loading" || geo === "loading" ? null : osrm === "ok" && geo === "ok";

  useEffect(() => {
    document.body.classList.add("playground-active");
    return () => document.body.classList.remove("playground-active");
  }, []);

  const title = TITLES[pathname] ?? "Console";

  return (
    <div className="playground-ui flex h-screen overflow-hidden bg-black">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        servicesOk={servicesOk}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header osrm={osrm} geo={geo} title={title} />
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <Outlet context={{ osrm } satisfies ConsoleContext} />
        </div>
      </div>
    </div>
  );
}

export function useConsoleContext() {
  return useOutletContext<ConsoleContext>();
}

export function PlayaroundIndexPage() {
  const { osrm } = useConsoleContext();
  return <RoutingView osrm={osrm} />;
}
