import { formatDuration, formatMiles, routeLetter } from "../format";
import { HIGH, NO_TRAVEL, SEVERE } from "../risk";
import type { RankingRule, RouteOption, TripPlan } from "../types";

interface RankingRow {
  rule: RankingRule;
  label: string;
  value: (route: RouteOption) => number;
  format: (value: number) => string;
}

// Same priority order the backend uses to pick the recommended route.
const RANKING_ROWS: RankingRow[] = [
  {
    rule: "no_travel_miles",
    label: "No-travel miles",
    value: (route) => route.risk.miles_by_level[NO_TRAVEL],
    format: formatMiles,
  },
  {
    rule: "severe_miles",
    label: "Severe miles",
    value: (route) => route.risk.miles_by_level[SEVERE],
    format: formatMiles,
  },
  {
    rule: "high_miles",
    label: "High-risk miles",
    value: (route) => route.risk.miles_by_level[HIGH],
    format: formatMiles,
  },
  {
    rule: "average_risk",
    label: "Average risk (0–4)",
    value: (route) => route.risk.average,
    format: (value) => value.toFixed(2),
  },
  {
    rule: "duration",
    label: "Drive time",
    value: (route) => route.duration_seconds,
    format: formatDuration,
  },
];

interface RankingTableProps {
  plan: TripPlan;
}

export function RankingTable({ plan }: RankingTableProps) {
  const letter = routeLetter(plan.recommended_route_id);
  return (
    <section className="ranking">
      <h2 className="panel-title">Why route {letter}?</h2>
      <p className="ranking-reason">
        Route {letter} wins because {plan.recommendation_reason}.
      </p>
      <table className="ranking-table">
        <thead>
          <tr>
            <th scope="col">Checked in order</th>
            {plan.routes.map((route) => (
              <th scope="col" key={route.id}>
                {routeLetter(route.id)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {RANKING_ROWS.map((row, position) => {
            const values = plan.routes.map(row.value);
            const best = Math.min(...values);
            const isDeciding = row.rule === plan.deciding_rule;
            return (
              <tr key={row.rule} className={isDeciding ? "is-deciding" : ""}>
                <th scope="row">
                  <span className="rule-number">{position + 1}</span>
                  {row.label}
                </th>
                {values.map((value, routeId) => (
                  <td
                    key={routeId}
                    className={value === best ? "is-best" : ""}
                  >
                    {row.format(value)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="hint">
        Routes are compared top to bottom. The highlighted row decided it.
      </p>
    </section>
  );
}
