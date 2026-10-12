import type { Place } from "./types";

// Open-Meteo's geocoder is built for search-as-you-type and allows CORS,
// so the browser calls it directly instead of going through our backend.
const GEOCODER_URL = "https://geocoding-api.open-meteo.com/v1/search";
// The risk rules use US units (mph, in/hr, lb), so search US places only.
const COUNTRY_CODE = "US";
const FETCH_COUNT = 10;
const MAX_SUGGESTIONS = 6;

const US_STATE_CODES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR",
  California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI",
  Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC",
  "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR",
  Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

export interface PlaceSuggestion extends Place {
  title: string;
  subtitle: string;
}

interface GeocoderResult {
  name: string;
  latitude: number;
  longitude: number;
  admin1?: string;
}

const cache = new Map<string, PlaceSuggestion[]>();

/** Instant answer when this city name was searched before, else undefined. */
export function cachedSuggestions(
  query: string,
): PlaceSuggestion[] | undefined {
  const { city, qualifier } = splitQuery(query);
  const results = cache.get(city);
  return results && rank(results, city, qualifier);
}

export async function searchPlaces(
  query: string,
  signal: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const { city, qualifier } = splitQuery(query);
  let results = cache.get(city);
  if (!results) {
    const params = new URLSearchParams({
      name: city,
      count: String(FETCH_COUNT),
      countryCode: COUNTRY_CODE,
      language: "en",
    });
    const response = await fetch(`${GEOCODER_URL}?${params}`, { signal });
    if (!response.ok) throw new Error("Place search is unavailable.");
    const body: { results?: GeocoderResult[] } = await response.json();
    results = (body.results ?? []).map(toSuggestion);
    cache.set(city, results);
  }
  return rank(results, city, qualifier);
}

// "Springfield, MO" searches "springfield" and ranks Missouri first.
function splitQuery(query: string) {
  const [city, ...rest] = query.toLowerCase().split(",");
  return {
    city: city.trim().replace(/\s+/g, " "),
    qualifier: rest.join(" ").trim(),
  };
}

function rank(results: PlaceSuggestion[], city: string, qualifier: string) {
  // The geocoder also returns fuzzy alternate-name hits; prefer real prefixes.
  const prefixed = results.filter((place) =>
    place.title.toLowerCase().startsWith(city),
  );
  const candidates = prefixed.length ? prefixed : results;
  const inRegion = (place: PlaceSuggestion) =>
    place.subtitle.toLowerCase().includes(qualifier);
  const ranked = qualifier
    ? [
        ...candidates.filter(inRegion),
        ...candidates.filter((place) => !inRegion(place)),
      ]
    : candidates;
  return ranked.slice(0, MAX_SUGGESTIONS);
}

function toSuggestion(result: GeocoderResult): PlaceSuggestion {
  const state = result.admin1 ?? "";
  const stateLabel = US_STATE_CODES[state]
    ? `${state} (${US_STATE_CODES[state]})`
    : state;
  return {
    title: result.name,
    subtitle: stateLabel,
    name: [result.name, US_STATE_CODES[state] ?? state]
      .filter(Boolean)
      .join(", "),
    lat: result.latitude,
    lon: result.longitude,
  };
}
