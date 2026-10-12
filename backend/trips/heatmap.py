import math
from dataclasses import dataclass

from trips.checkpoints import locate, mile_markers
from trips.geo import Coordinate, haversine_miles

GRID_STEPS = 24
MILES_PER_DEGREE_LAT = 69.0
MIN_CELL_DEGREES = 0.1
MIN_CORRIDOR_RADIUS_MI = 30.0
CORRIDOR_RADIUS_IN_CELLS = 1.5


@dataclass(frozen=True)
class CorridorGrid:
    points: list[Coordinate]
    cell_miles: float


def build_corridor_grid(routes):
    """Evenly spaced points covering a band around every route."""
    lats = [point.lat for route in routes for point in route.coordinates]
    lons = [point.lon for route in routes for point in route.coordinates]
    lon_scale = math.cos(math.radians((min(lats) + max(lats)) / 2))
    cell_lat = max(
        (max(lats) - min(lats)) / GRID_STEPS,
        (max(lons) - min(lons)) * lon_scale / GRID_STEPS,
        MIN_CELL_DEGREES,
    )
    cell_lon = cell_lat / lon_scale
    cell_miles = cell_lat * MILES_PER_DEGREE_LAT
    radius_miles = max(
        MIN_CORRIDOR_RADIUS_MI, cell_miles * CORRIDOR_RADIUS_IN_CELLS
    )
    padding = math.ceil(radius_miles / cell_miles)
    route_samples = _sample_routes(routes, cell_miles / 2)
    candidates = (
        Coordinate(
            lat=min(lats) + row * cell_lat, lon=min(lons) + column * cell_lon
        )
        for row in range(-padding, _steps(lats, cell_lat) + padding + 1)
        for column in range(-padding, _steps(lons, cell_lon) + padding + 1)
    )
    points = [
        point
        for point in candidates
        if _is_near_any(point, route_samples, radius_miles)
    ]
    return CorridorGrid(points=points, cell_miles=cell_miles)


def _steps(values, cell_size):
    return math.ceil((max(values) - min(values)) / cell_size)


def _sample_routes(routes, spacing_miles):
    return [
        locate(route, mile)[0]
        for route in routes
        for mile in mile_markers(route.distance_miles, spacing_miles)
    ]


def _is_near_any(point, samples, radius_miles):
    return any(
        haversine_miles(point, sample) <= radius_miles for sample in samples
    )
