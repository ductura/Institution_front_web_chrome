import { renderToStaticMarkup as html } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DataTable, type DataTableColumn, type DataTableProps } from "./index";
import { compareKeys, nextSort, sortRows } from "./sort";

type Row = { id: string; name: string; at: Date | null };
const rows: Row[] = [
  { id: "1", name: "Šimić (demo)", at: new Date("2026-11-19T10:05:00Z") },
  { id: "2", name: "Anić (demo)", at: null },
  { id: "3", name: "Čavlek (demo)", at: new Date("2026-11-19T09:00:00Z") },
];
const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Student", cell: (r) => r.name, sortValue: (r) => r.name, rowHeader: true },
  { id: "at", header: "Vrijeme predaje", cell: (r) => r.at?.toISOString() ?? "", sortValue: (r) => r.at },
];
const table = (extra: Partial<DataTableProps<Row>> = {}) =>
  html(<DataTable caption="Predaje" columns={columns} rows={rows} rowKey={(r) => r.id} empty="Nema predaja." {...extra} />);
const rowNames = (m: string) => [...m.matchAll(/<th scope="row"[^>]*>([^<]+)</g)].map((x) => x[1]);

describe("DataTable markup (WEB-29)", () => {
  it("has a caption naming a focusable scroll region, column headers and row headers", () => {
    const m = table();
    const id = /<caption id="([^"]+)"/.exec(m)?.[1];
    expect(m).toContain(`role="region" aria-labelledby="${id}" tabindex="0"`);
    expect(m.match(/<th scope="col"/g)).toHaveLength(2);
    expect(rowNames(m)).toEqual(["Šimić (demo)", "Anić (demo)", "Čavlek (demo)"]);
  });

  it("sorts by a key the cell need not show and marks only the sorted header", () => {
    const m = table({ initialSort: { column: "at", direction: "ascending" } });
    expect(rowNames(m)).toEqual(["Čavlek (demo)", "Šimić (demo)", "Anić (demo)"]);
    expect(m.match(/aria-sort="[^"]+"/g)).toEqual(['aria-sort="ascending"']);
    expect(m).toMatch(/<button type="button"[^>]*>Student<span aria-hidden="true"/);
  });

  it("keeps caption and headers for an empty and a loading table", () => {
    const e = table({ rows: [] });
    expect(e).toMatch(/<td colSpan="2"[^>]*>Nema predaja.<\/td>/);
    expect(e).toContain("Vrijeme predaje");
    const l = table({ loading: true });
    expect(l).toMatch(/<table[^>]*aria-busy="true"/);
    expect(l).toMatch(/<td colSpan="2"><div role="status" aria-busy="true"/);
    expect(l).toContain("Učitavanje…");
    expect(l).not.toContain("Šimić");
  });
});

describe("sorting (WEB-29)", () => {
  it("turns the same column around and starts another ascending", () => {
    expect(nextSort(null, "a")).toEqual({ column: "a", direction: "ascending" });
    expect(nextSort({ column: "a", direction: "ascending" }, "a").direction).toBe("descending");
    expect(nextSort({ column: "a", direction: "descending" }, "a").direction).toBe("ascending");
    expect(nextSort({ column: "a", direction: "descending" }, "b")).toEqual({ column: "b", direction: "ascending" });
  });

  it("orders text in Croatian, numbers by value, and keeps missing keys last both ways", () => {
    expect(["Šimić", "Cvitan", "Čavlek", "Anić"].sort(compareKeys)).toEqual(["Anić", "Cvitan", "Čavlek", "Šimić"]);
    expect(compareKeys(2, 10)).toBeLessThan(0);
    const at = (r: Row) => r.at;
    expect(sortRows(rows, at, "ascending").map((r) => r.id)).toEqual(["3", "1", "2"]);
    expect(sortRows(rows, at, "descending").map((r) => r.id)).toEqual(["1", "3", "2"]);
  });

  it("keeps the order of equal keys", () => {
    const same = [{ id: "x" }, { id: "y" }, { id: "z" }];
    expect(sortRows(same, () => 1, "descending").map((r) => r.id)).toEqual(["x", "y", "z"]);
  });
});
