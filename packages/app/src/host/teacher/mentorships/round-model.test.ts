// WEB-NF6-RUNDA (MK-8): the lines of "Pregled runde". Invented blocks and requests only.
import { describe, expect, it } from "vitest";

import type { RevisionRequest } from "../../../../../../src/client/revision-requests";

import { roundText as t } from "./messages.hr";
import { roundWorks } from "./model";
import { newsLine, requestsLine, seenLine } from "./round-model";

const snap = (reviewedRevision: number | null, changed: boolean, blocks: { kind: "paragraph" | "heading"; change: "added" | "removed" | "unchanged" }[]) =>
  ({ kind: "ready", snapshot: { reviewedRevision, currentRevision: 9, changed, blocks: blocks.map((b) => ({ ...b, text: "x", level: 1 })) } }) as never;
const req = (state: RevisionRequest["state"]) => ({ id: state, state }) as unknown as RevisionRequest;

describe("Pregled runde", () => {
  it("says what is new since the last review", () => {
    expect(newsLine(snap(null, true, []))).toBe(t.neverReviewed);
    expect(newsLine(snap(4, false, []))).toBe(t.noChange);
    expect(newsLine(snap(4, true, [{ kind: "paragraph", change: "added" }, { kind: "paragraph", change: "removed" }, { kind: "heading", change: "added" }])))
      .toBe(t.changed(1, 1));
    expect(newsLine({ kind: "unavailable" })).toBe(t.newsUnavailable);
  });
  it("counts the requests by state, leaving out withdrawn ones", () => {
    expect(requestsLine({ kind: "ok", requests: [req("open"), req("reopened"), req("responded"), req("accepted"), req("withdrawn")] }))
      .toBe(t.requests(2, 1, 1));
    expect(requestsLine({ kind: "ok", requests: [req("withdrawn")] })).toBe(t.noRequests);
    expect(requestsLine({ kind: "forbidden" })).toBe(t.requestsUnavailable);
  });
  it("is one card per started work, by family name", () => {
    const work = (id: string, documentId: string | null, familyName: string) => ({
      mentorshipId: id, assignmentId: id, documentId, student: { givenName: "Iva", familyName }, title: "Izmišljeni rad",
      workType: "bachelor_thesis" as const, workState: documentId === null ? "not_started" as const : "in_progress" as const,
    }) as never;
    const rows = roundWorks([work("a", "rad-a", "Zmišljena"), work("b", null, "Amišljena"), work("c", "rad-c", "Izmišljena")]);
    expect(rows.map((r) => r.documentId)).toEqual(["rad-c", "rad-a"]);
    expect(rows[0]!.path).toBe("/nastavnik/rad/rad-c");
  });
});

describe("seenLine (#631 review 2, point 3)", () => {
  const ok = (...states: RevisionRequest["state"][]) => ({ kind: "ok" as const, requests: states.map((state, i) => ({ id: `z-${i}`, state }) as unknown as RevisionRequest) });
  it("counts the live requests the student has seen, by id and kind", () => {
    const seen = [{ kind: "revision_request", id: "z-0", firstSeenAt: "2026-11-20T10:00:00.000Z" },
      { kind: "comment", id: "z-1", firstSeenAt: "2026-11-20T10:00:00.000Z" }];
    expect(seenLine(ok("open", "responded", "withdrawn"), seen)).toBe(t.seen(1, 2));
  });
  it("says unavailable for an unread list, and nothing without requests", () => {
    expect(seenLine(ok("open"), null)).toBe(t.seenUnavailable);
    expect(seenLine(ok("withdrawn"), [])).toBeNull();
    expect(seenLine({ kind: "unavailable" }, [])).toBeNull();
  });
});
