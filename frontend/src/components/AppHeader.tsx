import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface AppHeaderProps {
  children?: ReactNode;
}

export function AppHeader({ children }: AppHeaderProps) {
  return (
    <header className="app-header">
      <Link to="/" className="brand-mark">
        <img src="/favicon.svg" alt="" width={24} height={24} />
        <span>Weather-Aware Trucking</span>
      </Link>
      {children}
    </header>
  );
}
