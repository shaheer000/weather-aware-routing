import type { Place, TripRequest } from "./types";

// The trip lives in the results URL so it survives reloads and can be shared.
export function toSearchParams(request: TripRequest): URLSearchParams {
  return new URLSearchParams({
    from: request.origin.name,
    fromLat: String(request.origin.lat),
    fromLon: String(request.origin.lon),
    to: request.destination.name,
    toLat: String(request.destination.lat),
    toLon: String(request.destination.lon),
    depart: request.departure_time,
    load: String(request.load_lb),
    every: String(request.checkpoint_interval_miles),
  });
}

export function fromSearchParams(params: URLSearchParams): TripRequest | null {
  const origin = readPlace(params, "from");
  const destination = readPlace(params, "to");
  const departure = params.get("depart");
  const load = Number(params.get("load"));
  const every = Number(params.get("every"));
  if (!origin || !destination || !departure || !load || !every) {
    return null;
  }
  return {
    origin,
    destination,
    departure_time: departure,
    load_lb: load,
    checkpoint_interval_miles: every,
  };
}

function readPlace(params: URLSearchParams, prefix: string): Place | null {
  const name = params.get(prefix);
  const lat = Number(params.get(`${prefix}Lat`));
  const lon = Number(params.get(`${prefix}Lon`));
  if (!name || Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  return { name, lat, lon };
}
