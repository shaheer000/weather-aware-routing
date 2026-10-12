import { formatDuration, formatMiles, formatTime, routeLetter } from "../format";
import type { TripPlan } from "../types";
import { Icon } from "./Icon";
import { RiskBar } from "./RiskBar";
import { RiskChip } from "./RiskChip";

interface RouteListProps {
  plan: TripPlan;
  selectedRouteId: number;
  onSelectRoute: (routeId: number) => void;
}

export function RouteList({
  plan,
  selectedRouteId,
  onSelectRoute,
}: RouteListProps) {
  return (
    <div className="route-list" role="radiogroup" aria-label="Route options">
      {plan.routes.map((route) => {
        const isSelected = route.id === selectedRouteId;
        const isRecommended = route.id === plan.recommended_route_id;
        return (
          <button
            key={route.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            className={`route-card${isSelected ? " is-selected" : ""}`}
            onClick={() => onSelectRoute(route.id)}
          >
            <div className="route-card-top">
              <span className="route-letter">{routeLetter(route.id)}</span>
              <span className="route-duration">
                {formatDuration(route.duration_seconds)}
              </span>
              {isRecommended && (
                <span className="best-tag">
                  <Icon name="star" size={12} />
                  Safest pick
                </span>
              )}
            </div>
            <p className="route-meta">
              {formatMiles(route.distance_miles)} · arrives{" "}
              {formatTime(route.arrival_time)}
            </p>
            <RiskBar milesByLevel={route.risk.miles_by_level} />
            <div className="route-card-bottom">
              <span>Worst on route</span>
              <RiskChip level={route.risk.worst_level} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
