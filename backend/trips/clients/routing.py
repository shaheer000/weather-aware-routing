import itertools
import logging
from dataclasses import dataclass

from django.conf import settings
from django.core.cache import cache

from trips.clients.http import ProviderError, get_json
from trips.geo import METERS_PER_MILE, Coordinate, offset_midpoint

logger = logging.getLogger(__name__)

ROUTE_COUNT = 3
# Sideways via-points used when OSRM offers fewer than three alternatives.
DETOUR_OFFSETS = (0.15, -0.15, 0.3, -0.3)
MIN_DISTANCE_DIFFERENCE = 0.01
CACHE_SECONDS = 60 * 60


@dataclass(frozen=True)
class Route:
    coordinates: list[Coordinate]
    cumulative_miles: list[float]
    cumulative_seconds: list[float]

    @property
    def distance_miles(self):
        return self.cumulative_miles[-1]

    @property
    def duration_seconds(self):
        return self.cumulative_seconds[-1]


def fetch_routes(origin, destination):
    """Return up to three distinct driving routes, fastest first."""
    cache_key = (
        f"routes:{origin.lat:.4f}:{origin.lon:.4f}"
        f":{destination.lat:.4f}:{destination.lon:.4f}"
    )
    routes = cache.get(cache_key)
    if routes is None:
        routes = _find_routes(origin, destination)
        cache.set(cache_key, routes, CACHE_SECONDS)
    return routes


def _find_routes(origin, destination):
    routes = _request_routes([origin, destination], alternatives=True)
    # The public OSRM server allows ~1 request/s, so detours run in sequence.
    for offset in DETOUR_OFFSETS:
        if len(routes) >= ROUTE_COUNT:
            break
        detour = _request_detour(origin, destination, offset)
        if detour and _is_distinct(detour, routes):
            routes.append(detour)
    logger.info("Found %d routes", len(routes))
    routes.sort(key=lambda route: route.duration_seconds)
    return routes[:ROUTE_COUNT]


def _request_detour(origin, destination, offset):
    via = offset_midpoint(origin, destination, offset)
    try:
        return _request_routes([origin, via, destination])[0]
    except ProviderError:
        logger.warning("Detour with offset %s failed", offset)
        return None


def _request_routes(waypoints, alternatives=False):
    path = ";".join(f"{point.lon},{point.lat}" for point in waypoints)
    url = f"{settings.OSRM_BASE_URL}/route/v1/driving/{path}"
    params = {
        "alternatives": ROUTE_COUNT if alternatives else "false",
        "overview": "full",
        "geometries": "geojson",
        "annotations": "distance,duration",
    }
    data = get_json(url, params)
    if data.get("code") != "Ok" or not data.get("routes"):
        raise ProviderError("No route found between these locations")
    return [_parse_route(raw_route) for raw_route in data["routes"]]


def _parse_route(raw_route):
    annotations = [leg["annotation"] for leg in raw_route["legs"]]
    meters = itertools.chain.from_iterable(a["distance"] for a in annotations)
    seconds = itertools.chain.from_iterable(a["duration"] for a in annotations)
    coordinates = [
        Coordinate(lat=lat, lon=lon)
        for lon, lat in raw_route["geometry"]["coordinates"]
    ]
    miles = (segment / METERS_PER_MILE for segment in meters)
    return Route(
        coordinates=coordinates,
        cumulative_miles=list(itertools.accumulate(miles, initial=0.0)),
        cumulative_seconds=list(itertools.accumulate(seconds, initial=0.0)),
    )


def _is_distinct(candidate, routes):
    return all(
        abs(candidate.distance_miles - route.distance_miles)
        > route.distance_miles * MIN_DISTANCE_DIFFERENCE
        for route in routes
    )
