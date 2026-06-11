import { createApp } from "./src/app";
import { config } from "./src/config/env";

const app = createApp().listen({ port: config.port, hostname: config.host });

console.log(
  `Routing API running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(`Geocoding: ${config.nominatimUrl}`);

export type App = typeof app;
