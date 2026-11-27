// ED-109: "Navod" in the bubble beside a selection opens the same citation popover as the "Navod" button.
const OPEN_CITE = "ductura:open-cite";

/** Asks the citation popover on this page to open at the caret. */
export function requestCiteOpen(): void {
  try { window.dispatchEvent(new CustomEvent(OPEN_CITE)); } catch { /* no window: nothing listens */ }
}

/** Calls `open` whenever someone asks for the citation popover; returns the unsubscribe. */
export function onCiteOpen(open: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(OPEN_CITE, open);
  return () => window.removeEventListener(OPEN_CITE, open);
}
