import { describe, expect, test } from "bun:test";
import { OsrmService } from "../src/services/osrm.service";

describe("OsrmService — error handling", () => {
  test("throws when OSRM unreachable", async () => {
    const service = new OsrmService("http://localhost:59999");
    await expect(
      service.route({ lat: 10.76, lng: 106.66 }, { lat: 10.77, lng: 106.70 }),
    ).rejects.toThrow(/Unable to reach OSRM/);
  });

  test("throws when OSRM returns error code", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () =>
        Response.json({ code: "NoRoute", message: "No route found" }, { status: 400 }),
    });

    const service = new OsrmService(`http://localhost:${server.port}`);
    await expect(
      service.route({ lat: 10.76, lng: 106.66 }, { lat: 10.77, lng: 106.70 }),
    ).rejects.toThrow(/No route found|OSRM request failed/);

    server.stop();
  });

  test("throws when OSRM returns invalid JSON", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response("not json", { status: 200 }),
    });

    const service = new OsrmService(`http://localhost:${server.port}`);
    await expect(
      service.nearest({ lat: 10.76, lng: 106.66 }),
    ).rejects.toThrow(/not valid JSON|Invalid response/);

    server.stop();
  });

  test("throws when route array is empty", async () => {
    const server = Bun.serve({
      port: 0,
      fetch: () => Response.json({ code: "Ok", routes: [], waypoints: [] }),
    });

    const service = new OsrmService(`http://localhost:${server.port}`);
    await expect(
      service.route({ lat: 10.76, lng: 106.66 }, { lat: 10.77, lng: 106.70 }),
    ).rejects.toThrow(/No route found|OSRM request failed/);

    server.stop();
  });
});
