/** The count shown on the bell: nothing for none, "99+" beyond two digits. */
export function badgeText(unread: number): string {
  if (!Number.isFinite(unread) || unread <= 0) return "";
  return unread > 99 ? "99+" : String(Math.floor(unread));
}

/** The text read out when the count changes, or "" when it did not (no announcement on first render). */
export function announcement(previous: number | null, unread: number, say: (unread: number) => string): string {
  if (previous === null || previous === unread) return "";
  return say(unread);
}
