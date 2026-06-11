import { Elysia } from "elysia";
import { recordRequestLog } from "../services/request-log.service";

const loggedRequestIds = new Set<string>();

function writeLog(
  request: Request,
  set: { status?: number | string; headers?: unknown },
  requestStart: number,
  requestId: string,
) {
  if (loggedRequestIds.has(requestId)) return;
  loggedRequestIds.add(requestId);
  if (loggedRequestIds.size > 10_000) loggedRequestIds.clear();

  const durationMs = performance.now() - requestStart;
  const status = typeof set.status === "number" ? set.status : 200;
  recordRequestLog({
    id: requestId,
    request,
    status,
    durationMs,
    responseContentType: null,
  });
  console.log(
    `[${new Date().toISOString()}] ${request.method} ${request.url} ${status} ${durationMs.toFixed(2)}ms`,
  );
}

export const logger = new Elysia({ name: "logger" })
  .derive({ as: "global" }, () => ({
    requestStart: performance.now(),
    requestId: crypto.randomUUID(),
  }))
  .onAfterHandle({ as: "global" }, ({ request, set, requestStart, requestId }) => {
    writeLog(request, set, requestStart, requestId);
  })
  .onError({ as: "global" }, ({ request, set, requestStart, requestId }) => {
    // onError can fire before derive — guard missing context.
    writeLog(request, set, requestStart ?? performance.now(), requestId ?? crypto.randomUUID());
  });
