import { type FormEvent, useState } from "react";

import type { Place, TripRequest } from "../types";
import { Icon } from "./Icon";
import { PlaceInput } from "./PlaceInput";

const CHECKPOINT_INTERVALS = [10, 25, 50];
const LOAD_PRESETS = [
  { label: "Light", pounds: 20_000 },
  { label: "Medium", pounds: 35_000 },
  { label: "Heavy", pounds: 45_000 },
];

interface TripFormProps {
  initialRequest: TripRequest | null;
  onSubmit: (request: TripRequest) => void;
}

export function TripForm({ initialRequest, onSubmit }: TripFormProps) {
  const [origin, setOrigin] = useState(initialRequest?.origin ?? null);
  const [destination, setDestination] = useState(
    initialRequest?.destination ?? null,
  );
  const [departure, setDeparture] = useState(() =>
    toLocalInput(initialRequest ? new Date(initialRequest.departure_time) : nextHour()),
  );
  const [loadLb, setLoadLb] = useState(initialRequest?.load_lb ?? 35_000);
  const [intervalMiles, setIntervalMiles] = useState(
    initialRequest?.checkpoint_interval_miles ?? 25,
  );
  const [error, setError] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!origin || !destination) {
      setError("Pick the origin and destination from the suggestions.");
      return;
    }
    onSubmit({
      origin,
      destination,
      departure_time: new Date(departure).toISOString(),
      load_lb: loadLb,
      checkpoint_interval_miles: intervalMiles,
    });
  }

  function swapPlaces() {
    setOrigin(destination);
    setDestination(origin);
  }

  return (
    <form className="trip-form" onSubmit={handleSubmit} noValidate>
      <div className="place-pair">
        <PlaceInput
          label="From"
          icon="pin"
          placeholder="City or address"
          value={origin}
          onChange={(place: Place | null) => setOrigin(place)}
        />
        <button
          type="button"
          className="swap-button"
          onClick={swapPlaces}
          aria-label="Swap origin and destination"
        >
          <Icon name="swap" />
        </button>
        <PlaceInput
          label="To"
          icon="flag"
          placeholder="City or address"
          value={destination}
          onChange={(place: Place | null) => setDestination(place)}
        />
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor="departure">
          Departure
        </label>
        <div className="input-shell">
          <Icon name="clock" />
          <input
            id="departure"
            type="datetime-local"
            value={departure}
            onChange={(event) => setDeparture(event.target.value)}
            required
          />
        </div>
        <div className="chips">
          <button type="button" onClick={() => setDeparture(toLocalInput(nextHour()))}>
            Next hour
          </button>
          <button type="button" onClick={() => setDeparture(toLocalInput(tomorrowAt(6)))}>
            Tomorrow 6 AM
          </button>
        </div>
      </div>

      <div className="form-section">
        <label className="field-label" htmlFor="load">
          Load weight
        </label>
        <div className="input-shell">
          <Icon name="truck" />
          <input
            id="load"
            type="number"
            min={0}
            max={80_000}
            step={500}
            value={loadLb}
            onChange={(event) => setLoadLb(Number(event.target.value))}
            required
          />
          <span className="input-suffix">lb</span>
        </div>
        <div className="chips">
          {LOAD_PRESETS.map(({ label, pounds }) => (
            <button
              type="button"
              key={label}
              className={loadLb === pounds ? "is-active" : ""}
              onClick={() => setLoadLb(pounds)}
            >
              {label} · {pounds / 1000}k
            </button>
          ))}
        </div>
        <p className="hint">{loadRuleHint(loadLb)}</p>
      </div>

      <fieldset className="form-section">
        <legend className="field-label">Check the weather every</legend>
        <div className="segmented">
          {CHECKPOINT_INTERVALS.map((miles) => (
            <label key={miles}>
              <input
                type="radio"
                name="interval"
                checked={intervalMiles === miles}
                onChange={() => setIntervalMiles(miles)}
              />
              <span>{miles} miles</span>
            </label>
          ))}
        </div>
        <p className="hint">
          Each checkpoint uses the forecast for the hour your truck gets there.
        </p>
      </fieldset>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit">
        Compare 3 routes
        <Icon name="arrowRight" />
      </button>
    </form>
  );
}

function loadRuleHint(loadLb: number): string {
  if (loadLb > 40_000) {
    return "Heavy load: 35–44 mph wind counts as Severe, 45+ mph is No travel.";
  }
  if (loadLb > 30_000) {
    return "Over 30,000 lb: 45–54 mph wind counts as No travel.";
  }
  return "Standard wind limits apply. 55+ mph is No travel for every load.";
}

function nextHour(): Date {
  const date = new Date();
  date.setHours(date.getHours() + 1, 0, 0, 0);
  return date;
}

function tomorrowAt(hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return date;
}

// datetime-local expects local "YYYY-MM-DDTHH:mm" with no timezone.
function toLocalInput(date: Date): string {
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
