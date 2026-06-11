import type { Server } from "bun";

const waypoint = {
  hint: "abc",
  distance: 12.5,
  name: "Nguyen Hue",
  location: [106.660172, 10.762622] as [number, number],
};

const lineString = {
  type: "LineString" as const,
  coordinates: [
    [106.660172, 10.762622],
    [106.700806, 10.776889],
  ] as [number, number][],
};

const leg = {
  distance: 5234.5,
  duration: 612.3,
  weight: 612.3,
  summary: "Nguyen Hue",
};

const altLineString = {
  type: "LineString" as const,
  coordinates: [
    [106.660172, 10.762622],
    [106.680172, 10.772622],
    [106.700806, 10.776889],
  ] as [number, number][],
};

export function createMockOsrmServer(): Server {
  return Bun.serve({
    port: 0,
    fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path.startsWith("/route/v1/")) {
        const routes = [
          {
            distance: 5234.5,
            duration: 612.3,
            weight: 612.3,
            geometry: lineString,
            legs: [leg],
          },
        ];

        if (url.searchParams.get("alternatives") === "true") {
          routes.push({
            distance: 6100.2,
            duration: 720.5,
            weight: 720.5,
            geometry: altLineString,
            legs: [{ ...leg, distance: 6100.2, duration: 720.5, summary: "Alternative" }],
          });
        }

        return Response.json({
          code: "Ok",
          routes,
          waypoints: [waypoint, waypoint],
        });
      }

      if (path.startsWith("/table/v1/driving/")) {
        return Response.json({
          code: "Ok",
          distances: [[5234.5, 8100.2]],
          durations: [[612.3, 900.1]],
          sources: [waypoint],
          destinations: [waypoint, waypoint],
        });
      }

      if (path.startsWith("/nearest/v1/driving/")) {
        return Response.json({
          code: "Ok",
          waypoints: [waypoint],
          nodes: [12345],
        });
      }

      if (path.startsWith("/match/v1/driving/")) {
        return Response.json({
          code: "Ok",
          matchings: [
            {
              distance: 5000,
              duration: 580,
              weight: 580,
              confidence: 0.95,
              geometry: lineString,
              legs: [leg],
            },
          ],
          tracepoints: [waypoint, waypoint, waypoint],
        });
      }

      if (path.startsWith("/trip/v1/driving/")) {
        return Response.json({
          code: "Ok",
          trips: [
            {
              distance: 12000,
              duration: 1500,
              weight: 1500,
              geometry: lineString,
              legs: [leg, leg],
            },
          ],
          waypoints: [waypoint, waypoint, waypoint],
        });
      }

      if (path === "/error") {
        return Response.json({ code: "NoRoute", message: "No route found" }, { status: 400 });
      }

      return Response.json({ code: "InvalidUrl", message: "Not found" }, { status: 404 });
    },
  });
}
