from datetime import datetime, timedelta, timezone

from django.test import SimpleTestCase

from trips.checkpoints import mile_markers, sample_checkpoints
from trips.clients.routing import Route
from trips.geo import Coordinate

DEPARTURE = datetime(2026, 1, 1, 8, tzinfo=timezone.utc)


def straight_route():
    """60 miles due north at 60 mph, one vertex every 20 miles."""
    return Route(
        coordinates=[Coordinate(lat=40 + step * 0.29, lon=-90)
                     for step in range(4)],
        cumulative_miles=[0.0, 20.0, 40.0, 60.0],
        cumulative_seconds=[0.0, 1200.0, 2400.0, 3600.0],
    )


class CheckpointTests(SimpleTestCase):
    def test_mile_markers_include_destination(self):
        self.assertEqual(mile_markers(60, 25), [0, 25, 50, 60])
        self.assertEqual(mile_markers(50, 25), [0, 25, 50])

    def test_checkpoint_eta_and_position_are_interpolated(self):
        checkpoints = sample_checkpoints(straight_route(), 25, DEPARTURE)
        second = checkpoints[1]
        self.assertEqual(second.mile, 25)
        self.assertEqual(second.eta, DEPARTURE + timedelta(minutes=25))
        self.assertAlmostEqual(second.coordinate.lat, 40 + 0.29 * 1.25)
        self.assertEqual(checkpoints[-1].eta, DEPARTURE + timedelta(hours=1))
