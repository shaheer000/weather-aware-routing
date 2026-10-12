import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";

import {
  type PlaceSuggestion,
  cachedSuggestions,
  searchPlaces,
} from "../placeSearch";
import type { Place } from "../types";
import { Icon, type IconName } from "./Icon";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DELAY_MS = 120;

type SearchStatus = "idle" | "loading" | "done" | "error";

interface PlaceInputProps {
  label: string;
  icon: IconName;
  placeholder: string;
  value: Place | null;
  onChange: (place: Place | null) => void;
}

export function PlaceInput({
  label,
  icon,
  placeholder,
  value,
  onChange,
}: PlaceInputProps) {
  const listId = useId();
  const [query, setQuery] = useState(value?.name ?? "");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [isTouched, setIsTouched] = useState(false);
  // Enter pressed before results arrived: pick the top match once they do.
  const isCommitPendingRef = useRef(false);

  useEffect(() => {
    if (value) setQuery(value.name);
  }, [value]);

  useEffect(() => {
    if (value || query.trim().length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }
    const cached = cachedSuggestions(query);
    if (cached) {
      showResults(cached);
      return;
    }
    // Keep the previous list on screen while the next one loads.
    setStatus("loading");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchPlaces(query, controller.signal)
        .then(showResults)
        .catch(() => {
          if (!controller.signal.aborted) setStatus("error");
        });
    }, SEARCH_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, value]);

  function showResults(places: PlaceSuggestion[]) {
    setSuggestions(places);
    setActiveIndex(0);
    setStatus("done");
    if (isCommitPendingRef.current && places.length) choose(places[0]);
    isCommitPendingRef.current = false;
  }

  function choose(place: PlaceSuggestion) {
    onChange({ name: place.name, lat: place.lat, lon: place.lon });
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (event.key === "Enter" && status === "loading") {
      event.preventDefault();
      isCommitPendingRef.current = true;
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex(
        (index) => (index + step + suggestions.length) % suggestions.length,
      );
    } else if (event.key === "Enter" || (event.key === "Tab" && isOpen)) {
      if (event.key === "Enter") event.preventDefault();
      choose(suggestions[activeIndex]);
    }
  }

  function handleBlur() {
    setIsOpen(false);
    setIsTouched(true);
    // Typing the full name of the top match counts as choosing it.
    const top = suggestions[0];
    const typed = query.trim().toLowerCase();
    const isExactMatch =
      top && [top.title, top.name].some((name) => name.toLowerCase() === typed);
    if (!value && isExactMatch) choose(top);
  }

  function clear() {
    setQuery("");
    onChange(null);
    setIsOpen(true);
  }

  const hasQuery = query.trim().length >= MIN_QUERY_LENGTH;
  const showList = isOpen && hasQuery && !value;
  const showMissingHint = isTouched && !isOpen && !value && query.trim() !== "";

  return (
    <div className="place-input">
      <label className="field-label" htmlFor={`${listId}-input`}>
        {label}
      </label>
      <div className={`input-shell${value ? " is-chosen" : ""}`}>
        <Icon name={icon} />
        <input
          id={`${listId}-input`}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            showList && suggestions.length
              ? `${listId}-option-${activeIndex}`
              : undefined
          }
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            isCommitPendingRef.current = false;
            setQuery(event.target.value);
            setIsOpen(true);
            if (value) onChange(null);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
        />
        {status === "loading" && (
          <span className="input-spinner" aria-hidden="true" />
        )}
        {value && <Icon name="check" />}
        {query && (
          <button
            type="button"
            className="clear-button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clear}
            aria-label={`Clear ${label}`}
          >
            <Icon name="close" size={14} />
          </button>
        )}
      </div>

      {showList && (
        <ul className="suggestions" id={listId} role="listbox">
          {suggestions.map((place, index) => (
            <li
              key={`${place.lat},${place.lon}`}
              id={`${listId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => {
                event.preventDefault();
                choose(place);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <Icon name="pin" size={14} />
              <span className="suggestion-text">
                <span className="suggestion-title">
                  <HighlightMatch text={place.title} query={query} />
                </span>
                <span className="suggestion-subtitle">{place.subtitle}</span>
              </span>
            </li>
          ))}
          {status === "done" && !suggestions.length && (
            <li className="suggestion-empty">No places match "{query}"</li>
          )}
          {status === "loading" && !suggestions.length && (
            <li className="suggestion-empty">Searching…</li>
          )}
          {status === "error" && (
            <li className="suggestion-empty">
              Place search is unavailable. Check your connection.
            </li>
          )}
        </ul>
      )}

      {showMissingHint && (
        <p className="field-error">Pick a place from the suggestions.</p>
      )}
    </div>
  );
}

function HighlightMatch({ text, query }: { text: string; query: string }) {
  const typed = query.split(",")[0].trim();
  if (!text.toLowerCase().startsWith(typed.toLowerCase())) return <>{text}</>;
  return (
    <>
      <mark>{text.slice(0, typed.length)}</mark>
      {text.slice(typed.length)}
    </>
  );
}
