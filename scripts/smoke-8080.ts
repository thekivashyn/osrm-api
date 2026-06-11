/**
 * Smoke tests against http://localhost:8080
 * Starts mock OSRM + Routing API on 8080, runs cases, prints report.
 */
import { createMockOsrmServer } from "../tests/mock-osrm";

const PORT = 8080;
const BASE = `http://localhost:${PORT}`;

const HCM = {
  from: { lat: 10.762622, lng: 106.660172 },
  to: { lat: 10.776889, lng: 106.700806 },
};

type Case = {
  name: string;
  method: string;
  path: string;
  body?: unknown;
  expectStatus: number;
  expect?: (body: Record<string, unknown>) => boolean;
  expectHtml?: string;
};

const cases: Case[] = [
  {
    name: "GET /health",
    method: "GET",
    path: "/health",
    expectStatus: 200,
    expect: (b) => b.success === true && b.status === "ok",
  },
  {
    name: "GET / — UI playground",
    method: "GET",
    path: "/",
    expectStatus: 200,
    expectHtml: "Routing API Playground",
  },
  {
    name: "GET /api/info",
    method: "GET",
    path: "/api/info",
    expectStatus: 200,
    expect: (b) => b.success === true && b.service === "Routing API",
  },
  {
    name: "POST /api/route — success",
    method: "POST",
    path: "/api/route",
    body: HCM,
    expectStatus: 200,
    expect: (b) => b.success === true && typeof (b.data as Record<string, unknown>)?.distance === "number",
  },
  {
    name: "POST /api/route — lat > 90",
    method: "POST",
    path: "/api/route",
    body: { from: { lat: 91, lng: 106 }, to: HCM.to },
    expectStatus: 400,
    expect: (b) => b.success === false && String(b.message).includes("lat"),
  },
  {
    name: "POST /api/table — success",
    method: "POST",
    path: "/api/table",
    body: {
      sources: [HCM.from],
      destinations: [HCM.to, { lat: 10.823099, lng: 106.629664 }],
    },
    expectStatus: 200,
    expect: (b) => b.success === true && Array.isArray((b.data as Record<string, unknown>)?.distances),
  },
  {
    name: "POST /api/table — empty sources",
    method: "POST",
    path: "/api/table",
    body: { sources: [], destinations: [HCM.to] },
    expectStatus: 400,
    expect: (b) => b.success === false,
  },
  {
    name: "POST /api/nearest — success",
    method: "POST",
    path: "/api/nearest",
    body: { lat: 10.77, lng: 106.68 },
    expectStatus: 200,
    expect: (b) => b.success === true && (b.data as Record<string, unknown>)?.waypoint != null,
  },
  {
    name: "POST /api/nearest — invalid lat",
    method: "POST",
    path: "/api/nearest",
    body: { lat: 100, lng: 106 },
    expectStatus: 400,
    expect: (b) => b.success === false,
  },
  {
    name: "POST /api/match — success",
    method: "POST",
    path: "/api/match",
    body: { points: [HCM.from, { lat: 10.77, lng: 106.68 }, HCM.to] },
    expectStatus: 200,
    expect: (b) => b.success === true && Array.isArray((b.data as Record<string, unknown>)?.matchings),
  },
  {
    name: "POST /api/match — only 1 point",
    method: "POST",
    path: "/api/match",
    body: { points: [HCM.from] },
    expectStatus: 400,
    expect: (b) => b.success === false,
  },
];

async function runCase(c: Case): Promise<{ pass: boolean; status: number; body: unknown }> {
  const init: RequestInit = { method: c.method };
  if (c.body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(c.body);
  }

  const res = await fetch(`${BASE}${c.path}`, init);
  const contentType = res.headers.get("content-type") ?? "";

  let body: Record<string, unknown> | string;
  if (contentType.includes("application/json")) {
    body = (await res.json()) as Record<string, unknown>;
  } else {
    body = await res.text();
  }

  const statusOk = res.status === c.expectStatus;
  const bodyOk = c.expect
    ? typeof body === "object" && body !== null && c.expect(body as Record<string, unknown>)
    : c.expectHtml
      ? typeof body === "string" && (body as string).includes(c.expectHtml)
      : res.status === 200 && typeof body === "string"
        ? (body as string).includes("<!DOCTYPE html")
        : true;

  return { pass: statusOk && bodyOk, status: res.status, body };
}

async function main() {
  const mockOsrm = createMockOsrmServer();
  process.env.OSRM_URL = `http://localhost:${mockOsrm.port}`;
  process.env.PORT = String(PORT);

  const { createApp } = await import("../src/app");
  const app = createApp().listen(PORT);

  console.log(`\n🧪 Smoke tests → ${BASE}\n`);
  console.log("─".repeat(72));

  let passed = 0;
  let failed = 0;

  for (const c of cases) {
    const { pass, status, body } = await runCase(c);
    const icon = pass ? "✅" : "❌";
    console.log(`${icon} ${c.name.padEnd(36)} HTTP ${status}`);

    if (!pass) {
      failed++;
      const preview =
        typeof body === "string" ? body.slice(0, 120) : JSON.stringify(body).slice(0, 120);
      console.log(`   ↳ expected ${c.expectStatus}, got ${JSON.stringify(preview)}`);
    } else {
      passed++;
      if (typeof body === "object" && body !== null && "data" in body) {
        const data = body.data as Record<string, unknown>;
        const hint = [
          data.distance != null && `distance=${data.distance}`,
          data.duration != null && `duration=${data.duration}`,
          data.waypoint != null && "waypoint=ok",
          data.matchings != null && `matchings=${(data.matchings as unknown[]).length}`,
          data.distances != null && "matrix=ok",
        ]
          .filter(Boolean)
          .join(", ");
        if (hint) console.log(`   ↳ ${hint}`);
      }
    }
  }

  console.log("─".repeat(72));
  console.log(`\n📊 Result: ${passed}/${cases.length} passed on port ${PORT}\n`);

  app.stop();
  mockOsrm.stop();

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
