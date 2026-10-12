from enum import IntEnum

RAIN_THRESHOLDS_IN_HR = (0.10, 0.25, 0.50, 1.00)
SNOW_THRESHOLDS_IN_HR = (0.5, 1.0, 2.0, 3.0)
HIGH_WIND_LOAD_LIMIT_LB = 40_000
SEVERE_WIND_LOAD_LIMIT_LB = 30_000


class RiskLevel(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4


def classify_wind(wind_mph, load_lb):
    """Wind level with the load rules applied (heavier loads tip over)."""
    if wind_mph >= 55:
        return RiskLevel.NO_TRAVEL
    if wind_mph >= 45:
        if load_lb > SEVERE_WIND_LOAD_LIMIT_LB:
            return RiskLevel.NO_TRAVEL
        return RiskLevel.SEVERE
    if wind_mph >= 35:
        if load_lb > HIGH_WIND_LOAD_LIMIT_LB:
            return RiskLevel.SEVERE
        return RiskLevel.HIGH
    if wind_mph >= 25:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_precipitation(rate_in_hr, thresholds):
    moderate, high, severe, no_travel = thresholds
    if rate_in_hr > no_travel:
        return RiskLevel.NO_TRAVEL
    if rate_in_hr >= severe:
        return RiskLevel.SEVERE
    if rate_in_hr >= high:
        return RiskLevel.HIGH
    if rate_in_hr >= moderate:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_factors(sample, load_lb):
    return {
        "wind": classify_wind(sample.wind_mph, load_lb),
        "rain": classify_precipitation(
            sample.rain_in_hr, RAIN_THRESHOLDS_IN_HR
        ),
        "snow": classify_precipitation(
            sample.snow_in_hr, SNOW_THRESHOLDS_IN_HR
        ),
    }


def classify_weather(sample, load_lb):
    """Overall level is the worst of wind, rain and snow."""
    return max(classify_factors(sample, load_lb).values())
