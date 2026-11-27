// The one prefix the front is served under: /aplikacija (D-318, DAN-1574). It
// is the basePath of next.config.ts; /app/web and /app/chrome are gone (the
// edge redirects the old addresses). Apart from routes.ts so the screens and
// the config need not import each other.
export const BASE_PATH = "/aplikacija";
export const BASES = [BASE_PATH] as const;
export type Base = (typeof BASES)[number];
export const BASE: Base = BASE_PATH;

/**
 * Next's path of an app route under a base: the browser's path without the
 * basePath, as router.push and router.replace want it (they add the basePath
 * themselves; a path with it would open "/aplikacija/aplikacija/...").
 */
export function nextPath(base: Base, route: string): string {
  return route === "/" ? "/" : route;
}

/**
 * An address from appHref (with the basePath, as a link's href has it) as
 * router.push and router.replace want it: without "/aplikacija", which they
 * add themselves.
 */
export function routerPath(href: string): string {
  if (href === BASE_PATH) return "/";
  return href.startsWith(`${BASE_PATH}/`) ? href.slice(BASE_PATH.length) : href;
}
