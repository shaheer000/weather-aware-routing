from django.test import SimpleTestCase

from trips.recommendation import ranking_key, recommend, summarize_risk
from trips.risk import RiskLevel

LOW, HIGH, SEVERE = RiskLevel.LOW, RiskLevel.HIGH, RiskLevel.SEVERE


class SummarizeRiskTests(SimpleTestCase):
    def test_stretch_takes_worse_endpoint(self):
        summary = summarize_risk([0, 10, 20], [LOW, HIGH, LOW])
        self.assertEqual(summary.miles_by_level[HIGH], 20)
        self.assertEqual(summary.miles_by_level[LOW], 0)
        self.assertEqual(summary.average_risk, HIGH)
        self.assertEqual(summary.worst_level, HIGH)


class RecommendTests(SimpleTestCase):
    def key(self, levels, duration_seconds):
        miles = [10 * step for step in range(len(levels))]
        return ranking_key(summarize_risk(miles, levels), duration_seconds)

    def test_fewer_severe_miles_beats_faster_route(self):
        risky_fast = self.key([LOW, SEVERE, LOW], 3600)
        safe_slow = self.key([HIGH, HIGH, HIGH], 7200)
        recommendation = recommend([risky_fast, safe_slow])
        self.assertEqual(recommendation.route_index, 1)
        self.assertEqual(recommendation.deciding_rule, "severe_miles")

    def test_travel_time_breaks_risk_ties(self):
        slow = self.key([LOW, LOW], 7200)
        fast = self.key([LOW, LOW], 3600)
        recommendation = recommend([slow, fast])
        self.assertEqual(recommendation.route_index, 1)
        self.assertEqual(recommendation.deciding_rule, "duration")
