import type { RiskLevel } from "./types";

export const RISK_LEVELS = [
  { label: "Low", color: "#2E9E5B" },
  { label: "Moderate", color: "#DDB21F" },
  { label: "High", color: "#EE6A1A" },
  { label: "Severe", color: "#BF1E3C" },
  { label: "No travel", color: "#7B3FA0" },
] as const;

export const HIGH = 2;
export const SEVERE = 3;
export const NO_TRAVEL = 4;

export function riskLabel(level: RiskLevel): string {
  return RISK_LEVELS[level].label;
}

export function riskColor(level: RiskLevel): string {
  return RISK_LEVELS[level].color;
}
