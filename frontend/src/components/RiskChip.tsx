import { riskColor, riskLabel } from "../risk";
import type { RiskLevel } from "../types";

interface RiskChipProps {
  level: RiskLevel;
}

export function RiskChip({ level }: RiskChipProps) {
  const color = riskColor(level);
  return (
    <span
      className="risk-chip"
      style={{ color, background: `${color}1A`, borderColor: `${color}40` }}
    >
      <span className="risk-dot" style={{ background: color }} />
      {riskLabel(level)}
    </span>
  );
}
