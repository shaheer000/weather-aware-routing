import logging
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache

from trips.clients.http import get_json

logger = logging.getLogger(__name__)

LOCATIONS_PER_REQUEST = 100
MAX_PARALLEL_REQUESTS = 4
CACHE_SECONDS = 30 * 60
# One decimal (~7 mi) is close to forecast model resolution, so nearby
# points share a lookup and stay within Open-Meteo's free quota.
COORDINATE_DECIMALS = 1
HOUR_FORMAT = "%Y-%m-%dT%H:%M"


@dataclass(frozen=True)
class WeatherSample:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


def fetch_hourly_forecasts(points, start_hour, hour_count):
    """Hourly samples per point, indexed by hours since start_hour (UTC)."""
    cells = [
        (round(point.lat, COORDINATE_DECIMALS),
         round(point.lon, COORDINATE_DECIMALS))
        for point in points
    ]
    end_hour = start_hour + timedelta(hours=hour_count - 1)
    window = f"{start_hour:%Y%m%d%H}-{end_hour:%Y%m%d%H}"
    cache_keys = {
        cell: f"weather:{cell[0]}:{cell[1]}:{window}" for cell in set(cells)
    }
    forecasts = cache.get_many(cache_keys.values())

    missing = [
        cell for cell, key in cache_keys.items() if key not in forecasts
    ]
    logger.info(
        "Weather for %d points: %d cells, %d not cached",
        len(points), len(cache_keys), len(missing),
    )
    if missing:
        fetched = _fetch_cells(missing, start_hour, end_hour)
        new_entries = {cache_keys[cell]: fetched[cell] for cell in missing}
        cache.set_many(new_entries, CACHE_SECONDS)
        forecasts.update(new_entries)
    return [forecasts[cache_keys[cell]] for cell in cells]


def _fetch_cells(cells, start_hour, end_hour):
    chunks = [
        cells[index:index + LOCATIONS_PER_REQUEST]
        for index in range(0, len(cells), LOCATIONS_PER_REQUEST)
    ]
    with ThreadPoolExecutor(max_workers=MAX_PARALLEL_REQUESTS) as executor:
        results = executor.map(
            lambda chunk: _fetch_chunk(chunk, start_hour, end_hour), chunks
        )
        forecasts = [forecast for chunk in results for forecast in chunk]
    return dict(zip(cells, forecasts))


def _fetch_chunk(cells, start_hour, end_hour):
    params = {
        "latitude": ",".join(str(lat) for lat, _ in cells),
        "longitude": ",".join(str(lon) for _, lon in cells),
        "hourly": "wind_speed_10m,rain,snowfall",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "GMT",
        "start_hour": start_hour.strftime(HOUR_FORMAT),
        "end_hour": end_hour.strftime(HOUR_FORMAT),
    }
    if settings.OPEN_METEO_API_KEY:
        params["apikey"] = settings.OPEN_METEO_API_KEY
    data = get_json(settings.OPEN_METEO_URL, params)
    # Open-Meteo returns a bare object instead of a list for one location.
    locations = data if isinstance(data, list) else [data]
    return [_parse_hourly(location["hourly"]) for location in locations]


def _parse_hourly(hourly):
    # Missing values (null) beyond a model's horizon are treated as calm.
    return [
        WeatherSample(
            wind_mph=wind or 0.0,
            rain_in_hr=rain or 0.0,
            snow_in_hr=snow or 0.0,
        )
        for wind, rain, snow in zip(
            hourly["wind_speed_10m"], hourly["rain"], hourly["snowfall"]
        )
    ]
