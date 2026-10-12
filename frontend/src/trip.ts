import type { Checkpoint, RouteOption } from "./types";

const HOUR_MS = 3_600_000;
const EARTH_RADIUS_MI = 3958.8;

export function hoursBetween(startIso: string, endIso: string): number {
  return (Date.parse(endIso) - Date.parse(startIso)) / HOUR_MS;
}

export function addHours(iso: string, hours: number): string {
  return new Date(Date.parse(iso) + hours * HOUR_MS).toISOString();
}

// Same rounding the backend uses to pick a checkpoint's forecast hour.
export function forecastHourOf(checkpoint: Checkpoint, startIso: string) {
  return Math.max(0, Math.round(hoursBetween(startIso, checkpoint.eta)));
}

/** Index of the last checkpoint the truck has passed at a given time. */
export function checkpointIndexAt(route: RouteOption, iso: string): number {
  const time = Date.parse(iso);
  const index = route.checkpoints.findIndex((cp) => Date.parse(cp.eta) > time);
  return index === -1 ? route.checkpoints.length - 1 : Math.max(0, index - 1);
}

/** Truck position on the road at a given time, from checkpoint ETAs. */
export function positionAt(route: RouteOption, iso: string): [number, number] {
  const { checkpoints } = route;
  const time = Date.parse(iso);
  const index = checkpointIndexAt(route, iso);
  const current = checkpoints[index];
  const next = checkpoints[index + 1];
  let mile = current.mile;
  if (next && time > Date.parse(current.eta)) {
    const span = Date.parse(next.eta) - Date.parse(current.eta);
    const fraction = (time - Date.parse(current.eta)) / span;
    mile += (next.mile - current.mile) * fraction;
  }
  return pointAtMile(route, mile);
}

export function pointAtMile(
  route: RouteOption,
  mile: number,
): [number, number] {
  const { geometry } = route;
  const lengths = [0];
  for (let index = 1; index < geometry.length; index += 1) {
    lengths.push(lengths[index - 1] + distanceMiles(geometry[index - 1], geometry[index]));
  }
  const target = (mile / route.distance_miles) * lengths[lengths.length - 1];
  const index = lengths.findIndex((length) => length >= target);
  if (index <= 0) {
    return index === 0 ? geometry[0] : geometry[geometry.length - 1];
  }
  const fraction =
    (target - lengths[index - 1]) / (lengths[index] - lengths[index - 1] || 1);
  const [lon1, lat1] = geometry[index - 1];
  const [lon2, lat2] = geometry[index];
  return [lon1 + (lon2 - lon1) * fraction, lat1 + (lat2 - lat1) * fraction];
}

function distanceMiles(
  [lon1, lat1]: [number, number],
  [lon2, lat2]: [number, number],
): number {
  const toRadians = Math.PI / 180;
  const deltaLat = (lat2 - lat1) * toRadians;
  const deltaLon = (lon2 - lon1) * toRadians;
  const chord =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1 * toRadians) *
      Math.cos(lat2 * toRadians) *
      Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.sqrt(chord));
}
