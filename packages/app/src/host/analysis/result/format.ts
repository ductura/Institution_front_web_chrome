import { resultMessages as t } from "./messages.hr";

const MAX_DECIMALS = 6;
const number = new Intl.NumberFormat("hr-HR", { maximumFractionDigits: MAX_DECIMALS, useGrouping: false });
const percent = new Intl.NumberFormat("hr-HR", { maximumFractionDigits: 1, useGrouping: false });

/**
 * A number the way the screen shows it: the Croatian decimal comma, at most 6 decimals (the server's own precision).
 * `null` is "not defined" (n too small, zero variance) and is never shown as 0; `-0` is shown as 0.
 */
export function formatNumber(value: number | null): string {
  if (value === null) return t.undefinedValue;
  if (!Number.isFinite(value)) return t.undefinedValue;
  return number.format(Object.is(value, -0) ? 0 : value);
}

/** A share between 0 and 1 as a percentage with one decimal ("12,5 %"); `null` is "not defined". */
export function formatShare(share: number | null): string {
  if (share === null || !Number.isFinite(share)) return t.undefinedValue;
  const value = share * 100;
  return `${percent.format(Object.is(value, -0) ? 0 : value)} %`;
}

/** Only a lower-case SHA-256 digest of 64 hex characters is shown or copied. */
export const isDigest = (value: string): boolean => /^[0-9a-f]{64}$/.test(value);

/** The digest in groups of four for reading; the copied text has no spaces. */
export const groupDigest = (value: string): string => value.match(/.{4}/g)?.join(" ") ?? value;

/** The variables of a correlation, in the order they first appear in the pairs. */
export function correlationVariables(pairs: readonly { a: string; b: string }[]): string[] {
  const names: string[] = [];
  for (const { a, b } of pairs) for (const name of [a, b]) if (!names.includes(name)) names.push(name);
  return names;
}

export type MatrixRow = { readonly name: string; readonly cells: readonly (number | null | "diagonal" | "missing")[] };

/**
 * The correlation matrix of the pairs: symmetric, the diagonal marked as such (not 1, since a column with zero
 * variance has no defined r with itself), a pair the server did not send marked "missing", `null` kept as `null`.
 * The order is the order of appearance, never sorted by the value of r.
 */
export function correlationMatrix(pairs: readonly { a: string; b: string; r: number | null }[]): MatrixRow[] {
  const names = correlationVariables(pairs);
  const lookup = new Map<string, number | null>();
  for (const { a, b, r } of pairs) { lookup.set(`${a}\u0000${b}`, r); lookup.set(`${b}\u0000${a}`, r); }
  return names.map((row) => ({
    name: row,
    cells: names.map((column) => {
      if (row === column) return "diagonal" as const;
      const key = `${row}\u0000${column}`;
      return lookup.has(key) ? (lookup.get(key) ?? null) : ("missing" as const);
    }),
  }));
}
