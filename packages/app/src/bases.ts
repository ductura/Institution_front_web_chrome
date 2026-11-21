// The two prefixes the front is served under (#2028 c.6993786629 §1). Apart
// from routes.ts, so app/[base]/ can check its segment without the screens.
export const BASES = ["/app/web", "/app/chrome"] as const;
export type Base = (typeof BASES)[number];

/** The base of a segment of app/[base]/, or null when it is neither. */
export function baseOfSegment(segment: string): Base | null {
  return BASES.find((b) => b === `/app/${segment}`) ?? null;
}

/**
 * Next's path of an app route under a base: the browser's path without the
 * basePath "/app", as router.push and router.replace want it (they add the
 * basePath themselves; a path with it would open "/app/app/...").
 */
export function nextPath(base: Base, route: string): string {
  return (route === "/" ? `${base}/` : `${base}${route}`).slice("/app".length);
}
