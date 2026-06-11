import { Elysia } from "elysia";
import { config } from "../config/env";

const endpoints = [
  {
    method: "POST",
    path: "/api/route",
    description: "Calculate route between two points (profile: driving | motorbike, alternative routes)",
    sample: {
      from: { lat: 10.7635, lng: 106.644 },
      to: { lat: 10.795112, lng: 106.731227 },
      profile: "driving",
      alternatives: true,
    },
  },
  {
    method: "POST",
    path: "/api/table",
    description: "Compute distance and duration matrix between sources and destinations",
    sample: {
      sources: [{ lat: 10.762622, lng: 106.660172 }],
      destinations: [
        { lat: 10.776889, lng: 106.700806 },
        { lat: 10.823099, lng: 106.629664 },
      ],
    },
  },
  {
    method: "POST",
    path: "/api/nearest",
    description: "Snap a coordinate to the nearest road segment",
    sample: { lat: 10.77, lng: 106.68 },
  },
  {
    method: "POST",
    path: "/api/match",
    description: "Match GPS trace points to the road network",
    sample: {
      points: [
        { lat: 10.762622, lng: 106.660172 },
        { lat: 10.770000, lng: 106.680000 },
        { lat: 10.776889, lng: 106.700806 },
      ],
    },
  },
  {
    method: "POST",
    path: "/api/trip",
    description: "Solve a traveling salesman problem for multiple waypoints",
    sample: {
      points: [
        { lat: 10.762622, lng: 106.660172 },
        { lat: 10.776889, lng: 106.700806 },
        { lat: 10.823099, lng: 106.629664 },
      ],
      roundtrip: false,
    },
  },
];

function renderEndpoint(endpoint: (typeof endpoints)[number]): string {
  return `
    <section class="endpoint">
      <h2><span class="method">${endpoint.method}</span> ${endpoint.path}</h2>
      <p>${endpoint.description}</p>
      <h3>Sample Request</h3>
      <pre>${JSON.stringify(endpoint.sample, null, 2)}</pre>
    </section>`;
}

export const docsRoutes = new Elysia().get("/docs", () => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${config.serviceName} — API Docs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #e2e8f0; line-height: 1.6; padding: 2rem; max-width: 900px; margin: 0 auto; }
    h1 { font-size: 1.75rem; margin-bottom: 0.5rem; color: #f8fafc; }
    .subtitle { color: #94a3b8; margin-bottom: 2rem; }
    .endpoint { background: #1e293b; border-radius: 8px; padding: 1.5rem; margin-bottom: 1.5rem; border: 1px solid #334155; }
    .endpoint h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .method { background: #059669; color: white; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .endpoint p { color: #94a3b8; margin-bottom: 1rem; }
    .endpoint h3 { font-size: 0.85rem; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
    pre { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 1rem; overflow-x: auto; font-size: 0.85rem; color: #a5f3fc; }
    .health { background: #1e293b; border-radius: 8px; padding: 1rem 1.5rem; margin-bottom: 2rem; border: 1px solid #334155; }
    .health code { color: #a5f3fc; }
  </style>
</head>
<body>
  <h1>Routing API</h1>
  <p class="subtitle">Internal routing service powered by OSRM · v${config.version}</p>
  <div class="health">
    <strong>Health check:</strong> <code>GET /health</code>
  </div>
  ${endpoints.map(renderEndpoint).join("\n")}
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});
