import math
from dataclasses import dataclass

EARTH_RADIUS_MI = 3958.8
METERS_PER_MILE = 1609.344


@dataclass(frozen=True)
class Coordinate:
    lat: float
    lon: float


@dataclass(frozen=True)
class Place:
    name: str
    coordinate: Coordinate


def haversine_miles(start, end):
    lat1, lat2 = math.radians(start.lat), math.radians(end.lat)
    delta_lat = lat2 - lat1
    delta_lon = math.radians(end.lon - start.lon)
    chord = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(chord))


def interpolate(start, end, fraction):
    return Coordinate(
        lat=start.lat + (end.lat - start.lat) * fraction,
        lon=start.lon + (end.lon - start.lon) * fraction,
    )


def offset_midpoint(start, end, offset_fraction):
    """Midpoint of start-end pushed sideways by a fraction of its length."""
    mid_lat = (start.lat + end.lat) / 2
    lon_scale = math.cos(math.radians(mid_lat))
    delta_lat = end.lat - start.lat
    delta_lon = (end.lon - start.lon) * lon_scale
    mid_lon = (start.lon + end.lon) / 2
    return Coordinate(
        lat=mid_lat - delta_lon * offset_fraction,
        lon=mid_lon + delta_lat * offset_fraction / lon_scale,
    )
