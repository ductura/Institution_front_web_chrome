export type SortDirection = "ascending" | "descending";
export type SortState = { column: string; direction: SortDirection };
/** What a column sorts by; it may differ from what the cell shows (a time shown in Europe/Zagreb sorts by its instant). */
export type SortKey = string | number | Date | null | undefined;

/** A header press: the same column turns around, another column starts ascending. */
export function nextSort(current: SortState | null, column: string): SortState {
  if (current?.column === column) {
    return { column, direction: current.direction === "ascending" ? "descending" : "ascending" };
  }
  return { column, direction: "ascending" };
}

const collator = new Intl.Collator("hr", { numeric: true, sensitivity: "base" });

const missing = (key: SortKey) => key === null || key === undefined || (key instanceof Date && Number.isNaN(key.getTime()));

/** Compares two keys ascending: numbers and dates by value, text in Croatian order. */
export function compareKeys(a: SortKey, b: SortKey): number {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  if (typeof x === "number" && typeof y === "number") return x - y;
  return collator.compare(String(x), String(y));
}

/** A sorted copy; equal keys keep their order and missing keys stay last in both directions. */
export function sortRows<R>(rows: readonly R[], key: (row: R) => SortKey, direction: SortDirection): R[] {
  const sign = direction === "ascending" ? 1 : -1;
  return [...rows].sort((r1, r2) => {
    const a = key(r1);
    const b = key(r2);
    if (missing(a) || missing(b)) return Number(missing(a)) - Number(missing(b));
    return sign * compareKeys(a, b);
  });
}
