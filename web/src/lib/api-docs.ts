export type ApiDocCategory = "system" | "geocode" | "routing";

export type ApiDocParam = {
  name: string;
  in: "query" | "body";
  type: string;
  required?: boolean;
  description: string;
};

export type ApiDocField = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

export type ApiDocEndpoint = {
  id: string;
  method: "GET" | "POST";
  path: string;
  title: string;
  description: string;
  category: ApiDocCategory;
  query?: string;
  params?: ApiDocParam[];
  /** Response body field reference (paths relative to envelope) */
  response?: ApiDocField[];
  /** root = fields at top level; data (default) = inside data */
  responseWrap?: "root" | "data";
  sample?: unknown;
  sampleResponse?: unknown;
  errors?: { status: number; description: string }[];
  tryQuery?: Record<string, string>;
};

const ENVELOPE_OK: ApiDocField[] = [
  { name: "success", type: "true", required: true, description: "Luôn true khi HTTP 2xx" },
];

const ENVELOPE_ERR: ApiDocField[] = [
  { name: "success", type: "false", required: true, description: "Luôn false khi lỗi" },
  { name: "message", type: "string", required: true, description: "Mô tả lỗi (validation, OSRM, …)" },
];

export { ENVELOPE_ERR };

export const API_DOC_CATEGORIES: {
  id: ApiDocCategory;
  label: string;
  description: string;
}[] = [
  {
    id: "system",
    label: "System & giám sát",
    description: "Health, probe OSRM/Nominatim, audit IP client.",
  },
  {
    id: "geocode",
    label: "Geocoding",
    description: "Tìm kiếm và reverse geocode qua Nominatim (Việt Nam).",
  },
  {
    id: "routing",
    label: "Routing OSRM",
    description: "Tuyến đường, matrix, snap, match — graph Vietnam.",
  },
];

export const API_DOCS: ApiDocEndpoint[] = [
  {
    id: "health",
    method: "GET",
    path: "/health",
    title: "Health check",
    description: "Kiểm tra API gateway. Dùng cho load balancer hoặc uptime monitor.",
    category: "system",
    responseWrap: "root",
    response: [
      ...ENVELOPE_OK,
      { name: "service", type: "string", description: "Tên service (routing-api)" },
      { name: "status", type: "string", description: "ok khi API sẵn sàng" },
    ],
    sampleResponse: { success: true, service: "routing-api", status: "ok" },
  },
  {
    id: "info",
    method: "GET",
    path: "/api/info",
    title: "Service info",
    description: "Metadata dịch vụ — tên và phiên bản API.",
    category: "system",
    responseWrap: "root",
    response: [
      ...ENVELOPE_OK,
      { name: "service", type: "string", description: "Tên hiển thị API" },
      { name: "version", type: "string", description: "Semantic version" },
    ],
    sampleResponse: { success: true, service: "Routing API", version: "1.0.0" },
  },
  {
    id: "osrm-status",
    method: "GET",
    path: "/api/osrm-status",
    title: "OSRM status (car)",
    description: "Probe riêng OSRM profile driving.",
    category: "system",
    responseWrap: "root",
    response: [
      { name: "success", type: "boolean", description: "true nếu OSRM trả Ok" },
      { name: "osrm", type: "ok | down | error", description: "Trạng thái probe" },
      { name: "service", type: "string", description: "Nhãn nội bộ (osrm-car)" },
      { name: "message", type: "string", description: "Chi tiết lỗi (khi success=false)" },
    ],
    sampleResponse: { success: true, osrm: "ok", service: "osrm-car" },
  },
  {
    id: "osrm-motor-status",
    method: "GET",
    path: "/api/osrm-motor-status",
    title: "OSRM status (motorbike)",
    description: "Probe riêng OSRM profile xe máy.",
    category: "system",
    responseWrap: "root",
    response: [
      { name: "success", type: "boolean", description: "true nếu OSRM motor trả Ok" },
      { name: "osrm", type: "ok | down | error", description: "Trạng thái probe" },
      { name: "service", type: "string", description: "Nhãn nội bộ (osrm-motor)" },
      { name: "message", type: "string", description: "Chi tiết lỗi (khi success=false)" },
    ],
    sampleResponse: { success: true, osrm: "ok", service: "osrm-motor" },
  },
  {
    id: "geocode-status",
    method: "GET",
    path: "/api/geocode-status",
    title: "Nominatim status",
    description: "Kiểm tra Nominatim sẵn sàng phục vụ geocode.",
    category: "system",
    responseWrap: "root",
    response: [
      { name: "success", type: "boolean", description: "true khi Nominatim OK" },
      { name: "nominatim", type: "ok | down", description: "Trạng thái geocoder" },
      { name: "service", type: "string", description: "Nhãn nội bộ (nominatim)" },
      { name: "message", type: "string", description: "Chi tiết (khi lỗi)" },
    ],
    sampleResponse: { success: true, nominatim: "ok", service: "nominatim" },
  },
  {
    id: "client-ip",
    method: "GET",
    path: "/api/client-ip",
    title: "Client IP",
    description: "IP thực của client (Cloudflare / X-Forwarded-For) — security audit.",
    category: "system",
    response: [
      ...ENVELOPE_OK,
      { name: "data.ip", type: "string", description: "IP client (CF-Connecting-IP hoặc XFF đầu tiên)" },
      { name: "data.userAgent", type: "string", description: "User-Agent header" },
      { name: "data.timestamp", type: "ISO8601", description: "Thời điểm ghi nhận (UTC)" },
      { name: "data.forwardedFor", type: "string | null", description: "Raw X-Forwarded-For nếu có" },
    ],
    sampleResponse: {
      success: true,
      data: {
        ip: "171.249.155.228",
        userAgent: "Mozilla/5.0 …",
        timestamp: "2026-06-11T12:00:00.000Z",
        forwardedFor: "171.249.155.228",
      },
    },
  },
  {
    id: "geocode",
    method: "GET",
    path: "/api/geocode",
    title: "Address search",
    description: "Tìm địa chỉ theo từ khóa. Truyền lat/lng để bias kết quả gần vùng map.",
    category: "geocode",
    query: "?q=Trần Não&lat=10.78&lng=106.69&limit=6",
    tryQuery: { q: "Trần Não", lat: "10.78", lng: "106.69", limit: "6" },
    params: [
      { name: "q", in: "query", type: "string", required: true, description: "Từ khóa địa chỉ" },
      { name: "lat", in: "query", type: "number", description: "Bias latitude" },
      { name: "lng", in: "query", type: "number", description: "Bias longitude" },
      { name: "limit", in: "query", type: "number", description: "Số kết quả (mặc định 5)" },
    ],
    response: [
      ...ENVELOPE_OK,
      { name: "data.results", type: "GeocodeResult[]", description: "Danh sách địa chỉ khớp" },
      { name: "data.results[].displayName", type: "string", description: "Tên đầy đủ (tiếng Việt)" },
      { name: "data.results[].lat", type: "number", description: "WGS84 latitude" },
      { name: "data.results[].lng", type: "number", description: "WGS84 longitude" },
      { name: "data.results[].distanceKm", type: "number | null", description: "Khoảng cách tới điểm bias (km)" },
    ],
    sampleResponse: {
      success: true,
      data: {
        results: [
          {
            displayName: "Trần Não, Phường An Khánh, TP. Thủ Đức, HCM, Việt Nam",
            lat: 10.80028,
            lng: 106.72925,
            distanceKm: 2.4,
          },
        ],
      },
    },
    errors: [{ status: 429, description: "Rate limit Nominatim — đợi Retry-After" }],
  },
  {
    id: "reverse-geocode",
    method: "GET",
    path: "/api/reverse-geocode",
    title: "Reverse geocode",
    description: "Chuyển tọa độ WGS84 thành địa chỉ.",
    category: "geocode",
    query: "?lat=10.762622&lng=106.660172",
    tryQuery: { lat: "10.762622", lng: "106.660172" },
    params: [
      { name: "lat", in: "query", type: "number", required: true, description: "Latitude" },
      { name: "lng", in: "query", type: "number", required: true, description: "Longitude" },
    ],
    response: [
      ...ENVELOPE_OK,
      { name: "data.displayName", type: "string", description: "Địa chỉ gần tọa độ nhất" },
      { name: "data.lat", type: "number", description: "Latitude snapped" },
      { name: "data.lng", type: "number", description: "Longitude snapped" },
    ],
    sampleResponse: {
      success: true,
      data: { displayName: "…", lat: 10.762622, lng: 106.660172 },
    },
  },
  {
    id: "route",
    method: "POST",
    path: "/api/route",
    title: "Route A → B",
    description:
      "Tính tuyến giữa hai điểm. Profile driving (ô tô) hoặc motorbike (xe máy). Bật alternatives để nhận nhiều tuyến.",
    category: "routing",
    params: [
      { name: "from", in: "body", type: "{ lat, lng }", required: true, description: "Điểm đi" },
      { name: "to", in: "body", type: "{ lat, lng }", required: true, description: "Điểm đến" },
      {
        name: "profile",
        in: "body",
        type: "driving | motorbike",
        description: "Phương tiện (mặc định driving)",
      },
      {
        name: "alternatives",
        in: "body",
        type: "boolean",
        description: "Trả tuyến thay thế",
      },
    ],
    response: [
      ...ENVELOPE_OK,
      { name: "data.profile", type: "driving | motorbike", description: "Profile đã dùng" },
      { name: "data.distance", type: "number", description: "Met mét — tuyến chính (recommended)" },
      { name: "data.duration", type: "number | null", description: "Giây — có nhân traffic factor" },
      { name: "data.durationOsrm", type: "number | null", description: "Giây — raw OSRM" },
      { name: "data.durationMeta.available", type: "boolean", description: "Có duration hợp lệ" },
      { name: "data.durationMeta.profile", type: "string", description: "Profile routing" },
      { name: "data.durationMeta.trafficFactor", type: "number", description: "Hệ số thời gian theo phương tiện" },
      { name: "data.geometry", type: "GeoJSON LineString", description: "Polyline tuyến chính" },
      { name: "data.summary", type: "string", description: "Tên đường chính (tuyến 0)" },
      { name: "data.routes", type: "RouteOption[]", description: "Mọi tuyến (kể cả alternatives)" },
      { name: "data.routes[].index", type: "number", description: "Thứ tự tuyến" },
      { name: "data.routes[].recommended", type: "boolean", description: "true = tuyến ngắn/nhanh nhất" },
      { name: "data.routes[].distance", type: "number", description: "Met mét" },
      { name: "data.routes[].duration", type: "number | null", description: "Giây (adjusted)" },
      { name: "data.routes[].geometry", type: "LineString | null", description: "GeoJSON geometry" },
      { name: "data.routes[].summary", type: "string", description: "Mô tả ngắn" },
    ],
    sample: {
      from: { lat: 10.7635, lng: 106.644 },
      to: { lat: 10.795112, lng: 106.731227 },
      profile: "driving",
      alternatives: true,
    },
    sampleResponse: {
      success: true,
      data: {
        profile: "driving",
        routes: [{ index: 0, recommended: true, distance: 13000, duration: 1620, summary: "…" }],
        distance: 13000,
        duration: 1620,
      },
    },
    errors: [{ status: 502, description: "OSRM unreachable hoặc lỗi graph" }],
  },
  {
    id: "table",
    method: "POST",
    path: "/api/table",
    title: "Distance matrix",
    description: "Ma trận khoảng cách / thời gian giữa nhiều sources và destinations.",
    category: "routing",
    params: [
      { name: "sources", in: "body", type: "Point[]", required: true, description: "Điểm nguồn" },
      { name: "destinations", in: "body", type: "Point[]", required: true, description: "Điểm đích" },
    ],
    response: [
      ...ENVELOPE_OK,
      { name: "data.distances", type: "number[][]", description: "Ma trận mét [source][dest]" },
      { name: "data.durations", type: "number[][]", description: "Ma trận giây [source][dest]" },
      { name: "data.sources", type: "Waypoint[]", description: "Điểm snap nguồn" },
      { name: "data.destinations", type: "Waypoint[]", description: "Điểm snap đích" },
    ],
    sample: {
      sources: [{ lat: 10.762622, lng: 106.660172 }],
      destinations: [
        { lat: 10.776889, lng: 106.700806 },
        { lat: 10.823099, lng: 106.629664 },
      ],
    },
    sampleResponse: {
      success: true,
      data: {
        distances: [[5234.5, 8100.2]],
        durations: [[612.3, 900.1]],
        sources: [{ name: "Nguyen Hue", distance: 0, location: [106.660172, 10.762622] }],
        destinations: [{ name: "Le Loi", distance: 0, location: [106.700806, 10.776889] }],
      },
    },
  },
  {
    id: "nearest",
    method: "POST",
    path: "/api/nearest",
    title: "Nearest road",
    description: "Snap tọa độ lên đoạn đường gần nhất trên graph OSRM.",
    category: "routing",
    params: [
      { name: "lat", in: "body", type: "number", required: true, description: "Latitude" },
      { name: "lng", in: "body", type: "number", required: true, description: "Longitude" },
    ],
    response: [
      ...ENVELOPE_OK,
      { name: "data.waypoint", type: "Waypoint", description: "Điểm snap trên graph" },
      { name: "data.waypoint.name", type: "string", description: "Tên đoạn đường" },
      { name: "data.waypoint.location", type: "[lng, lat]", description: "Tọa độ OSRM" },
      { name: "data.waypoint.distance", type: "number", description: "Met mét tới input" },
      { name: "data.nodes", type: "number[]", description: "OSRM node IDs" },
    ],
    sample: { lat: 10.77, lng: 106.68 },
    sampleResponse: {
      success: true,
      data: {
        waypoint: { name: "Nguyen Hue", distance: 12.3, location: [106.68, 10.77] },
        nodes: [12345],
      },
    },
  },
  {
    id: "match",
    method: "POST",
    path: "/api/match",
    title: "Map matching",
    description: "Khớp trace GPS với mạng đường (chuỗi điểm → route).",
    category: "routing",
    params: [
      { name: "points", in: "body", type: "Point[]", required: true, description: "≥ 2 điểm GPS" },
    ],
    response: [
      ...ENVELOPE_OK,
      { name: "data.matchings", type: "Matching[]", description: "Các đoạn route khớp trace" },
      { name: "data.matchings[].confidence", type: "number", description: "0–1 độ tin cậy" },
      { name: "data.matchings[].distance", type: "number", description: "Met mét" },
      { name: "data.matchings[].duration", type: "number", description: "Giây" },
      { name: "data.matchings[].geometry", type: "LineString", description: "GeoJSON matched path" },
      { name: "data.tracepoints", type: "(Waypoint|null)[]", description: "Snap từng input point" },
    ],
    sample: {
      points: [
        { lat: 10.762622, lng: 106.660172 },
        { lat: 10.77, lng: 106.68 },
        { lat: 10.776889, lng: 106.700806 },
      ],
    },
    sampleResponse: {
      success: true,
      data: {
        matchings: [{ confidence: 0.95, distance: 5000, duration: 580, geometry: { type: "LineString", coordinates: [] } }],
        tracepoints: [{ name: "A", distance: 0, location: [106.66, 10.76] }, null, { name: "B", distance: 0, location: [106.7, 10.77] }],
      },
    },
  },
];

export function queryRecordToString(q: Record<string, string>): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if (v.trim() !== "") params.set(k, v.trim());
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function buildFullUrl(path: string, queryString = "", origin?: string): string {
  const base =
    origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  const q = queryString.startsWith("?") || queryString === "" ? queryString : `?${queryString}`;
  return `${base}${path}${q}`;
}

export function buildCurl(opts: {
  method: "GET" | "POST";
  path: string;
  queryString?: string;
  bodyJson?: string;
  origin?: string;
}): string {
  const url = buildFullUrl(opts.path, opts.queryString ?? "", opts.origin);
  if (opts.method === "GET") {
    return `curl -sS "${url}"`;
  }
  const body = opts.bodyJson?.trim() || "{}";
  const escaped = body.replace(/'/g, "'\\''");
  return `curl -sS -X POST "${buildFullUrl(opts.path, "", opts.origin)}" \\\n  -H "Content-Type: application/json" \\\n  -d '${escaped}'`;
}

export function buildFetch(opts: {
  method: "GET" | "POST";
  path: string;
  queryString?: string;
  bodyJson?: string;
  origin?: string;
}): string {
  const url = buildFullUrl(opts.path, opts.queryString ?? "", opts.origin);
  if (opts.method === "GET") {
    return `const res = await fetch("${url}");\nconst data = await res.json();\nconsole.log(res.status, data);`;
  }
  const body = opts.bodyJson?.trim() || "{}";
  let prettyBody = body;
  try {
    prettyBody = JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    /* keep raw */
  }
  return `const res = await fetch("${buildFullUrl(opts.path, "", opts.origin)}", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${prettyBody}),\n});\nconst data = await res.json();\nconsole.log(res.status, data);`;
}

export async function executeApiTry(opts: {
  method: "GET" | "POST";
  path: string;
  queryString?: string;
  bodyJson?: string;
  origin?: string;
}): Promise<{ status: number; ms: number; body: unknown; raw: string; ok: boolean }> {
  const url = buildFullUrl(opts.path, opts.queryString ?? "", opts.origin);
  const started = performance.now();
  const init: RequestInit = { method: opts.method };
  if (opts.method === "POST") {
    init.headers = { "Content-Type": "application/json" };
    init.body = opts.bodyJson?.trim() || "{}";
  }
  const res = await fetch(url, init);
  const raw = await res.text();
  const ms = Math.round(performance.now() - started);
  let body: unknown = raw;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }
  return { status: res.status, ms, body, raw, ok: res.ok };
}

export function defaultBodyJson(ep: ApiDocEndpoint): string {
  return ep.sample != null ? JSON.stringify(ep.sample, null, 2) : "{\n  \n}";
}

export function defaultQueryString(ep: ApiDocEndpoint): string {
  if (ep.tryQuery) return queryRecordToString(ep.tryQuery);
  return ep.query ?? "";
}
