import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta

from trips.checkpoints import sample_checkpoints
from trips.clients.routing import fetch_routes
from trips.clients.weather import fetch_hourly_forecasts
from trips.geo import Place
from trips.heatmap import build_corridor_grid
from trips.recommendation import ranking_key, recommend, summarize_risk
from trips.risk import classify_factors, classify_weather

logger = logging.getLogger(__name__)

HEATMAP_HOURS = 49
MAX_GEOMETRY_POINTS = 1500


@dataclass(frozen=True)
class TripRequest:
    origin: Place
    destination: Place
    departure_time: datetime
    load_lb: int
    checkpoint_interval_miles: int


def plan_trip(request):
    origin, destination = request.origin, request.destination
    logger.info("Planning %s -> %s", origin.name, destination.name)
    routes = fetch_routes(origin.coordinate, destination.coordinate)
    checkpoint_sets = [
        sample_checkpoints(
            route, request.checkpoint_interval_miles, request.departure_time
        )
        for route in routes
    ]
    grid = build_corridor_grid(routes)
    start_hour = request.departure_time.replace(
        minute=0, second=0, microsecond=0
    )
    route_forecasts, grid_forecasts = _fetch_weather(
        checkpoint_sets, grid.points, start_hour
    )

    route_payloads, ranking_keys = [], []
    for index, route in enumerate(routes):
        payload, key = _evaluate_route(
            index,
            route,
            checkpoint_sets[index],
            route_forecasts[index],
            start_hour,
            request.load_lb,
        )
        route_payloads.append(payload)
        ranking_keys.append(key)
    recommendation = recommend(ranking_keys)
    logger.info(
        "Recommended route %d because %s",
        recommendation.route_index, recommendation.reason,
    )

    return {
        "origin": _place_payload(origin),
        "destination": _place_payload(destination),
        "departure_time": request.departure_time,
        "recommended_route_id": recommendation.route_index,
        "recommendation_reason": recommendation.reason,
        "deciding_rule": recommendation.deciding_rule,
        "routes": route_payloads,
        "heatmap": _heatmap_payload(
            grid, grid_forecasts, start_hour, request.load_lb
        ),
    }


def _fetch_weather(checkpoint_sets, grid_points, start_hour):
    """One batched forecast call, split back into per-route and grid parts."""
    last_eta = max(checkpoints[-1].eta for checkpoints in checkpoint_sets)
    hour_count = max(HEATMAP_HOURS, _hour_index(start_hour, last_eta) + 1)
    checkpoint_points = [
        checkpoint.coordinate
        for checkpoints in checkpoint_sets
        for checkpoint in checkpoints
    ]
    forecasts = fetch_hourly_forecasts(
        checkpoint_points + grid_points, start_hour, hour_count
    )
    route_forecasts = []
    offset = 0
    for checkpoints in checkpoint_sets:
        route_forecasts.append(forecasts[offset:offset + len(checkpoints)])
        offset += len(checkpoints)
    return route_forecasts, forecasts[offset:]


def _evaluate_route(index, route, checkpoints, forecasts, start, load_lb):
    """Route JSON payload plus its ranking key."""
    samples = [
        forecast[_hour_index(start, checkpoint.eta)]
        for checkpoint, forecast in zip(checkpoints, forecasts)
    ]
    factor_levels = [classify_factors(sample, load_lb) for sample in samples]
    levels = [max(factors.values()) for factors in factor_levels]
    risk = summarize_risk([cp.mile for cp in checkpoints], levels)
    payload = {
        "id": index,
        "distance_miles": round(route.distance_miles, 1),
        "duration_seconds": round(route.duration_seconds),
        "arrival_time": checkpoints[-1].eta,
        "geometry": _simplify_geometry(route.coordinates),
        "risk": {
            "miles_by_level": [
                round(miles, 1) for miles in risk.miles_by_level.values()
            ],
            "average": round(risk.average_risk, 2),
            "worst_level": risk.worst_level,
        },
        "checkpoints": [
            _checkpoint_payload(checkpoint, sample, factors)
            for checkpoint, sample, factors in zip(
                checkpoints, samples, factor_levels
            )
        ],
    }
    return payload, ranking_key(risk, route.duration_seconds)


def _checkpoint_payload(checkpoint, sample, factor_levels):
    return {
        "lat": round(checkpoint.coordinate.lat, 5),
        "lon": round(checkpoint.coordinate.lon, 5),
        "mile": round(checkpoint.mile, 1),
        "eta": checkpoint.eta,
        "wind_mph": sample.wind_mph,
        "rain_in_hr": sample.rain_in_hr,
        "snow_in_hr": sample.snow_in_hr,
        "risk_level": max(factor_levels.values()),
        "factor_levels": factor_levels,
    }


def _heatmap_payload(grid, forecasts, start_hour, load_lb):
    return {
        "start_time": start_hour,
        "cell_miles": round(grid.cell_miles, 2),
        "points": [[point.lat, point.lon] for point in grid.points],
        "levels": [
            [
                classify_weather(sample, load_lb)
                for sample in forecast[:HEATMAP_HOURS]
            ]
            for forecast in forecasts
        ],
    }


def _hour_index(start_hour, moment):
    return max(0, round((moment - start_hour) / timedelta(hours=1)))


def _simplify_geometry(coordinates):
    step = math.ceil(len(coordinates) / MAX_GEOMETRY_POINTS)
    kept = coordinates[::step]
    if kept[-1] != coordinates[-1]:
        kept.append(coordinates[-1])
    return [[round(point.lon, 5), round(point.lat, 5)] for point in kept]


def _place_payload(place):
    return {
        "name": place.name,
        "lat": place.coordinate.lat,
        "lon": place.coordinate.lon,
    }
