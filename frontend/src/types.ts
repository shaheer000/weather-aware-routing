export type RiskLevel = 0 | 1 | 2 | 3 | 4;

export type RankingRule =
  | "no_travel_miles"
  | "severe_miles"
  | "high_miles"
  | "average_risk"
  | "duration";

export interface Place {
  name: string;
  lat: number;
  lon: number;
}

export interface TripRequest {
  origin: Place;
  destination: Place;
  departure_time: string;
  load_lb: number;
  checkpoint_interval_miles: number;
}

export interface Checkpoint {
  lat: number;
  lon: number;
  mile: number;
  eta: string;
  wind_mph: number;
  rain_in_hr: number;
  snow_in_hr: number;
  risk_level: RiskLevel;
  factor_levels: { wind: RiskLevel; rain: RiskLevel; snow: RiskLevel };
}

export interface RouteOption {
  id: number;
  distance_miles: number;
  duration_seconds: number;
  arrival_time: string;
  geometry: [number, number][];
  risk: {
    miles_by_level: number[];
    average: number;
    worst_level: RiskLevel;
  };
  checkpoints: Checkpoint[];
}

export interface Heatmap {
  start_time: string;
  cell_miles: number;
  points: [number, number][];
  levels: RiskLevel[][];
}

export interface TripPlan {
  origin: Place;
  destination: Place;
  departure_time: string;
  recommended_route_id: number;
  recommendation_reason: string;
  deciding_rule: RankingRule | null;
  routes: RouteOption[];
  heatmap: Heatmap;
}
