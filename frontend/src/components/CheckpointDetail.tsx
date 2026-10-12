import { formatDuration, formatTime } from "../format";
import { addHours, forecastHourOf, hoursBetween } from "../trip";
import type { Checkpoint, RiskLevel } from "../types";
import { Icon, type IconName } from "./Icon";
import { RiskChip } from "./RiskChip";

interface CheckpointDetailProps {
  checkpoint: Checkpoint;
  index: number;
  total: number;
  departureTime: string;
  forecastStart: string;
  onStep: (index: number) => void;
}

export function CheckpointDetail({
  checkpoint,
  index,
  total,
  departureTime,
  forecastStart,
  onStep,
}: CheckpointDetailProps) {
  const elapsedSeconds = hoursBetween(departureTime, checkpoint.eta) * 3600;
  const forecastHour = addHours(
    forecastStart,
    forecastHourOf(checkpoint, forecastStart),
  );
  const factors: {
    icon: IconName;
    label: string;
    value: string;
    level: RiskLevel;
  }[] = [
    {
      icon: "wind",
      label: "Wind",
      value: `${checkpoint.wind_mph.toFixed(0)} mph`,
      level: checkpoint.factor_levels.wind,
    },
    {
      icon: "rain",
      label: "Rain",
      value: `${checkpoint.rain_in_hr.toFixed(2)} in/hr`,
      level: checkpoint.factor_levels.rain,
    },
    {
      icon: "snow",
      label: "Snow",
      value: `${checkpoint.snow_in_hr.toFixed(2)} in/hr`,
      level: checkpoint.factor_levels.snow,
    },
  ];

  return (
    <section className="checkpoint-detail" aria-live="polite">
      <div className="detail-eta">
        <span className="eyebrow">
          Checkpoint {index + 1} of {total}
        </span>
        <strong>{formatTime(checkpoint.eta)}</strong>
        <span>
          Mile {Math.round(checkpoint.mile)} ·{" "}
          {index === 0 ? "departure" : `${formatDuration(elapsedSeconds)} in`}
        </span>
      </div>

      <div className="detail-overall">
        <span>Risk at ETA</span>
        <RiskChip level={checkpoint.risk_level} />
      </div>

      <ul className="factor-list">
        {factors.map((factor) => (
          <li key={factor.label}>
            <Icon name={factor.icon} />
            <span className="factor-label">{factor.label}</span>
            <span className="factor-value">{factor.value}</span>
            <RiskChip level={factor.level} />
          </li>
        ))}
      </ul>

      <div className="stepper">
        <button
          type="button"
          onClick={() => onStep(index - 1)}
          disabled={index === 0}
          aria-label="Previous checkpoint"
        >
          <Icon name="chevronLeft" />
        </button>
        <button
          type="button"
          onClick={() => onStep(index + 1)}
          disabled={index === total - 1}
          aria-label="Next checkpoint"
        >
          <Icon name="chevronRight" />
        </button>
      </div>

      <p className="hint detail-hint">
        Forecast for the {formatTime(forecastHour)} hour, when you reach this
        point. Overall risk is the worst of the three.
      </p>
    </section>
  );
}
