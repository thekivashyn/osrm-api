import { Elysia } from "elysia";

export const logger = new Elysia({ name: "logger" })
  .derive({ as: "global" }, () => ({
    requestStart: performance.now(),
  }))
  .onAfterHandle(({ request, set, requestStart }) => {
    const duration = (performance.now() - requestStart).toFixed(2);
    const status = set.status ?? 200;

    console.log(
      `[${new Date().toISOString()}] ${request.method} ${request.url} ${status} ${duration}ms`,
    );
  });
