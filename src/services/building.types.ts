export type BuildingFeature = {
  type: "Feature";
  properties: { id: number; building?: string };
  geometry: { type: "Polygon"; coordinates: [number, number][][] };
};

export type GeoJsonFeatureCollection = {
  type: "FeatureCollection";
  features: BuildingFeature[];
};

export type BuildingManifest = {
  version: 1;
  cellDeg: number;
  sourcePbf: string;
  sourceMtimeMs: number;
  featureCount: number;
  tileCount: number;
  builtAt: string;
};
