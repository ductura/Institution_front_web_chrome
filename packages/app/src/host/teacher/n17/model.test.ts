import { describe, expect, it } from "vitest";
import { FAKE_CARDS } from "./fake-port";
import { filteredRows, groupFilterOptions, stateFilterOptions, afterDeadlineText, loadN17, recordText, revisionText, sortedRows, stateText, summaryLine, timeText, workHref } from "./model";
import { n17Messages as m } from "./messages.hr";

const rows = FAKE_CARDS[0]!.rows!;

describe("N-17 model", () => {
  it("says the state in words, including writing and unconfirmed", () => {
    expect(rows.map(stateText)).toEqual(["predano", "u pisanju, rok produljen", "u pisanju", "obavijest nije potvrđena"]);
    expect(stateText({ ...rows[2]!, phase: undefined })).toBe("nije predano");
  });
  it("uses nema / da / ne and the record in words", () => {
    expect(rows.map(timeText)[1]).toBe("nema");
    expect(afterDeadlineText(rows[0]!)).toBe("ne");
    expect(afterDeadlineText({ ...rows[0]!, afterDeadline: true })).toBe("da");
    expect(afterDeadlineText(rows[1]!)).toBe("nema");
    expect(recordText(rows[0]!)).toBe("ima praznine");
    expect(recordText({ ...rows[0]!, evidenceRecord: "continuous" })).toBe("cjelovit");
    expect(recordText({ ...rows[0]!, evidenceRecord: null })).toBe("čeka potvrdu");
    expect(recordText(rows[1]!)).toBe("nema");
  });
  it("shows the revision as text and unavailable when the read omits it", () => {
    expect(revisionText(rows[0]!)).toBe("zatražena · otvorena");
    expect(revisionText(rows[1]!)).toBe("nije zatražena");
    expect(revisionText(rows[2]!)).toBe("nedostupno");
  });
  it("builds the meta line without zero counts", () => {
    expect(summaryLine(rows)).toBe("predano 1, u pisanju 2, obavijest nije potvrđena 1");
    expect(summaryLine([{ ...rows[0]!, afterDeadline: true }, { ...rows[2]!, phase: undefined }])).toBe("predano 1 (od toga 1 nakon roka), nije predano 1");
    expect(summaryLine([])).toBe(m.summary.noRows);
  });
  it("sorts by surname, no name last", () => {
    expect(sortedRows(rows).map((r) => r.name)).toEqual(["Marko Babić", "Ana Horvat", "Iva Kovač", null]);
  });
  it("links only a safe document id", () => {
    expect(workHref(rows[0]!)).toBe("/nastavnik/rad/doc-a");
    expect(workHref({ ...rows[0]!, documentId: "../x" })).toBeNull();
    expect(workHref(rows[2]!)).toBeNull();
  });
  it("turns a throwing port into unavailable", async () => {
    expect(await loadN17({ read: async () => { throw new Error("x"); } })).toEqual({ kind: "unavailable" });
  });
  it("filters rows by state and group, and counts per state (NAS-R15)", () => {
    const all = [...rows, { ...rows[2]!, studentId: "s-5", name: "Eva Novak", group: "Grupa 2", phase: "notStarted" as const }];
    expect(filteredRows(all, "", "")).toHaveLength(5);
    expect(filteredRows(all, "notStarted", "").map((r) => r.studentId)).toEqual(["s-4", "s-5"]);
    expect(filteredRows(all, "writing", "").map((r) => r.studentId)).toEqual(["s-2", "s-3"]);
    expect(filteredRows(all, "submitted", "Grupa 2").map((r) => r.studentId)).toEqual(["s-1"]);
    expect(filteredRows(all, "late", "")).toEqual([]);
    expect(filteredRows(all, "revision", "").map((r) => r.studentId)).toEqual(["s-1"]);
    expect(filteredRows(all, "", "Grupa 9")).toEqual([]);
    expect(stateFilterOptions(all)[0]!.label).toBe("Sva stanja (5)");
    expect(stateFilterOptions(all).find((o) => o.value === "notStarted")!.label).toBe("Nije započelo (2)");
    expect(groupFilterOptions(all).map((o) => o.label)).toEqual(["Sve grupe (5)", "Grupa 2 (2)", "Grupa 4 (1)"]);
    expect(groupFilterOptions([rows[2]!])).toEqual([]);
  });
});
