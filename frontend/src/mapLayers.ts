import type {
  ExpressionSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
} from "maplibre-gl";

import { RISK_LEVELS } from "./risk";
import type { TripPlan } from "./types";

export const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

const ACCENT = "#1D4ED8";
const ALTERNATE_ROUTE = "#8C93A3";
const METERS_PER_MILE = 1609.344;
const METERS_PER_PIXEL_AT_ZOOM_0 = 156543.03;
// Overlap neighbouring cells so the blurred circles read as one field.
const HEAT_RADIUS_IN_CELLS = 1.6;

type FeatureCollection = GeoJSON.FeatureCollection;

export function addTripLayers(map: MapLibreMap): void {
  for (const id of ["heatmap", "routes", "checkpoints"]) {
    map.addSource(id, { type: "geojson", data: emptyCollection() });
  }
  map.addLayer({
    id: "heatmap",
    type: "circle",
    source: "heatmap",
    paint: { "circle-blur": 1 },
  });
  map.addLayer({
    id: "routes-alternate",
    type: "line",
    source: "routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ALTERNATE_ROUTE, "line-width": 4 },
  });
  map.addLayer({
    id: "route-selected-casing",
    type: "line",
    source: "routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": "#FFFFFF", "line-width": 9 },
  });
  map.addLayer({
    id: "route-selected",
    type: "line",
    source: "routes",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: { "line-color": ACCENT, "line-width": 5 },
  });
  map.addLayer({
    id: "checkpoint-active",
    type: "circle",
    source: "checkpoints",
    filter: ["==", ["get", "routeId"], -1],
    paint: {
      "circle-radius": 13,
      "circle-color": "#FFFFFF",
      "circle-stroke-color": ACCENT,
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: "checkpoints",
    type: "circle",
    source: "checkpoints",
    paint: {
      "circle-color": riskColorExpression(["get", "risk"]),
      "circle-stroke-color": "#FFFFFF",
      "circle-stroke-width": 1.5,
    },
  });
}

export function highlightCheckpoint(
  map: MapLibreMap,
  routeId: number,
  index: number,
): void {
  map.setFilter("checkpoint-active", [
    "all",
    ["==", ["get", "routeId"], routeId],
    ["==", ["get", "index"], index],
  ]);
}

export function showPlan(map: MapLibreMap, plan: TripPlan): void {
  setData(map, "routes", routesToGeoJson(plan));
  setData(map, "checkpoints", checkpointsToGeoJson(plan));
  setData(map, "heatmap", heatmapToGeoJson(plan));
  const latitude = (plan.origin.lat + plan.destination.lat) / 2;
  map.setPaintProperty(
    "heatmap",
    "circle-radius",
    cellRadiusExpression(plan.heatmap.cell_miles, latitude),
  );
}

export function highlightRoute(map: MapLibreMap, routeId: number): void {
  const isSelected: ExpressionSpecification = ["==", ["get", "routeId"], routeId];
  map.setFilter("routes-alternate", ["!", isSelected]);
  map.setFilter("route-selected-casing", isSelected);
  map.setFilter("route-selected", isSelected);
  map.setPaintProperty("checkpoints", "circle-radius", [
    "case", isSelected, 6, 3.5,
  ]);
  map.setPaintProperty("checkpoints", "circle-opacity", [
    "case", isSelected, 1, 0.55,
  ]);
  map.setPaintProperty("checkpoints", "circle-stroke-opacity", [
    "case", isSelected, 1, 0.55,
  ]);
  map.moveLayer("checkpoint-active");
  map.moveLayer("checkpoints");
}

// Each point carries h0..h48, so moving the slider only swaps a paint
// expression instead of re-uploading data.
export function showForecastHour(map: MapLibreMap, hour: number): void {
  const level: ExpressionSpecification = ["get", `h${hour}`];
  map.setPaintProperty("heatmap", "circle-color", riskColorExpression(level));
  map.setPaintProperty("heatmap", "circle-opacity", [
    "case", ["==", level, 0], 0.16, 0.5,
  ]);
}

export function routeBounds(plan: TripPlan): [number, number, number, number] {
  const coordinates = plan.routes.flatMap((route) => route.geometry);
  const lons = coordinates.map(([lon]) => lon);
  const lats = coordinates.map(([, lat]) => lat);
  return [
    Math.min(...lons),
    Math.min(...lats),
    Math.max(...lons),
    Math.max(...lats),
  ];
}

function routesToGeoJson(plan: TripPlan): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: plan.routes.map((route) => ({
      type: "Feature",
      properties: { routeId: route.id },
      geometry: { type: "LineString", coordinates: route.geometry },
    })),
  };
}

function checkpointsToGeoJson(plan: TripPlan): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: plan.routes.flatMap((route) =>
      route.checkpoints.map((checkpoint, index) => ({
        type: "Feature" as const,
        properties: { routeId: route.id, index, risk: checkpoint.risk_level },
        geometry: {
          type: "Point" as const,
          coordinates: [checkpoint.lon, checkpoint.lat],
        },
      })),
    ),
  };
}

function heatmapToGeoJson(plan: TripPlan): FeatureCollection {
  const { points, levels } = plan.heatmap;
  return {
    type: "FeatureCollection",
    features: points.map(([lat, lon], index) => ({
      type: "Feature",
      properties: Object.fromEntries(
        levels[index].map((level, hour) => [`h${hour}`, level]),
      ),
      geometry: { type: "Point", coordinates: [lon, lat] },
    })),
  };
}

function riskColorExpression(
  level: ExpressionSpecification,
): ExpressionSpecification {
  const stops = RISK_LEVELS.slice(1).flatMap(({ color }, index) => [
    index + 1,
    color,
  ]);
  return ["step", level, RISK_LEVELS[0].color, ...stops];
}

// Circle radius that covers one grid cell on the ground at every zoom.
function cellRadiusExpression(
  cellMiles: number,
  latitude: number,
): ExpressionSpecification {
  const radiusMeters = cellMiles * HEAT_RADIUS_IN_CELLS * METERS_PER_MILE;
  const metersPerPixel =
    METERS_PER_PIXEL_AT_ZOOM_0 * Math.cos((latitude * Math.PI) / 180);
  const radiusAtZoom0 = radiusMeters / metersPerPixel;
  return [
    "interpolate",
    ["exponential", 2],
    ["zoom"],
    0,
    radiusAtZoom0,
    20,
    radiusAtZoom0 * 2 ** 20,
  ];
}

function setData(map: MapLibreMap, sourceId: string, data: FeatureCollection) {
  (map.getSource(sourceId) as GeoJSONSource).setData(data);
}

function emptyCollection(): FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
