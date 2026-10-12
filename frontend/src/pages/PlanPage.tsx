import { useNavigate, useSearchParams } from "react-router-dom";

import { AppHeader } from "../components/AppHeader";
import { BackdropMap } from "../components/BackdropMap";
import { Icon, type IconName } from "../components/Icon";
import { TripForm } from "../components/TripForm";
import { fromSearchParams, toSearchParams } from "../tripParams";
import type { TripRequest } from "../types";

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "route",
    title: "3 route options",
    text: "Fastest road route plus two real alternatives.",
  },
  {
    icon: "clock",
    title: "Weather at your ETA",
    text: "Forecast for the hour you reach each checkpoint, not right now.",
  },
  {
    icon: "gauge",
    title: "Risk for your load",
    text: "Wind, rain and snow limits tighten as the load gets heavier.",
  },
];

export function PlanPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  function handleSubmit(request: TripRequest) {
    navigate(`/results?${toSearchParams(request)}`);
  }

  return (
    <div className="plan-page">
      <BackdropMap />
      <AppHeader />
      <main className="plan-layout">
        <section className="plan-intro">
          <p className="eyebrow">Route planner for truck drivers</p>
          <h1>Pick the safest route, not just the fastest.</h1>
          <ul className="feature-list">
            {FEATURES.map(({ icon, title, text }) => (
              <li key={title}>
                <span className="feature-icon">
                  <Icon name={icon} size={18} />
                </span>
                <div>
                  <strong>{title}</strong>
                  <p>{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="plan-card" aria-label="Plan a trip">
          <h2>Plan a trip</h2>
          <TripForm
            initialRequest={fromSearchParams(searchParams)}
            onSubmit={handleSubmit}
          />
        </section>
      </main>
    </div>
  );
}
