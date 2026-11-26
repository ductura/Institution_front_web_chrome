/**
 * DAN-1574: the sign-in page belongs to the preloader, which the edge serves at
 * "/prijava" (Preloader#64). The buttons lead to that edge path, not under the base.
 */
export const EDGE_SIGN_IN = "/prijava";

/**
 * The host opens a link to a path of its own pages through the router
 * (Host.tsx), and "/prijava" is one of them; it leaves links with a target
 * other than "_self" to the browser. "_top" is the same window, so the edge
 * path opens as a full page load (no `location`, which only api.ts may use).
 */
export const EDGE_LINK = { href: EDGE_SIGN_IN, target: "_top" } as const;
