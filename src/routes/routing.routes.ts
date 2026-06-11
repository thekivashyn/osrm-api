import { Elysia } from "elysia";
import { routeController } from "../controllers/routing.controller";
import { AppError, errorResponse } from "../utils/response";
import type {
  MatchRequest,
  NearestRequest,
  RouteRequest,
  TableRequest,
  TripRequest,
} from "../types";

function isAppError(error: unknown): error is AppError {
  return error instanceof AppError || (error instanceof Error && error.name === "AppError");
}

async function run<T>(set: { status?: number | string }, handler: () => Promise<T>) {
  try {
    return await handler();
  } catch (error) {
    if (isAppError(error)) {
      set.status = error.statusCode;
      return errorResponse(error.message);
    }
    throw error;
  }
}

export const routingRoutes = new Elysia({ prefix: "/api" })
  .post("/route", ({ body, set }) =>
    run(set, () => routeController.route(body as RouteRequest)),
  )
  .post("/table", ({ body, set }) =>
    run(set, () => routeController.table(body as TableRequest)),
  )
  .post("/nearest", ({ body, set }) =>
    run(set, () => routeController.nearest(body as NearestRequest)),
  )
  .post("/match", ({ body, set }) =>
    run(set, () => routeController.match(body as MatchRequest)),
  )
  .post("/trip", ({ body, set }) =>
    run(set, () => routeController.trip(body as TripRequest)),
  );
