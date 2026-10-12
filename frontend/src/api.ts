import type { TripPlan, TripRequest } from "./types";

// Empty in development: Vite proxies /api to the Django server.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export async function planTrip(
  request: TripRequest,
  signal?: AbortSignal,
): Promise<TripPlan> {
  return requestJson("/api/trips/plan/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(errorMessage(body));
  }
  return body;
}

// DRF returns {detail}, {field: [messages]} or {non_field_errors: [...]}.
function errorMessage(body: Record<string, unknown>): string {
  if (typeof body.detail === "string") {
    return body.detail;
  }
  const firstError = Object.values(body).flat(2)[0];
  return typeof firstError === "string"
    ? firstError
    : "Something went wrong. Please try again.";
}
