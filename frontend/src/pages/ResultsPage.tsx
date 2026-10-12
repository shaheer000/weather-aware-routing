import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";

import { planTrip } from "../api";
import { AppHeader } from "../components/AppHeader";
import { CheckpointDetail } from "../components/CheckpointDetail";
import { CheckpointTimeline } from "../components/CheckpointTimeline";
import { ForecastControl } from "../components/ForecastControl";
import { Icon } from "../components/Icon";
import { RankingTable } from "../components/RankingTable";
import { RouteList } from "../components/RouteList";
import { TripMap } from "../components/TripMap";
import {
  formatPounds,
  formatTime,
  routeLetter,
  shortPlaceName,
} from "../format";
import {
  addHours,
  checkpointIndexAt,
  forecastHourOf,
  positionAt,
} from "../trip";
import { fromSearchParams } from "../tripParams";
import type { TripPlan, TripRequest } from "../types";

const MAX_FORECAST_HOUR = 48;

export function ResultsPage() {
  const [searchParams] = useSearchParams();
  const request = useMemo(
    () => fromSearchParams(searchParams),
    [searchParams],
  );
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState("");
  const [selectedRouteId, setSelectedRouteId] = useState(0);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState(0);
  const [forecastHour, setForecastHour] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!request) return;
    const controller = new AbortController();
    setPlan(null);
    setError("");
    planTrip(request, controller.signal)
      .then((newPlan) => {
        setPlan(newPlan);
        setSelectedRouteId(newPlan.recommended_route_id);
        setSelectedCheckpoint(0);
        setForecastHour(0);
      })
      .catch((planError: Error) => {
        if (!controller.signal.aborted) setError(planError.message);
      });
    return () => controller.abort();
  }, [request]);

  const route = plan?.routes[selectedRouteId];
  const sliderTime = plan ? addHours(plan.heatmap.start_time, forecastHour) : "";
  const truckIndex = route ? checkpointIndexAt(route, sliderTime) : 0;
  const truckPosition = useMemo(
    () => (route ? positionAt(route, sliderTime) : null),
    [route, sliderTime],
  );

  const editLink = `/?${searchParams}`;

  // Picking a checkpoint moves the forecast to the hour the truck gets there.
  function selectCheckpoint(routeId: number, index: number) {
    if (!plan) return;
    const checkpoint = plan.routes[routeId].checkpoints[index];
    setSelectedRouteId(routeId);
    setSelectedCheckpoint(index);
    setForecastHour(
      Math.min(
        MAX_FORECAST_HOUR,
        forecastHourOf(checkpoint, plan.heatmap.start_time),
      ),
    );
  }

  function selectRoute(routeId: number) {
    setSelectedRouteId(routeId);
    setSelectedCheckpoint(0);
  }

  if (!request) return <Navigate to="/" replace />;

  return (
    <div className="results-page">
      <AppHeader>
        <TripSummary request={request} editLink={editLink} />
      </AppHeader>

      <div className="results-body">
        <aside className="route-panel">
          <h2 className="panel-title">Route options</h2>
          {plan ? (
            <>
              <RouteList
                plan={plan}
                selectedRouteId={selectedRouteId}
                onSelectRoute={selectRoute}
              />
              <RankingTable plan={plan} />
            </>
          ) : (
            <div className="skeleton-list" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          )}
        </aside>

        <main className="map-column">
          {plan && route && (
            <div className="map-toolbar">
              <ForecastControl
                startTime={plan.heatmap.start_time}
                hour={forecastHour}
                route={route}
                onHourChange={setForecastHour}
              />
              <button
                type="button"
                className={`drawer-toggle${isDrawerOpen ? " is-open" : ""}`}
                onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                aria-expanded={isDrawerOpen}
                aria-controls="checkpoint-drawer"
              >
                <Icon name="timeline" size={16} />
                <span>Checkpoint ETAs</span>
                <span className="count-badge">{route.checkpoints.length}</span>
                <Icon name={isDrawerOpen ? "chevronDown" : "chevronUp"} size={14} />
              </button>
            </div>
          )}

          <div className="map-area">
            <TripMap
              plan={plan}
              selectedRouteId={selectedRouteId}
              selectedCheckpointIndex={selectedCheckpoint}
              forecastHour={forecastHour}
              truckPosition={truckPosition}
              onSelectRoute={selectRoute}
              onSelectCheckpoint={(routeId, index) => {
                selectCheckpoint(routeId, index);
                setIsDrawerOpen(true);
              }}
            />
            {!plan && !error && <LoadingCard request={request} />}
            {error && <ErrorCard message={error} editLink={editLink} />}
          </div>

          {plan && route && isDrawerOpen && (
            <section
              id="checkpoint-drawer"
              className="checkpoint-drawer"
              aria-label="Checkpoints and ETAs"
            >
              <div className="drawer-header">
                <h2 className="panel-title">
                  Route {routeLetter(route.id)} · {route.checkpoints.length}{" "}
                  checkpoints every {request.checkpoint_interval_miles} mi
                </h2>
                <span className="hint">
                  Pick a checkpoint to see its ETA and the forecast for that
                  hour.
                </span>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => setIsDrawerOpen(false)}
                  aria-label="Close checkpoints"
                >
                  <Icon name="close" size={16} />
                </button>
              </div>
              <CheckpointTimeline
                route={route}
                selectedIndex={selectedCheckpoint}
                truckIndex={truckIndex}
                onSelect={(index) => selectCheckpoint(route.id, index)}
              />
              <CheckpointDetail
                checkpoint={route.checkpoints[selectedCheckpoint]}
                index={selectedCheckpoint}
                total={route.checkpoints.length}
                departureTime={plan.departure_time}
                forecastStart={plan.heatmap.start_time}
                onStep={(index) => selectCheckpoint(route.id, index)}
              />
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

interface TripSummaryProps {
  request: TripRequest;
  editLink: string;
}

function TripSummary({ request, editLink }: TripSummaryProps) {
  return (
    <div className="trip-summary">
      <span className="trip-route">
        {shortPlaceName(request.origin.name)}
        <Icon name="arrowRight" size={14} />
        {shortPlaceName(request.destination.name)}
      </span>
      <span className="trip-meta">
        {formatTime(request.departure_time)} · {formatPounds(request.load_lb)}
      </span>
      <Link className="ghost-button" to={editLink}>
        <Icon name="edit" size={14} />
        Edit trip
      </Link>
    </div>
  );
}

function LoadingCard({ request }: { request: TripRequest }) {
  return (
    <div className="status-card" role="status">
      <span className="spinner" aria-hidden="true" />
      <div>
        <strong>Planning your trip</strong>
        <ul className="status-steps">
          <li>Finding 3 route options</li>
          <li>
            Forecast at every {request.checkpoint_interval_miles} mi, for the
            hour you arrive
          </li>
          <li>Scoring risk for {formatPounds(request.load_lb)}</li>
        </ul>
        <p className="hint">This usually takes 10–20 seconds.</p>
      </div>
    </div>
  );
}

function ErrorCard({ message, editLink }: { message: string; editLink: string }) {
  return (
    <div className="status-card is-error" role="alert">
      <div>
        <strong>Couldn't plan this trip</strong>
        <p>{message}</p>
        <Link className="primary-button" to={editLink}>
          Edit trip
        </Link>
      </div>
    </div>
  );
}
