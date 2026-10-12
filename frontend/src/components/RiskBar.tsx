import { RISK_LEVELS } from "../risk";

interface RiskBarProps {
  milesByLevel: number[];
}

export function RiskBar({ milesByLevel }: RiskBarProps) {
  return (
    <div className="risk-bar" role="img" aria-label={describe(milesByLevel)}>
      {milesByLevel.map((miles, level) =>
        miles > 0 ? (
          <span
            key={level}
            title={`${RISK_LEVELS[level].label} · ${Math.round(miles)} mi`}
            style={{ flexGrow: miles, background: RISK_LEVELS[level].color }}
          />
        ) : null,
      )}
    </div>
  );
}

function describe(milesByLevel: number[]): string {
  return milesByLevel
    .map((miles, level) => `${RISK_LEVELS[level].label} ${Math.round(miles)} mi`)
    .join(", ");
}
