// WEB-NUZ-NZ NZ-10: the N-17 rows joined with the course's students, the submissions and the extensions.
// Nothing is guessed: a part that was not read leaves its field as it was. Invented people and times only.
import { describe, expect, it } from "vitest";

import { cardDeadline, deadlineText, joinRows, revisionText, stateText, summaryLine, timeText, workHref, type N17Row, type RowJoin } from "./model";
import { n17Messages as m } from "./messages.hr";

const NOW = Date.parse("2026-11-24T10:00:00.000Z");
const DUE = "2026-12-15T22:59:00.000Z";
const row = (studentId: string, submitted = false): N17Row => ({
  studentId, name: `Student ${studentId}`, group: null, submitted,
  requestedMinute: submitted ? "2026-11-05T20:14Z" : null, afterDeadline: false, evidenceRecord: submitted ? "continuous" : null,
});
const full: RowJoin = {
  dueAt: DUE,
  works: new Map([
    ["s1", { state: "submitted", documentId: "doc-1" }],
    ["s2", { state: "in_progress", documentId: "doc-2" }],
    ["s3", { state: "not_started", documentId: null }],
  ]),
  submissions: new Map([["s1", { revision: 2, documentId: "doc-1" }]]),
  extensions: [{ scope: "one", studentId: "s2", dueAt: "2026-12-20T22:59:00.000Z" }],
};

describe("N-17 joinRows (NZ-10)", () => {
  it("says writing, not started and submitted from the reads, with the document and the version", () => {
    const [s1, s2, s3] = joinRows([row("s1", true), row("s2"), row("s3")], full, NOW);
    expect(stateText(s1!)).toBe("predano");
    expect(timeText(s1!)).toBe("5. 11. 2026. u 21:14 · verzija 2");
    expect(workHref(s1!)).toBe("/nastavnik/rad/doc-1");
    expect(stateText(s2!)).toBe("u pisanju, rok produljen");
    expect(deadlineText(s2!)).toBe("Rok produljen do 20. 12. 2026. u 23:59");
    expect(workHref(s2!)).toBe("/nastavnik/rad/doc-2");
    expect(stateText(s3!)).toBe("nije započeo");
    expect(deadlineText(s3!)).toBe("Rok 15. 12. 2026. u 23:59");
    expect(workHref(s3!)).toBeNull();
    expect(summaryLine([s1!, s2!, s3!])).toBe("predano 1, u pisanju 1, nije započelo 1");
  });
  it("a work still being written after its deadline is not submitted", () => {
    const [s2] = joinRows([row("s2")], { ...full, extensions: [] }, Date.parse("2026-12-16T00:00:00.000Z"));
    expect(stateText(s2!)).toBe("nije predano");
  });
  it("an extension for all applies to every student", () => {
    const [s3] = joinRows([row("s3")], { ...full, extensions: [{ scope: "all", studentId: null, dueAt: "2026-12-22T22:59:00.000Z" }] }, NOW);
    expect(deadlineText(s3!)).toBe("Rok produljen do 22. 12. 2026. u 23:59");
  });
  it("leaves every field as it was when the other reads failed", () => {
    const failed: RowJoin = { dueAt: DUE, works: null, submissions: null, extensions: null };
    const [s1, s2] = joinRows([row("s1", true), row("s2")], failed, NOW);
    expect(s1).toEqual(row("s1", true));
    expect(s2).toEqual(row("s2"));
    expect(stateText(s2!)).toBe("nije predano");
    expect(deadlineText(s2!)).toBe(m.revisionUnavailable);
    expect(timeText(s1!)).toBe("5. 11. 2026. u 21:14");
  });
  it("the card says its deadline, and that it has passed", () => {
    expect(cardDeadline({ dueAt: DUE }, NOW)).toBe("Rok 15. 12. 2026. u 23:59");
    expect(cardDeadline({ dueAt: "2026-11-08T22:59:00.000Z" }, NOW)).toBe("Rok 8. 11. 2026. u 23:59 · rok je prošao");
    expect(cardDeadline({}, NOW)).toBeNull();
  });
});

describe("N-17 follow-up (NAS-08, NAS-10, NAS-12)", () => {
  const follow = (over: Record<string, unknown>) => ({
    studentId: "s", noticeReadAt: null, noticeAcknowledgedAt: null as string | null, noticeVersionNo: null, revisionState: null as null | "open",
    revisionChangedAt: null, openRevisionCount: 0, ...over,
  });
  const withFollowUp = (map: Record<string, ReturnType<typeof follow>>): RowJoin => ({
    ...full, followUp: new Map(Object.entries(map).map(([k, v]) => [k, { ...v, studentId: k }])),
  });
  it("a student who has not acknowledged the notice and has not submitted is unconfirmed; Potvrdilo n od m counts the rest", () => {
    const join = withFollowUp({ s1: follow({ noticeAcknowledgedAt: "2026-11-02T10:00:00.000Z" }), s2: follow({ noticeAcknowledgedAt: "2026-11-02T10:00:00.000Z" }), s3: follow({}) });
    const rows = joinRows([row("s1", true), row("s2"), row("s3")], join, NOW);
    expect(stateText(rows[2]!)).toBe("obavijest nije potvrđena");
    expect(stateText(rows[1]!)).toBe("u pisanju, rok produljen");
    expect(summaryLine(rows)).toBe("predano 1, u pisanju 1, obavijest nije potvrđena 1, potvrdilo 2 od 3");
  });
  it("fills the revision column and the open count from the server; no revision is null, not unavailable", () => {
    const join = withFollowUp({ s1: follow({ noticeAcknowledgedAt: "x", revisionState: "open", openRevisionCount: 1 }), s2: follow({ noticeAcknowledgedAt: "x" }) });
    const [s1, s2] = joinRows([row("s1", true), row("s2")], join, NOW);
    expect(revisionText(s1!)).toBe("zatražena · otvorena");
    expect(s1!.openRevisions).toBe(1);
    expect(revisionText(s2!)).toBe(m.revisionNone);
  });
  it("leaves the notice and the revision as they were when the follow-up was not read or lacks the student", () => {
    const [a] = joinRows([row("s2")], { ...full, followUp: null }, NOW);
    const [b] = joinRows([row("s2")], withFollowUp({ other: follow({}) }), NOW);
    for (const r of [a!, b!]) {
      expect(r.revision).toBeUndefined();
      expect(r.noticeAcknowledged).toBeUndefined();
      expect(revisionText(r)).toBe(m.revisionUnavailable);
    }
    expect(summaryLine([a!])).not.toContain("potvrdilo");
  });
});
