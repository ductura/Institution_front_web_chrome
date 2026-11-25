const seenHere = new Set<string>();

type Store = () => Pick<Storage, "getItem" | "setItem">;

export function onboardingKey(scope: string) {
  return `ductura:editor-onboarding:v1:${scope}`;
}

/** ED-05 (NF2-P20): whether this account finished or skipped the guide. Showing it marks nothing. */
export function onboardingSeen(key: string, storage: Store): boolean {
  try {
    return storage().getItem(key) === "1" || seenHere.has(key);
  } catch {
    return seenHere.has(key);
  }
}

/** Written only by "Završi vodič" and "Preskoči vodič": a guide left open or closed with Esc comes back. */
export function markOnboardingSeen(key: string, storage: Store): void {
  seenHere.add(key);
  try {
    storage().setItem(key, "1");
  } catch { /* Kept for this page only. */ }
}
