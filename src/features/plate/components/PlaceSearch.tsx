import { useId, useState, type FormEvent } from "react";
import { ArrowRight, Search } from "lucide-react";
import { useLocationAutocomplete } from "@/hooks/useLocationAutocomplete";
import { useI18n } from "@/context/i18n/context";
import type { SearchResult } from "@/services/location/types";
import { searchLocations } from "@/services/container";

interface PlaceSearchProps {
  onSelect: (place: SearchResult) => void;
}

export default function PlaceSearch({ onSelect }: PlaceSearchProps) {
  const { t } = useI18n();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [empty, setEmpty] = useState(false);
  const { locationSuggestions, isLocationSearching, clearLocationSuggestions } =
    useLocationAutocomplete(query, focused);

  const choose = (place: SearchResult) => {
    onSelect(place);
    setQuery("");
    setActive(-1);
    clearLocationSuggestions();
    (document.activeElement as HTMLElement | null)?.blur();
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (active >= 0 && locationSuggestions[active]) return choose(locationSuggestions[active]);
    if (query.trim().length < 2) return;
    const [first] = locationSuggestions.length
      ? locationSuggestions
      : await searchLocations(query.trim(), 1).catch(() => []);
    if (first) choose(first);
    else setEmpty(true);
  };

  const open = focused && query.trim().length >= 2;

  return (
    <form className="plate-search" role="search" onSubmit={submit}>
      <Search className="plate-search__icon" size={20} aria-hidden="true" />
      <input
        type="search"
        enterKeyHint="search"
        autoComplete="off"
        className="plate-search__input"
        placeholder={t("plate.search")}
        aria-label={t("plate.search")}
        role="combobox"
        aria-expanded={open && locationSuggestions.length > 0}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setEmpty(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            const step = event.key === "ArrowDown" ? 1 : -1;
            const count = locationSuggestions.length;
            if (count) setActive((index) => (index + step + count) % count);
          }
        }}
      />
      <button type="submit" className="plate-search__go" aria-label={t("plate.searchGo")}>
        <ArrowRight size={22} />
      </button>
      {open && (
        <ul id={listId} className="plate-search__results" role="listbox">
          {locationSuggestions.map((place, index) => (
            <li
              key={place.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className="plate-search__result"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(place)}
            >
              <strong>
                {place.shortLabel}
                {place.nameKm && place.nameKm !== place.shortLabel && (
                  <span className="plate-search__khmer" lang="km">
                    {" "}
                    · {place.nameKm}
                  </span>
                )}
              </strong>
              <span>{place.label.split(",").slice(1, 3).join(",").trim()}</span>
            </li>
          ))}
          {locationSuggestions.length === 0 && (isLocationSearching || empty) && (
            <li className="plate-search__status" role="status">
              {isLocationSearching ? t("plate.searching") : t("plate.noResults")}
            </li>
          )}
        </ul>
      )}
    </form>
  );
}
