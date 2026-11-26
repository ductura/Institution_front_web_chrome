import type { SystemEvent } from "./read";

/** Newest first; a filter keeps the events whose kind starts with the typed text (case does not matter). */
export function visibleEvents(events: readonly SystemEvent[], prefix: string): SystemEvent[] {
  const wanted = prefix.trim().toLowerCase();
  return [...events].sort((a, b) => b.seq - a.seq).filter((event) => event.kind.startsWith(wanted));
}
