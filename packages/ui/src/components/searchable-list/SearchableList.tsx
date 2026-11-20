"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { TextField } from "../TextField";
import { searchableListHr as t } from "./messages.hr";
import { filterItems, type SearchableListItem } from "./search";
import styles from "./SearchableList.module.css";

export type SearchableListProps<T extends SearchableListItem = SearchableListItem> = {
  items: readonly T[];
  onSelect: (item: T) => void;
  label?: string;
  resultsLabel?: string;
  emptyMessage?: string;
  noResultsMessage?: string;
  pending?: boolean;
  disabled?: boolean;
  error?: string;
};

export function SearchableList<T extends SearchableListItem>({
  items, onSelect, label = t.search, resultsLabel = t.results, emptyMessage = t.empty,
  noResultsMessage = t.noResults, pending = false, disabled = false, error,
}: SearchableListProps<T>) {
  const listId = useId();
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const results = pending || error ? [] : filterItems(items, query);
  const active = disabled ? -1 : results.findIndex((item) => item.id === activeId);
  const status = pending ? t.loading : error ? null : items.length === 0 ? emptyMessage : results.length === 0 ? noResultsMessage : null;

  useEffect(() => {
    if (active >= 0) list.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (disabled || !results.length || event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const last = results.length - 1;
      const index = event.key === "ArrowDown" ? Math.min(last, active + 1) : active < 0 ? last : Math.max(0, active - 1);
      setActiveId(results[index]?.id ?? null);
    } else if (event.key === "Enter") {
      const item = results[Math.max(0, active)];
      if (item) {
        event.preventDefault();
        onSelect(item);
      }
    }
  }

  return (
    <div className={styles.search}>
      <TextField type="search" role="combobox" label={label} autoComplete="off" value={query}
        disabled={disabled} busy={pending} aria-autocomplete="list" aria-controls={listId} aria-expanded={results.length > 0}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        onChange={(event) => { setQuery(event.currentTarget.value); setActiveId(null); }}
        onKeyDown={keyDown} onBlur={() => setActiveId(null)} />
      <ul id={listId} ref={list} role="listbox" aria-label={resultsLabel} aria-disabled={disabled || undefined}
        hidden={results.length === 0} className={styles.list}>
        {results.map((item, index) => (
          <li key={item.id} id={`${listId}-${index}`} role="option" aria-selected={index === active}
            onMouseDown={(event) => event.preventDefault()} onClick={() => { if (!disabled) onSelect(item); }}>
            {item.label}{item.description && <small>{item.description}</small>}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      <div role="status">{status}</div>
    </div>
  );
}
