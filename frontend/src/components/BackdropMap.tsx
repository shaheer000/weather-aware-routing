import maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";

import { BASEMAP_STYLE } from "../mapLayers";

/** Static, non-interactive map that sits behind the plan form. */
export function BackdropMap() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current!,
      style: BASEMAP_STYLE,
      center: [-96, 39],
      zoom: 3.8,
      interactive: false,
      attributionControl: false,
    });
    return () => map.remove();
  }, []);

  return <div ref={containerRef} className="backdrop-map" aria-hidden="true" />;
}
