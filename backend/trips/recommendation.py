from dataclasses import dataclass

from trips.risk import RiskLevel

RANKING_RULES = (
    ("no_travel_miles", "it avoids no-travel conditions"),
    ("severe_miles", "it has the fewest severe miles"),
    ("high_miles", "it has the fewest high-risk miles"),
    ("average_risk", "it has the lowest average risk"),
    ("duration", "it is the fastest"),
)


@dataclass(frozen=True)
class RiskSummary:
    miles_by_level: dict
    average_risk: float
    worst_level: RiskLevel


def summarize_risk(checkpoint_miles, levels):
    """Each stretch between checkpoints takes the worse of its two ends."""
    miles_by_level = {level: 0.0 for level in RiskLevel}
    weighted_total = 0.0
    for index in range(1, len(levels)):
        stretch = checkpoint_miles[index] - checkpoint_miles[index - 1]
        level = max(levels[index - 1], levels[index])
        miles_by_level[level] += stretch
        weighted_total += level * stretch
    total_miles = checkpoint_miles[-1] or 1.0
    return RiskSummary(
        miles_by_level=miles_by_level,
        average_risk=weighted_total / total_miles,
        worst_level=max(levels),
    )


def ranking_key(summary, duration_seconds):
    """Priority order from the spec; no-travel miles outrank everything."""
    miles = summary.miles_by_level
    return (
        round(miles[RiskLevel.NO_TRAVEL], 1),
        round(miles[RiskLevel.SEVERE], 1),
        round(miles[RiskLevel.HIGH], 1),
        round(summary.average_risk, 2),
        duration_seconds,
    )


@dataclass(frozen=True)
class Recommendation:
    route_index: int
    deciding_rule: str | None
    reason: str


def recommend(keys):
    """Best route, the ranking rule that decided it, and a short reason."""
    ranked = sorted(range(len(keys)), key=keys.__getitem__)
    best = ranked[0]
    if len(ranked) == 1:
        return Recommendation(best, None, "it is the only route available")
    runner_up = keys[ranked[1]]
    for (rule, reason), ours, theirs in zip(
        RANKING_RULES, keys[best], runner_up
    ):
        if ours != theirs:
            return Recommendation(best, rule, reason)
    return Recommendation(best, None, "it ties with the alternatives")
