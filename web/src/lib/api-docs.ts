export type ApiDocCategory = "system" | "geocode" | "routing";

export type ApiDocParam = {
  name: string;
  in: "query" | "body";
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
  sample?: unknown;
  sampleResponse?: unknown;
  errors?: { status: number; description: string }[];
  /** Default query values for Try it panel (GET) */
  tryQuery?: Record<string, string>;
};

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
    sampleResponse: { success: true, service: "routing-api", status: "ok" },
  },
  {
    id: "info",
    method: "GET",
    path: "/api/info",
    title: "Service info",
    description: "Metadata dịch vụ — tên và phiên bản API.",
    category: "system",
    sampleResponse: { success: true, service: "Routing API", version: "1.0.0" },
  },
  {
    id: "osrm-status",
    method: "GET",
    path: "/api/osrm-status",
    title: "OSRM status (car)",
    description: "Probe riêng OSRM profile driving.",
    category: "system",
    sampleResponse: { success: true, osrm: "ok", service: "osrm-car" },
  },
  {
    id: "osrm-motor-status",
    method: "GET",
    path: "/api/osrm-motor-status",
    title: "OSRM status (motorbike)",
    description: "Probe riêng OSRM profile xe máy.",
    category: "system",
    sampleResponse: { success: true, osrm: "ok", service: "osrm-motor" },
  },
  {
    id: "geocode-status",
    method: "GET",
    path: "/api/geocode-status",
    title: "Nominatim status",
    description: "Kiểm tra Nominatim sẵn sàng phục vụ geocode.",
    category: "system",
    sampleResponse: { success: true, nominatim: "ok", service: "nominatim" },
  },
  {
    id: "client-ip",
    method: "GET",
    path: "/api/client-ip",
    title: "Client IP",
    description: "IP thực của client (Cloudflare / X-Forwarded-For) — security audit.",
    category: "system",
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
    sample: {
      sources: [{ lat: 10.762622, lng: 106.660172 }],
      destinations: [
        { lat: 10.776889, lng: 106.700806 },
        { lat: 10.823099, lng: 106.629664 },
      ],
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
    sample: { lat: 10.77, lng: 106.68 },
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
    sample: {
      points: [
        { lat: 10.762622, lng: 106.660172 },
        { lat: 10.77, lng: 106.68 },
        { lat: 10.776889, lng: 106.700806 },
      ],
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
