import { Elysia, t } from "elysia";
import { fetchBuildingFootprints } from "../services/building.service";
import { AppError, errorResponse } from "../utils/response";

export const mapRoutes = new Elysia({ prefix: "/api" }).get(
  "/map/buildings",
  async ({ query, set }) => {
    try {
      const south = Number(query.south);
      const west = Number(query.west);
      const north = Number(query.north);
      const east = Number(query.east);
      const data = await fetchBuildingFootprints(south, west, north, east);
      return { success: true, data };
    } catch (error) {
      if (error instanceof AppError) {
        set.status = error.statusCode;
        return errorResponse(error.message);
      }
      throw error;
    }
  },
  {
    query: t.Object({
      south: t.String(),
      west: t.String(),
      north: t.String(),
      east: t.String(),
    }),
  },
);
