import type { MouseEvent } from "react";

/**
 * DAN-1574: the sign-in page belongs to the preloader, which the edge serves at
 * "/prijava" (Preloader#64). The buttons lead to that edge path, not under the base.
 */
export const EDGE_SIGN_IN = "/prijava";

/**
 * The host opens a link to a path of its own pages through the router
 * (Host.tsx), and "/prijava" is one of them; the edge path is a full page load.
 * A plain click is taken here; modified clicks keep the browser's own behaviour.
 */
export function openEdgeSignIn(event: MouseEvent<HTMLAnchorElement>): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  window.location.assign(EDGE_SIGN_IN);
}
