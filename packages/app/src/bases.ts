// The two prefixes the front is served under (#2028 c.6993786629 §1). Apart
// from routes.ts, so app/[base]/ can check its segment without the screens.
export const BASES = ["/app/web", "/app/chrome"] as const;
export type Base = (typeof BASES)[number];

/** The base of a segment of app/[base]/, or null when it is neither. */
export function baseOfSegment(segment: string): Base | null {
  return BASES.find((b) => b === `/app/${segment}`) ?? null;
}
