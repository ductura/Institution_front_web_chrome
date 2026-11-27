/**
 * DAN-1574 (address map D-318): the sign-in, download and help pages belong to
 * the preloader, which the edge serves at absolute paths (Preloader#64, pair
 * PRE-1574). The links lead to those edge paths, never under the app base
 * (so not `appHref`).
 */
export const EDGE_SIGN_IN = "/ulaz";
export const EDGE_HOME = "/";
export const EDGE_DOWNLOADS = "/preuzimanja";

/** The footer links, in order: help, contact, terms, privacy, accessibility, status. */
export const EDGE_FOOTER = {
  help: "/pomoc",
  contact: "/kontakt",
  terms: "/uvjeti-koristenja",
  privacy: "/privatnost",
  accessibility: "/pristupacnost",
  status: "/stanje",
} as const;

/**
 * The host opens a link to a path of its own pages through the router
 * (Host.tsx); it leaves links with a target other than "_self" to the browser.
 * "_top" is the same window, so an edge path opens as a full page load (no
 * `location`, which only api.ts may use).
 */
const edgeLink = <H extends string>(href: H) => ({ href, target: "_top" }) as const;

export const EDGE_LINK = edgeLink(EDGE_SIGN_IN);
export const EDGE_HOME_LINK = edgeLink(EDGE_HOME);
export const EDGE_DOWNLOADS_LINK = edgeLink(EDGE_DOWNLOADS);
export { edgeLink };
