import maplibregl from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { formatDuration, routeLetter } from "../format";
import {
  BASEMAP_STYLE,
  addTripLayers,
  highlightCheckpoint,
  highlightRoute,
  routeBounds,
  showForecastHour,
  showPlan,
} from "../mapLayers";
import { riskColor } from "../risk";
import { pointAtMile } from "../trip";
import type { RouteOption, TripPlan } from "../types";
import { iconSvg } from "./Icon";

interface TripMapProps {
  plan: TripPlan | null;
  selectedRouteId: number;
  selectedCheckpointIndex: number;
  forecastHour: number;
  truckPosition: [number, number] | null;
  onSelectRoute: (routeId: number) => void;
  onSelectCheckpoint: (routeId: number, index: number) => void;
}

const US_CENTER: [number, number] = [-96, 38.5];
const LABEL_POSITIONS = [0.5, 0.35, 0.65];
const FIT_PADDING = 56;

export function TripMap({
  plan,
  selectedRouteId,
  selectedCheckpointIndex,
  forecastHour,
  truckPosition,
  onSelectRoute,
  onSelectCheckpoint,
}: TripMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const truckRef = useRef<maplibregl.Marker | null>(null);
  const labelsRef = useRef<HTMLElement[]>([]);
  const handlersRef = useRef({ onSelectRoute, onSelectCheckpoint });
  const [isMapReady, setIsMapReady] = useState(false);
  handlersRef.current = { onSelectRoute, onSelectCheckpoint };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: BASEMAP_STYLE,
      center: US_CENTER,
      zoom: 3.6,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      addTripLayers(map);
      bindInteractions(map, handlersRef);
      setIsMapReady(true);
    });
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !plan) return;
    showPlan(map, plan);
    map.fitBounds(routeBounds(plan), { padding: FIT_PADDING, duration: 600 });
    labelsRef.current = plan.routes.map((route) =>
      routeLabel(route, () => handlersRef.current.onSelectRoute(route.id)),
    );
    const markers = [
      endpointMarker("pin", [plan.origin.lon, plan.origin.lat]),
      endpointMarker("flag", [plan.destination.lon, plan.destination.lat]),
      ...plan.routes.map((route) =>
        new maplibregl.Marker({ element: labelsRef.current[route.id] })
          .setLngLat(pointAtMile(route, route.distance_miles * LABEL_POSITIONS[route.id])),
      ),
    ];
    markers.forEach((marker) => marker.addTo(map));
    return () => markers.forEach((marker) => marker.remove());
  }, [isMapReady, plan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !plan) return;
    highlightRoute(map, selectedRouteId);
    labelsRef.current.forEach((label, routeId) =>
      label.classList.toggle("is-selected", routeId === selectedRouteId),
    );
  }, [isMapReady, plan, selectedRouteId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !plan) return;
    highlightCheckpoint(map, selectedRouteId, selectedCheckpointIndex);
  }, [isMapReady, plan, selectedRouteId, selectedCheckpointIndex]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !plan) return;
    showForecastHour(map, forecastHour);
  }, [isMapReady, plan, forecastHour]);

  useEffect(() => {
    const map = mapRef.current;
    if (!isMapReady || !map || !truckPosition) return;
    if (!truckRef.current) {
      const element = document.createElement("div");
      element.className = "truck-marker";
      element.innerHTML = iconSvg("truck", 16);
      truckRef.current = new maplibregl.Marker({ element }).setLngLat(truckPosition).addTo(map);
    }
    truckRef.current.setLngLat(truckPosition);
  }, [isMapReady, truckPosition]);

  return <div ref={containerRef} className="map" />;
}

function bindInteractions(
  map: maplibregl.Map,
  handlersRef: { current: Pick<TripMapProps, "onSelectRoute" | "onSelectCheckpoint"> },
) {
  for (const layer of ["routes-alternate", "checkpoints"]) {
    map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
  }
  map.on("click", "routes-alternate", (event) => {
    handlersRef.current.onSelectRoute(event.features![0].properties.routeId);
  });
  map.on("click", "checkpoints", (event) => {
    const { routeId, index } = event.features![0].properties;
    handlersRef.current.onSelectCheckpoint(routeId, index);
  });
}

function routeLabel(route: RouteOption, onClick: () => void): HTMLElement {
  const label = document.createElement("button");
  label.className = "route-label";
  label.innerHTML = `
    <span class="risk-dot" style="background:${riskColor(route.risk.worst_level)}"></span>
    <strong>${routeLetter(route.id)}</strong>
    <span>${formatDuration(route.duration_seconds)}</span>`;
  label.addEventListener("click", (event) => {
    event.stopPropagation();
    onClick();
  });
  return label;
}

function endpointMarker(
  icon: "pin" | "flag",
  position: [number, number],
): maplibregl.Marker {
  const element = document.createElement("div");
  element.className = "endpoint-marker";
  element.innerHTML = iconSvg(icon, 14);
  return new maplibregl.Marker({ element }).setLngLat(position);
}
