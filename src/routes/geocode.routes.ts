import { Elysia, t } from "elysia";
import { checkNominatimStatus, reverseGeocode, searchAddress } from "../services/geocode.service";
import { AppError, errorResponse } from "../utils/response";
import { sanitizeProbeMessage } from "../utils/public-probe";

export const geocodeRoutes = new Elysia({ prefix: "/api" })
  .get(
    "/geocode",
    async ({ query, set }) => {
      try {
        const limit = query.limit ? Number(query.limit) : 5;
        const lat = query.lat !== undefined ? Number(query.lat) : undefined;
        const lng = query.lng !== undefined ? Number(query.lng) : undefined;
        const results = await searchAddress(query.q, limit, { lat, lng });
        return { success: true, data: { results } };
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
        q: t.String(),
        limit: t.Optional(t.String()),
        lat: t.Optional(t.String()),
        lng: t.Optional(t.String()),
      }),
    },
  )
  .get(
    "/reverse-geocode",
    async ({ query, set }) => {
      try {
        const lat = Number(query.lat);
        const lng = Number(query.lng);
        const result = await reverseGeocode(lat, lng);
        return { success: true, data: result };
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
        lat: t.String(),
        lng: t.String(),
      }),
    },
  )
  .get("/geocode-status", async () => {
    const status = await checkNominatimStatus();
    return {
      success: status.ok,
      nominatim: status.ok ? "ok" : "down",
      service: "nominatim",
      message: sanitizeProbeMessage(status.message),
    };
  });
