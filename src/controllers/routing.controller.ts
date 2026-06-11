import { osrmService } from "../services/osrm.service";
import { successResponse } from "../utils/response";
import { validateCoordinate, validateCoordinates, validateRoutingProfile } from "../utils/validation";
import type { MatchRequest, NearestRequest, RouteRequest, TableRequest } from "../types";

export const routeController = {
  async route(body: RouteRequest) {
    const from = validateCoordinate(body.from, "from");
    const to = validateCoordinate(body.to, "to");
    const profile = validateRoutingProfile(body.profile);
    const data = await osrmService.route(from, to, {
      profile,
      alternatives: body.alternatives,
    });
    return successResponse(data);
  },

  async table(body: TableRequest) {
    const sources = validateCoordinates(body.sources, "sources", 1);
    const destinations = validateCoordinates(body.destinations, "destinations", 1);
    const data = await osrmService.table(sources, destinations);
    return successResponse(data);
  },

  async nearest(body: NearestRequest) {
    const coord = validateCoordinate(body, "point");
    const data = await osrmService.nearest(coord);
    return successResponse(data);
  },

  async match(body: MatchRequest) {
    const points = validateCoordinates(body.points, "points", 2);
    const data = await osrmService.match(points);
    return successResponse(data);
  },
};
