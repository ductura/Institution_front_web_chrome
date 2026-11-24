import { describe, expect, it } from "vitest";

import type { CommentThread } from "../../../../../../../src/client/comments";
import { readOfParts } from "../../../student/work/origin/model";
import type { OriginComposition } from "../../provenance/origin";
import { compositionRows, givenRows, hasUnknown, importantPlaces, noteRows } from "./pg-model";

const composition = (parts: { kind: string; percent: number }[]): OriginComposition => {
  const read = readOfParts(parts);
  if (read.kind !== "ready") throw new Error("expected a composition");
  return read.composition;
};
const SUMMARY = {
  summaryFormat: "ductus-process-summary-v1",
  sessions: { evidenceKind: "observed", breakAboveMinutes: 30, count: 0, items: [] },
  pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [
    { at: { from: "2026-11-10T09:40:00.000Z", to: "2026-11-10T09:40:00.000Z" }, characters: 420, origin: "not_observed" },
  ] },
  gaps: { evidenceKind: "observed", items: [{ previousEndedAt: "2026-11-09T10:00:00.000Z", nextStartedAt: "2026-11-09T12:00:00.000Z" }] },
  recordState: "has_gaps",
} as never;

describe("PG-3 compositionRows", () => {
  it("gives every kind with a share its own row, with what it means and what it does not, and „nije dokaz autorstva”", () => {
    const rows = compositionRows(composition([
      { kind: "typed", percent: 70 }, { kind: "assistant_inserted", percent: 10 }, { kind: "assistant_match", percent: 8 },
      { kind: "pasted_unknown", percent: 12 },
    ]));
    expect(rows.map((r) => r.kind)).toEqual(["typed", "assistant_inserted", "assistant_match", "pasted_unknown"]);
    for (const row of rows) {
      expect(row.share).toContain("nije dokaz autorstva");
      expect(row.means).not.toBe("");
      expect(row.notMeans).not.toBe("");
    }
    expect(rows[2]!.notMeans).toContain("Ništa ne govori o autorstvu");
  });

  it("leaves out a kind without a share and flags unknown origin", () => {
    const c = composition([{ kind: "typed", percent: 100 }]);
    expect(compositionRows(c)).toHaveLength(1);
    expect(hasUnknown(c)).toBe(false);
    expect(hasUnknown(composition([{ kind: "typed", percent: 90 }, { kind: "pasted_unknown", percent: 10 }]))).toBe(true);
  });
});

describe("PG-5 importantPlaces", () => {
  it("lists pastes, gaps and transfers in time order", () => {
    const places = importantPlaces(SUMMARY, { activeEditingMinutes: 5, keyEvents: [{ kind: "ai-transfer", at: { from: "2026-11-10T09:10:00.000Z", to: "2026-11-10T09:10:00.000Z" } }] });
    expect(places.map((p) => p.key)).toEqual(["gap:0", "event:0", "paste:0"]);
    expect(places[2]!.what).toBe("Lijepljenje, 420 znakova");
  });
  it("is empty for a record with nothing to note, and works without details", () => {
    const empty = { ...(SUMMARY as object), pastes: { evidenceKind: "observed", listedAboveCharacters: 200, smallerCount: 0, listed: [] }, gaps: { evidenceKind: "observed", items: [] } } as never;
    expect(importantPlaces(empty, null)).toEqual([]);
    expect(importantPlaces(SUMMARY, null)).toHaveLength(2);
  });
});

describe("PG-7 noteRows", () => {
  it("names the kind and keeps the server's order", () => {
    const rows = noteRows([
      { id: "a", eventId: "e1", kind: "dispute", text: "Izmišljeno objašnjenje.", createdWindow: "2026-11-11T10:00:00.000Z" },
      { id: "b", eventId: "e2", kind: "supplement", text: "Izmišljena dopuna.", createdWindow: "2026-11-10T10:00:00.000Z" },
    ]);
    expect(rows.map((r) => r.key)).toEqual(["a", "b"]);
    expect(rows[0]!.head.startsWith("Prigovor")).toBe(true);
    expect(rows[1]!.head.startsWith("Dopuna")).toBe(true);
    expect(rows.map((r) => r.event)).toEqual(["Događaj 1", "Događaj 2"]);
  });
});

describe("PG-9 givenRows", () => {
  const threads: CommentThread[] = [{ id: "t1", number: 1, state: "open", anchor: null, revision: 1, comments: [
    { id: "c1", role: "teacher", isOwn: true, body: "Izmišljen komentar.", createdWindow: "2026-11-12T10:00:00.000Z", deletedWindow: null },
    { id: "c2", role: "student", isOwn: false, body: null, createdWindow: "2026-11-13T10:00:00.000Z", deletedWindow: "2026-11-13T11:00:00.000Z" },
  ] }];
  it("merges published comments and drafts by time and marks a draft as not published", () => {
    const rows = givenRows(threads, [
      { id: "d1", body: "Nacrt.", state: "draft", savedAt: "2026-11-12T12:00:00.000Z" },
      { id: "d2", body: "Već objavljeno.", state: "published", savedAt: "2026-11-12T09:00:00.000Z" },
    ]);
    expect(rows.map((r) => [r.key, r.state])).toEqual([["c:c1", "published"], ["d:d1", "draft"], ["c:c2", "student"]]);
    expect(rows[2]!.deleted).toBe(true);
    expect(rows[2]!.what).toBe("Student je obrisao ovaj odgovor.");
    expect(rows[2]!.state).toBe("student");
    expect(rows[0]!.who).toBe("Vaš komentar");
  });
  it("does not call the comment of another teacher or mentor the viewer's own", () => {
    const other: CommentThread[] = [{ ...threads[0]!, comments: [{ ...threads[0]!.comments[0]!, isOwn: false }] }];
    expect(givenRows(other, [])[0]!.who).toBe("Komentar nastavnika");
  });
});
