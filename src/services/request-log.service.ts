import { getClientIp } from "../utils/client-ip";

export type RequestLogEntry = {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  query: string | null;
  status: number;
  durationMs: number;
  clientIp: string;
  userAgent: string;
  forwardedFor: string | null;
  referer: string | null;
  host: string | null;
  protocol: string | null;
  requestContentLength: number | null;
  responseContentType: string | null;
};

export type RequestLogQuery = {
  limit?: number;
  offset?: number;
  status?: number;
  method?: string;
  path?: string;
  ip?: string;
  since?: string;
};

const MAX_ENTRIES = Math.max(
  100,
  Number(process.env.REQUEST_LOG_MAX ?? 1000) || 1000,
);

/** Paths excluded from audit buffer (high-frequency / self-poll). */
const SKIP_LOG_PATHS = new Set(["/health", "/api/request-logs"]);

const entries: RequestLogEntry[] = [];

function parseContentLength(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function recordRequestLog(input: {
  id: string;
  request: Request;
  status: number;
  durationMs: number;
  responseContentType?: string | null;
}): RequestLogEntry | null {
  const url = new URL(input.request.url);
  if (SKIP_LOG_PATHS.has(url.pathname)) return null;
  const entry: RequestLogEntry = {
    id: input.id,
    timestamp: new Date().toISOString(),
    method: input.request.method,
    path: url.pathname,
    query: url.search ? url.search.slice(1) : null,
    status: input.status,
    durationMs: Math.round(input.durationMs * 100) / 100,
    clientIp: getClientIp(input.request),
    userAgent: input.request.headers.get("user-agent") ?? "unknown",
    forwardedFor: input.request.headers.get("x-forwarded-for"),
    referer: input.request.headers.get("referer"),
    host: input.request.headers.get("host"),
    protocol:
      input.request.headers.get("x-forwarded-proto") ??
      (url.protocol === "https:" ? "https" : "http"),
    requestContentLength: parseContentLength(input.request.headers.get("content-length")),
    responseContentType: input.responseContentType ?? null,
  };

  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  return entry;
}

export function queryRequestLogs(query: RequestLogQuery = {}) {
  const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
  const offset = Math.max(query.offset ?? 0, 0);
  const method = query.method?.toUpperCase();
  const pathNeedle = query.path?.toLowerCase();
  const ipNeedle = query.ip?.toLowerCase();
  const sinceMs = query.since ? Date.parse(query.since) : NaN;

  let filtered = entries;
  if (Number.isFinite(sinceMs)) {
    filtered = filtered.filter((e) => Date.parse(e.timestamp) >= sinceMs);
  }
  if (query.status != null) {
    filtered = filtered.filter((e) => e.status === query.status);
  }
  if (method) {
    filtered = filtered.filter((e) => e.method === method);
  }
  if (pathNeedle) {
    filtered = filtered.filter(
      (e) =>
        e.path.toLowerCase().includes(pathNeedle) ||
        (e.query?.toLowerCase().includes(pathNeedle) ?? false),
    );
  }
  if (ipNeedle) {
    filtered = filtered.filter(
      (e) =>
        e.clientIp.toLowerCase().includes(ipNeedle) ||
        (e.forwardedFor?.toLowerCase().includes(ipNeedle) ?? false),
    );
  }

  const slice = filtered.slice(offset, offset + limit);
  return {
    total: filtered.length,
    limit,
    offset,
    maxStored: MAX_ENTRIES,
    stored: entries.length,
    items: slice,
  };
}

export function getRequestLogById(id: string): RequestLogEntry | null {
  return entries.find((e) => e.id === id) ?? null;
}

/** Test helper */
export function clearRequestLogsForTest() {
  entries.length = 0;
}
