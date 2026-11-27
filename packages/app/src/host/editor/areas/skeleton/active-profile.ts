// WEB-DIZ-B-V21: the rule profile the student has chosen for this work, handed from "Zahtjevi rada" (RulesHost) to the
// toolbar, so that "Kostur rada" and the formula and code tools follow the profile instead of the general one.
// Held in memory for the page's lifetime; until a profile is chosen the toolbar keeps the general academic work.
import { useSyncExternalStore } from "react";

import { profileById, type RuleProfile } from "../../rules/profiles";

let current: string | null = null;
const listeners = new Set<() => void>();

/** Names the chosen profile (or none); only a known profile id is kept. */
export function setActiveProfile(id: string | null): void {
  const next = id !== null && profileById(id) ? id : null;
  if (next === current) return;
  current = next;
  listeners.forEach((listener) => listener());
}

export const activeProfile = (): RuleProfile | null => (current === null ? null : profileById(current) ?? null);

/** The profile the work is written for, or null while none was chosen. */
export function useActiveProfile(): RuleProfile | null {
  const id = useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => current,
    () => null,
  );
  return id === null ? null : profileById(id) ?? null;
}
