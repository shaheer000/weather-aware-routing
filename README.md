# Weather-Aware Trucking

Helps a truck driver pick the safest route between two places, based on the
weather forecast at each point of the trip, the load weight and travel time.

- **Frontend:** React + TypeScript + MapLibre GL (`frontend/`)
- **Backend:** Django + Django REST Framework (`backend/`)
- **Data (no API keys needed):** OSRM for routes, Open-Meteo for hourly
  forecasts and US place search (called straight from the browser)

## Using the app

1. **Plan page (`/`):** type a US city and pick it from the live dropdown
   (arrow keys + Enter work; "Springfield, MO" ranks Missouri first), then
   set departure, load weight and checkpoint spacing.
2. **Results page (`/results?...`):** the trip lives in the URL, so a reload
   or shared link shows the same plan.
   - **Route options (left):** three routes with drive time, arrival, a
     risk-miles bar and the worst risk. The safest pick is starred.
   - **Why route X?** The ranking rules compared side by side, with the
     row that decided the recommendation highlighted.
   - **Map:** all routes, risk-colored checkpoints, route labels and the
     weather heatmap.
   - **Forecast slider (top of map):** shows weather along the corridor
     for any hour from departure to +48 h, with play/pause. The truck marker
     shows where the selected route puts you at that hour.
   - **Checkpoint timeline (bottom):** every checkpoint with its ETA and
     risk. Selecting one moves the slider to its ETA hour and shows the
     wind, rain and snow values used for it.

## How it works

1. **Places** come from Open-Meteo's geocoder, queried from the browser
   with a 120 ms debounce and an in-memory cache, so the backend receives
   exact coordinates.
2. **Routes:** OSRM returns the fastest route and its alternatives. If it
   offers fewer than three, we add detours through a point pushed sideways
   from the midpoint until there are three distinct routes.
3. **Checkpoints** every 10, 25 or 50 miles along each route, plus the
   destination. Each checkpoint's ETA is interpolated from OSRM's
   per-segment durations.
4. **Weather at ETA:** one batched Open-Meteo request returns hourly wind,
   rain and snowfall. Each checkpoint uses the forecast hour nearest its ETA.
5. **Risk** per checkpoint is the worst of wind, rain and snow
   (`backend/trips/risk.py`):

   | Condition | Low | Moderate | High | Severe | No travel |
   |-----------|-----|----------|------|--------|-----------|
   | Wind (mph) | <25 | 25–34 | 35–44 | 45–54 | ≥55 |
   | Rain (in/hr) | <0.10 | 0.10–0.25 | 0.25–0.50 | 0.50–1.00 | >1.00 |
   | Snow (in/hr) | <0.5 | 0.5–1.0 | 1.0–2.0 | 2.0–3.0 | >3.0 |

   Load rules: 45–54 mph with more than 30,000 lb is No travel. 35–44 mph
   with more than 40,000 lb is Severe.
6. **Risk miles:** each stretch between two checkpoints takes the worse level
   of its two ends.
7. **Recommendation** (`backend/trips/recommendation.py`) ranks routes by
   fewest no-travel miles, then severe miles, then high miles, then lowest
   distance-weighted average risk, then shortest time. The UI shows the rule
   that decided the winner.
8. **Heatmap:** a grid of points covering a band around all routes, with
   risk for every hour from departure to +48 h. Each point carries all 49
   hours, so the slider only swaps a paint expression on the GPU. No refetch
   and no data re-upload.

## Run locally

```bash
# Backend (http://localhost:8000)
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
python manage.py test trips
python manage.py runserver

# Frontend (http://localhost:5173, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

## API

`POST /api/trips/plan/`

```json
{
  "origin": { "name": "Chicago, Illinois, US", "lat": 41.88, "lon": -87.62 },
  "destination": { "name": "Denver, Colorado, US", "lat": 39.74, "lon": -104.98 },
  "departure_time": "2026-10-13T14:00:00Z",
  "load_lb": 35000,
  "checkpoint_interval_miles": 25
}
```

The response has `routes` (geometry, checkpoints with ETA, weather, overall
and per-factor risk levels, miles per risk level), `recommended_route_id`,
`recommendation_reason`, `deciding_rule` and `heatmap`. Risk levels are
integers 0–4 (Low … No travel).

`GET /api/health/` is used for uptime checks.

## Deploy

`render.yaml` is a Render blueprint for both services. Set:

| Service | Variable | Purpose |
|---------|----------|---------|
| backend | `DJANGO_SECRET_KEY`, `DJANGO_DEBUG=false` | Production Django |
| backend | `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS` | Hostnames |
| backend | `OPEN_METEO_API_KEY` (optional) | Higher weather quota |
| frontend | `VITE_API_BASE_URL` | Backend URL |

## Limitations

- The public OSRM server uses a car profile and allows about 1 request/s.
  Truck times will be somewhat longer. Point `OSRM_BASE_URL` at a self-hosted
  OSRM with a truck profile to fix that.
- Open-Meteo's free tier counts each location as a call (10k a day). Points
  are snapped to about 7 miles and cached for 30 minutes to stay within quota.
- Forecast data reaches 7 days ahead, so departures are limited to that.
- Detour routes can include a short out-and-back where the via point lands
  on a side road.
