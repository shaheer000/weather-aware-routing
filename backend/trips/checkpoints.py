from bisect import bisect_left
from dataclasses import dataclass
from datetime import datetime, timedelta

from trips.geo import Coordinate, interpolate

CHECKPOINT_INTERVALS_MI = (10, 25, 50)


@dataclass(frozen=True)
class Checkpoint:
    coordinate: Coordinate
    mile: float
    eta: datetime


def sample_checkpoints(route, interval_miles, departure_time):
    """Checkpoints every interval_miles, plus the destination."""
    return [
        _checkpoint_at(route, mile, departure_time)
        for mile in mile_markers(route.distance_miles, interval_miles)
    ]


def mile_markers(total_miles, interval_miles):
    markers = [
        step * interval_miles
        for step in range(int(total_miles // interval_miles) + 1)
    ]
    if total_miles - markers[-1] > 0.1:
        markers.append(total_miles)
    return markers


def locate(route, mile):
    """Position and elapsed driving seconds at a mile along the route."""
    miles = route.cumulative_miles
    index = min(bisect_left(miles, mile), len(miles) - 1)
    if index == 0:
        return route.coordinates[0], 0.0
    span = miles[index] - miles[index - 1]
    fraction = (mile - miles[index - 1]) / span if span else 0.0
    coordinate = interpolate(
        route.coordinates[index - 1], route.coordinates[index], fraction
    )
    start_seconds = route.cumulative_seconds[index - 1]
    end_seconds = route.cumulative_seconds[index]
    return coordinate, start_seconds + (end_seconds - start_seconds) * fraction


def _checkpoint_at(route, mile, departure_time):
    coordinate, elapsed_seconds = locate(route, mile)
    return Checkpoint(
        coordinate=coordinate,
        mile=mile,
        eta=departure_time + timedelta(seconds=elapsed_seconds),
    )
