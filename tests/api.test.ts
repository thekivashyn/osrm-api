import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "bun";
import { createMockOsrmServer } from "./mock-osrm";

const HCM = {
  from: { lat: 10.762622, lng: 106.660172 },
  to: { lat: 10.776889, lng: 106.700806 },
};

let mockOsrm: Server | undefined;
let api: Server | undefined;
let baseUrl: string;

async function apiFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    const text = await res.text();
    return { status: res.status, body: { html: text } as Record<string, unknown> };
  }
  const text = await res.text();
  let body: Record<string, unknown>;
  try {
    body = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    body = { success: false, message: text };
  }
  return { status: res.status, body };
}

beforeAll(async () => {
  mockOsrm = createMockOsrmServer();
  process.env.OSRM_URL = `http://localhost:${mockOsrm.port}`;
  process.env.ROUTING_DURATION_FACTOR_CAR = "1";
  process.env.ROUTING_DURATION_FACTOR_MOTORBIKE = "1";

  const { createApp } = await import("../src/app");
  api = Bun.serve({ port: 0, fetch: createApp().fetch });
  baseUrl = `http://localhost:${api.port}`;
});

afterAll(() => {
  mockOsrm?.stop();
  api?.stop();
});

describe("GET /", () => {
  test("returns API info JSON (UI on port 80)", async () => {
    const { status, body } = await apiFetch("/");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.service).toBe("routing-api");
    expect(String(body.message)).toContain("playaround");
  });
});

describe("GET /api/info", () => {
  test("returns service info JSON", async () => {
    const { status, body } = await apiFetch("/api/info");
    expect(status).toBe(200);
    expect(body).toEqual({ success: true, service: "Routing API", version: "1.0.0" });
  });
});

describe("GET /health", () => {
  test("returns ok status", async () => {
    const { status, body } = await apiFetch("/health");
    expect(status).toBe(200);
    expect(body).toMatchObject({ success: true, service: "routing-api", status: "ok" });
  });
});

describe("GET /docs", () => {
  test("removed — docs live at UI /playaround/api", async () => {
    const { status } = await apiFetch("/docs");
    expect(status).toBe(404);
  });
});

describe("POST /api/route — success", () => {
  test("returns route data from OSRM", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify(HCM),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.distance).toBe(5234.5);
    expect(body.data.durationOsrm).toBe(612.3);
    expect(body.data.duration).toBe(612.3);
    expect(body.data.durationMeta).toMatchObject({
      available: true,
      trafficFactor: 1,
      profile: "driving",
      source: "osrm_static",
    });
    expect(body.data.geometry.type).toBe("LineString");
    expect(body.data.summary).toContain("Nguyen Hue");
    expect(body.data.legs).toHaveLength(1);
  });
});

describe("POST /api/route — validation errors", () => {
  test("lat > 90", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: 91, lng: 106 }, to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/lat/);
  });

  test("lat < -90", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: -91, lng: 106 }, to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/lat/);
  });

  test("lng > 180", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: 10, lng: 181 }, to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/lng/);
  });

  test("lng < -180", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: 10, lng: -181 }, to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/lng/);
  });

  test("missing from", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  test("invalid from type (string lat)", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: "10.76", lng: 106 }, to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  test("NaN coordinates", async () => {
    const { status, body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: NaN, lng: 106 }, to: HCM.to }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe("POST /api/table — success", () => {
  test("returns distance and duration matrices", async () => {
    const { status, body } = await apiFetch("/api/table", {
      method: "POST",
      body: JSON.stringify({
        sources: [HCM.from],
        destinations: [HCM.to, { lat: 10.823099, lng: 106.629664 }],
      }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.distances).toEqual([[5234.5, 8100.2]]);
    expect(body.data.durations).toEqual([[612.3, 900.1]]);
    expect(body.data.sources).toHaveLength(1);
    expect(body.data.destinations).toHaveLength(2);
  });
});

describe("POST /api/table — validation errors", () => {
  test("empty sources", async () => {
    const { status, body } = await apiFetch("/api/table", {
      method: "POST",
      body: JSON.stringify({ sources: [], destinations: [HCM.to] }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/sources/);
  });

  test("empty destinations", async () => {
    const { status, body } = await apiFetch("/api/table", {
      method: "POST",
      body: JSON.stringify({ sources: [HCM.from], destinations: [] }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/destinations/);
  });

  test("sources not array", async () => {
    const { status, body } = await apiFetch("/api/table", {
      method: "POST",
      body: JSON.stringify({ sources: "bad", destinations: [HCM.to] }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });

  test("invalid coordinate in destinations", async () => {
    const { status, body } = await apiFetch("/api/table", {
      method: "POST",
      body: JSON.stringify({
        sources: [HCM.from],
        destinations: [{ lat: 999, lng: 106 }],
      }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/destinations\[0\]/);
  });
});

describe("POST /api/nearest — success", () => {
  test("returns snapped waypoint", async () => {
    const { status, body } = await apiFetch("/api/nearest", {
      method: "POST",
      body: JSON.stringify({ lat: 10.77, lng: 106.68 }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.waypoint.name).toBe("Nguyen Hue");
    expect(body.data.nodes).toEqual([12345]);
  });
});

describe("POST /api/nearest — validation errors", () => {
  test("invalid lat", async () => {
    const { status, body } = await apiFetch("/api/nearest", {
      method: "POST",
      body: JSON.stringify({ lat: 100, lng: 106 }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/lat/);
  });

  test("missing lng", async () => {
    const { status, body } = await apiFetch("/api/nearest", {
      method: "POST",
      body: JSON.stringify({ lat: 10.77 }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe("POST /api/match — success", () => {
  test("returns matched geometry", async () => {
    const { status, body } = await apiFetch("/api/match", {
      method: "POST",
      body: JSON.stringify({
        points: [HCM.from, { lat: 10.77, lng: 106.68 }, HCM.to],
      }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.matchings).toHaveLength(1);
    expect(body.data.matchings[0].confidence).toBe(0.95);
    expect(body.data.tracepoints).toHaveLength(3);
  });
});

describe("POST /api/match — validation errors", () => {
  test("only 1 point", async () => {
    const { status, body } = await apiFetch("/api/match", {
      method: "POST",
      body: JSON.stringify({ points: [HCM.from] }),
    });
    expect(status).toBe(400);
    expect(body.message).toMatch(/at least 2/);
  });

  test("points not array", async () => {
    const { status, body } = await apiFetch("/api/match", {
      method: "POST",
      body: JSON.stringify({ points: HCM.from }),
    });
    expect(status).toBe(400);
    expect(body.success).toBe(false);
  });
});

describe("error response format", () => {
  test("always returns { success, message } on error", async () => {
    const { body } = await apiFetch("/api/route", {
      method: "POST",
      body: JSON.stringify({ from: { lat: 999, lng: 0 }, to: HCM.to }),
    });
    expect(body).toEqual({
      success: false,
      message: expect.stringContaining("lat"),
    });
  });
});

describe("success response format", () => {
  test("always returns { success, data } on success", async () => {
    const { body } = await apiFetch("/api/nearest", {
      method: "POST",
      body: JSON.stringify({ lat: 10.77, lng: 106.68 }),
    });
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.message).toBeUndefined();
  });
});

describe("boundary coordinates", () => {
  test("accepts lat/lng at exact bounds", async () => {
    const { status, body } = await apiFetch("/api/nearest", {
      method: "POST",
      body: JSON.stringify({ lat: 90, lng: 180 }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });

  test("accepts negative bounds", async () => {
    const { status, body } = await apiFetch("/api/nearest", {
      method: "POST",
      body: JSON.stringify({ lat: -90, lng: -180 }),
    });
    expect(status).toBe(200);
    expect(body.success).toBe(true);
  });
});

describe("GET /api/system-status", () => {
  test("returns 404 when proxied (X-Forwarded-For)", async () => {
    const { status, body } = await apiFetch("/api/system-status", {
      headers: { "X-Forwarded-For": "203.0.113.1" },
    });
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });

  test("returns aggregated status on direct local access", async () => {
    const { status, body } = await apiFetch("/api/system-status");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    const data = body.data as Record<string, unknown>;
    expect(data.api).toBeDefined();
    expect(data.osrmCar).toBeDefined();
    expect(data.osrmMotor).toBeDefined();
    expect(data.pelias).toBeDefined();
  });
});

describe("GET /api/osrm-motor-status", () => {
  test("probes motor OSRM", async () => {
    const { status, body } = await apiFetch("/api/osrm-motor-status");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.osrm).toBe("ok");
  });
});

describe("GET /api/request-logs", () => {
  test("lists recorded requests with filters", async () => {
    await apiFetch("/api/info");
    await apiFetch("/health");

    const { status, body } = await apiFetch("/api/request-logs?limit=10&path=info");
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    const data = body.data as {
      total: number;
      items: { path: string; method: string; id: string }[];
    };
    expect(data.total).toBeGreaterThan(0);
    expect(data.items.some((e) => e.path === "/api/info")).toBe(true);
  });

  test("returns single entry by id", async () => {
    await apiFetch("/api/info");
    const list = await apiFetch("/api/request-logs?limit=1&path=info");
    const data = list.body.data as { items: { id: string }[] };
    const id = data.items[0]?.id;
    expect(id).toBeDefined();

    const { status, body } = await apiFetch(`/api/request-logs/${id}`);
    expect(status).toBe(200);
    expect(body.success).toBe(true);
    expect((body.data as { id: string }).id).toBe(id);
  });

  test("404 for unknown log id", async () => {
    const { status, body } = await apiFetch("/api/request-logs/00000000-0000-0000-0000-000000000000");
    expect(status).toBe(404);
    expect(body.success).toBe(false);
  });
});

describe("unknown route", () => {
  test("returns 404 for unknown path", async () => {
    const res = await fetch(`${baseUrl}/api/unknown`, { method: "POST" });
    expect(res.status).toBe(404);
  });

  test("POST /api/trip removed", async () => {
    const { status } = await apiFetch("/api/trip", {
      method: "POST",
      body: JSON.stringify({ points: [HCM.from, HCM.to] }),
    });
    expect(status).toBe(404);
  });
});
