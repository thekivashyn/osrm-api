import { Elysia } from "elysia";
import { config } from "../config/env";
import { renderPlaygroundHtml } from "./ui/playground";

export const uiRoutes = new Elysia()
  .get("/", () => {
    return new Response(renderPlaygroundHtml(), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  })
  .get("/api/info", () => ({
    success: true,
    service: "Routing API",
    version: config.version,
  }))
  .get("/api/osrm-status", async () => {
    const url = `${config.osrmUrl}/route/v1/driving/106.660172,10.762622;106.700806,10.776889?overview=false`;
    try {
      const res = await fetch(url);
      const text = await res.text();
      let parsed: { code?: string } | null = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        return {
          success: false,
          osrm: "unreachable",
          url: config.osrmUrl,
          message: `OSRM returned HTTP ${res.status} (not JSON). Use OSRM_URL=http://localhost:5050`,
        };
      }
      if (parsed?.code === "Ok") {
        return { success: true, osrm: "ok", url: config.osrmUrl };
      }
      return {
        success: false,
        osrm: "error",
        url: config.osrmUrl,
        message: (parsed as { message?: string })?.message ?? `HTTP ${res.status}`,
      };
    } catch {
      return {
        success: false,
        osrm: "down",
        url: config.osrmUrl,
        message: `Cannot connect to OSRM at ${config.osrmUrl}. Run: bun run osrm:up`,
      };
    }
  });
