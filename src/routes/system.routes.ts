import { Elysia, t } from "elysia";
import { config } from "../config/env";
import { checkPeliasStatus } from "../services/geocode.service";
import {
  getRequestLogById,
  queryRequestLogs,
} from "../services/request-log.service";
import { getClientIp } from "../utils/client-ip";
import { isDirectLocalApiAccess } from "../utils/internal-request";
import { publicProbeResult, sanitizeProbeMessage } from "../utils/public-probe";

type OsrmProbeStatus = "ok" | "error" | "down" | "unreachable";

async function probeOsrm(baseUrl: string) {
  const url = `${baseUrl}/route/v1/driving/106.660172,10.762622;106.700806,10.776889?overview=false`;
  try {
    const res = await fetch(url);
    const text = await res.text();
    let parsed: { code?: string; message?: string } | null = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      return {
        status: "unreachable" as OsrmProbeStatus,
        url: baseUrl,
        message: `OSRM returned HTTP ${res.status} (not JSON).`,
      };
    }
    if (parsed?.code === "Ok") {
      return { status: "ok" as OsrmProbeStatus, url: baseUrl };
    }
    return {
      status: "error" as OsrmProbeStatus,
      url: baseUrl,
      message: parsed?.message ?? `HTTP ${res.status}`,
    };
  } catch {
    return {
      status: "down" as OsrmProbeStatus,
      url: baseUrl,
      message: `Cannot connect to OSRM at ${baseUrl}`,
    };
  }
}

export const systemRoutes = new Elysia()
  .get("/", () => ({
    success: true,
    service: "routing-api",
    message: "API only — UI on port 80. Playground: /playaround",
    api: { health: "/health", docs: "/playaround/api" },
  }))
  .get("/api/client-ip", ({ request }) => ({
    success: true,
    data: {
      ip: getClientIp(request),
      userAgent: request.headers.get("user-agent") ?? "unknown",
      timestamp: new Date().toISOString(),
      forwardedFor: request.headers.get("x-forwarded-for"),
    },
  }))
  .get("/api/info", () => ({
    success: true,
    service: "Routing API",
    version: config.version,
  }))
  .get("/api/osrm-status", async () => {
    const probe = await probeOsrm(config.osrmUrl);
    if (probe.status === "ok") {
      return { success: true, osrm: "ok", service: "osrm-car" };
    }
    return {
      success: false,
      osrm: probe.status === "down" ? "down" : "error",
      service: "osrm-car",
      message: sanitizeProbeMessage(probe.message),
    };
  })
  .get("/api/osrm-motor-status", async () => {
    const probe = await probeOsrm(config.osrmMotorUrl);
    if (probe.status === "ok") {
      return { success: true, osrm: "ok", service: "osrm-motor" };
    }
    return {
      success: false,
      osrm: probe.status === "down" ? "down" : "error",
      service: "osrm-motor",
      message: sanitizeProbeMessage(probe.message),
    };
  })
  .get("/api/system-status", ({ request, set }) => {
    if (!isDirectLocalApiAccess(request)) {
      set.status = 404;
      return { success: false, message: "Not found" };
    }
    return probeSystemStatus();
  })
  .get(
    "/api/request-logs",
    ({ query }) => ({
      success: true,
      data: queryRequestLogs({
        limit: query.limit ? Number(query.limit) : undefined,
        offset: query.offset ? Number(query.offset) : undefined,
        status: query.status ? Number(query.status) : undefined,
        method: query.method,
        path: query.path,
        ip: query.ip,
        since: query.since,
      }),
    }),
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        status: t.Optional(t.String()),
        method: t.Optional(t.String()),
        path: t.Optional(t.String()),
        ip: t.Optional(t.String()),
        since: t.Optional(t.String()),
      }),
    },
  )
  .get("/api/request-logs/:id", ({ params, set }) => {
    const entry = getRequestLogById(params.id);
    if (!entry) {
      set.status = 404;
      return { success: false, message: "Log entry not found" };
    }
    return { success: true, data: entry };
  });

async function probeSystemStatus() {
  const [osrmCar, osrmMotor, pelias] = await Promise.all([
    probeOsrm(config.osrmUrl),
    probeOsrm(config.osrmMotorUrl),
    checkPeliasStatus(),
  ]);
  return {
    success: true,
    data: {
      api: {
        status: "ok" as const,
        service: config.serviceName,
        version: config.version,
      },
      osrmCar: publicProbeResult("osrm-car", osrmCar),
      osrmMotor: publicProbeResult("osrm-motor", osrmMotor),
      pelias: {
        status: pelias.ok ? ("ok" as const) : ("down" as const),
        service: "pelias",
        message: sanitizeProbeMessage(pelias.message),
      },
      checkedAt: new Date().toISOString(),
    },
  };
}
