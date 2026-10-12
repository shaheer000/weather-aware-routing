from datetime import timedelta
from unittest.mock import patch

from django.test import SimpleTestCase
from django.utils import timezone

from trips.clients.http import ProviderError

PLAN_URL = "/api/trips/plan/"
CHICAGO = {"name": "Chicago, IL", "lat": 41.88, "lon": -87.62}
DENVER = {"name": "Denver, CO", "lat": 39.74, "lon": -104.98}


def valid_payload(**overrides):
    payload = {
        "origin": CHICAGO,
        "destination": DENVER,
        "departure_time": (timezone.now() + timedelta(hours=1)).isoformat(),
        "load_lb": 35_000,
        "checkpoint_interval_miles": 25,
    }
    return payload | overrides


class PlanTripViewTests(SimpleTestCase):
    def post(self, payload):
        return self.client.post(
            PLAN_URL, payload, content_type="application/json"
        )

    def test_rejects_unsupported_interval(self):
        response = self.post(valid_payload(checkpoint_interval_miles=15))
        self.assertEqual(response.status_code, 400)

    def test_rejects_departure_beyond_forecast(self):
        late = (timezone.now() + timedelta(days=10)).isoformat()
        response = self.post(valid_payload(departure_time=late))
        self.assertEqual(response.status_code, 400)

    def test_rejects_same_origin_and_destination(self):
        response = self.post(valid_payload(destination=CHICAGO))
        self.assertEqual(response.status_code, 400)

    @patch("trips.views.plan_trip", side_effect=ProviderError("down"))
    def test_provider_failure_is_bad_gateway(self, _plan_trip):
        self.assertEqual(self.post(valid_payload()).status_code, 502)

    @patch("trips.views.plan_trip", return_value={"routes": []})
    def test_returns_plan(self, _plan_trip):
        response = self.post(valid_payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"routes": []})
