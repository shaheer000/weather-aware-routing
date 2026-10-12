import { useEffect, useRef } from "react";

import { formatClock, formatWeekday } from "../format";
import { riskColor, riskLabel } from "../risk";
import type { RiskLevel, RouteOption } from "../types";
import { Icon } from "./Icon";

interface CheckpointTimelineProps {
  route: RouteOption;
  selectedIndex: number;
  truckIndex: number;
  onSelect: (index: number) => void;
}

export function CheckpointTimeline({
  route,
  selectedIndex,
  truckIndex,
  onSelect,
}: CheckpointTimelineProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const { checkpoints } = route;

  useEffect(() => {
    const node = listRef.current?.children[selectedIndex];
    node?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [selectedIndex, route.id]);

  return (
    <ol className="timeline" ref={listRef} aria-label="Checkpoints by ETA">
      {checkpoints.map((checkpoint, index) => {
        const next = checkpoints[index + 1];
        const isNewDay =
          index === 0 ||
          formatWeekday(checkpoint.eta) !==
            formatWeekday(checkpoints[index - 1].eta);
        const classes = [
          "timeline-node",
          index === selectedIndex && "is-selected",
          index === truckIndex && "has-truck",
        ];
        return (
          <li key={checkpoint.mile} className="timeline-item">
            {next && (
              <span
                className="timeline-connector"
                style={{
                  background: riskColor(
                    Math.max(checkpoint.risk_level, next.risk_level) as RiskLevel,
                  ),
                }}
              />
            )}
            <button
              type="button"
              className={classes.filter(Boolean).join(" ")}
              onClick={() => onSelect(index)}
              aria-label={`Mile ${Math.round(checkpoint.mile)}, ETA ${formatClock(checkpoint.eta)}, ${riskLabel(checkpoint.risk_level)} risk`}
              aria-current={index === selectedIndex ? "step" : undefined}
            >
              <span className="timeline-day">
                {isNewDay ? formatWeekday(checkpoint.eta) : ""}
              </span>
              <span className="timeline-time">{formatClock(checkpoint.eta)}</span>
              <span
                className="timeline-dot"
                style={{ background: riskColor(checkpoint.risk_level) }}
              >
                {index === truckIndex && <Icon name="truck" size={12} />}
              </span>
              <span className="timeline-mile">
                {index === 0
                  ? "Start"
                  : index === checkpoints.length - 1
                    ? "Arrive"
                    : `${Math.round(checkpoint.mile)} mi`}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
