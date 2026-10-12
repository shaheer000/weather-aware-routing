from django.test import SimpleTestCase

from trips.clients.weather import WeatherSample
from trips.risk import (
    RAIN_THRESHOLDS_IN_HR,
    SNOW_THRESHOLDS_IN_HR,
    RiskLevel,
    classify_precipitation,
    classify_weather,
    classify_wind,
)

LIGHT_LOAD_LB = 20_000


class WindRiskTests(SimpleTestCase):
    def test_wind_thresholds_for_light_load(self):
        cases = [
            (24.9, RiskLevel.LOW),
            (25, RiskLevel.MODERATE),
            (34.9, RiskLevel.MODERATE),
            (35, RiskLevel.HIGH),
            (45, RiskLevel.SEVERE),
            (54.9, RiskLevel.SEVERE),
            (55, RiskLevel.NO_TRAVEL),
        ]
        for wind_mph, expected in cases:
            with self.subTest(wind_mph=wind_mph):
                self.assertEqual(
                    classify_wind(wind_mph, LIGHT_LOAD_LB), expected
                )

    def test_load_rules(self):
        self.assertEqual(classify_wind(55, 0), RiskLevel.NO_TRAVEL)
        self.assertEqual(classify_wind(50, 30_000), RiskLevel.SEVERE)
        self.assertEqual(classify_wind(50, 30_001), RiskLevel.NO_TRAVEL)
        self.assertEqual(classify_wind(40, 40_000), RiskLevel.HIGH)
        self.assertEqual(classify_wind(40, 40_001), RiskLevel.SEVERE)


class PrecipitationRiskTests(SimpleTestCase):
    def test_rain_thresholds(self):
        cases = [
            (0.09, RiskLevel.LOW),
            (0.10, RiskLevel.MODERATE),
            (0.25, RiskLevel.HIGH),
            (0.50, RiskLevel.SEVERE),
            (1.00, RiskLevel.SEVERE),
            (1.01, RiskLevel.NO_TRAVEL),
        ]
        for rain, expected in cases:
            with self.subTest(rain=rain):
                self.assertEqual(
                    classify_precipitation(rain, RAIN_THRESHOLDS_IN_HR),
                    expected,
                )

    def test_snow_thresholds(self):
        cases = [
            (0.4, RiskLevel.LOW),
            (0.5, RiskLevel.MODERATE),
            (1.0, RiskLevel.HIGH),
            (2.0, RiskLevel.SEVERE),
            (3.0, RiskLevel.SEVERE),
            (3.1, RiskLevel.NO_TRAVEL),
        ]
        for snow, expected in cases:
            with self.subTest(snow=snow):
                self.assertEqual(
                    classify_precipitation(snow, SNOW_THRESHOLDS_IN_HR),
                    expected,
                )

    def test_overall_level_is_worst_condition(self):
        sample = WeatherSample(wind_mph=10, rain_in_hr=0.3, snow_in_hr=0.6)
        self.assertEqual(
            classify_weather(sample, LIGHT_LOAD_LB), RiskLevel.HIGH
        )
