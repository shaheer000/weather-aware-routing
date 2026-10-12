const dayTimeFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

const clockFormat = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: "short" });

export function formatTime(iso: string): string {
  return dayTimeFormat.format(new Date(iso));
}

export function formatClock(iso: string): string {
  return clockFormat.format(new Date(iso));
}

export function formatWeekday(iso: string): string {
  return weekdayFormat.format(new Date(iso));
}

export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}

export function formatMiles(miles: number): string {
  return `${Math.round(miles).toLocaleString()} mi`;
}

export function formatPounds(pounds: number): string {
  return `${pounds.toLocaleString()} lb`;
}

export function shortPlaceName(name: string): string {
  return name.split(",")[0];
}

export function routeLetter(routeId: number): string {
  return String.fromCharCode(65 + routeId);
}
