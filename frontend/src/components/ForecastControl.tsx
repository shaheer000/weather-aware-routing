import { useEffect, useState } from "react";

import { formatTime, routeLetter } from "../format";
import { RISK_LEVELS } from "../risk";
import { addHours, hoursBetween } from "../trip";
import type { RouteOption } from "../types";
import { Icon } from "./Icon";

const MAX_HOUR = 48;
const PLAY_STEP_MS = 500;

interface ForecastControlProps {
  startTime: string;
  hour: number;
  route: RouteOption;
  onHourChange: (hour: number) => void;
}

/** One-row forecast bar that sits above the map, never on top of it. */
export function ForecastControl({
  startTime,
  hour,
  route,
  onHourChange,
}: ForecastControlProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const arrivalHour = hoursBetween(startTime, route.arrival_time);
  const letter = routeLetter(route.id);

  useEffect(() => {
    if (!isPlaying) return;
    if (hour >= MAX_HOUR) {
      setIsPlaying(false);
      return;
    }
    const timer = setTimeout(() => onHourChange(hour + 1), PLAY_STEP_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, hour, onHourChange]);

  function togglePlay() {
    if (!isPlaying && hour >= MAX_HOUR) onHourChange(0);
    setIsPlaying(!isPlaying);
  }

  return (
    <section className="forecast-bar" aria-label="Weather forecast time">
      <button
        type="button"
        className="play-button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause forecast" : "Play forecast"}
      >
        <Icon name={isPlaying ? "pause" : "play"} size={12} />
      </button>

      <div
        className="forecast-label"
        title={`Drag the slider to see forecast risk along the corridor at that hour. The truck shows where route ${letter} would be.`}
      >
        <span className="eyebrow">Weather at</span>
        <strong>{formatTime(addHours(startTime, hour))}</strong>
        <span className="forecast-offset">
          {hour === 0 ? "departure" : `+${hour}h`}
        </span>
      </div>

      <div className="slider-wrap">
        <input
          className="forecast-slider"
          type="range"
          min={0}
          max={MAX_HOUR}
          value={hour}
          onChange={(event) => {
            setIsPlaying(false);
            onHourChange(Number(event.target.value));
          }}
          aria-label="Forecast hours after departure"
          aria-valuetext={formatTime(addHours(startTime, hour))}
        />
        {arrivalHour <= MAX_HOUR && (
          <span
            className="arrival-mark"
            style={{ left: `${(arrivalHour / MAX_HOUR) * 100}%` }}
            title={`Route ${letter} arrives`}
          />
        )}
        <div className="slider-ticks" aria-hidden="true">
          <span>Depart</span>
          <span>+24h</span>
          <span>+48h</span>
        </div>
      </div>

      <ul className="legend" aria-label="Risk levels">
        {RISK_LEVELS.map(({ label, color }) => (
          <li key={label}>
            <span className="risk-dot" style={{ background: color }} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}
