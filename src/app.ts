import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { config } from "./config/env";
import { errorHandler } from "./middlewares/error-handler";
import { logger } from "./middlewares/logger";
import { routingRoutes } from "./routes/routing.routes";
import { geocodeRoutes } from "./routes/geocode.routes";
import { systemRoutes } from "./routes/system.routes";

export function createApp() {
  return new Elysia()
    .use(cors())
    .use(logger)
    .use(systemRoutes)
    .use(geocodeRoutes)
    .get("/health", () => ({
      success: true,
      service: config.serviceName,
      status: "ok",
    }))
    .use(routingRoutes)
    .use(errorHandler);
}
