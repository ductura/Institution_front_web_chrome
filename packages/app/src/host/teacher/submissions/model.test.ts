import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { FAKE_ROWS, fakeSubmissionsPort } from "./fake-port";
import { submissionsMessages } from "./messages.hr";
import { answeredPanel, canOpen, documentBlocks, failureMessage, forAssignment, lateTag, submittedAt } from "./model";

const [onTime, late] = FAKE_ROWS as [(typeof FAKE_ROWS)[number], (typeof FAKE_ROWS)[number]];

describe("submissions rows (WEB-1502)", () => {
  it("tags a row only from the recorded late flag", () => {
    expect(lateTag(onTime)).toBeNull();
    expect(lateTag(late)).toBe("Poslije roka");
    // A time long after any deadline does not make a row late: the client never computes it.
    expect(lateTag({ ...onTime, requestedMinute: "2099-12-31T23:59:00.000Z" })).toBeNull();
  });

  it("shows the time in Zagreb time and a dash when there is none", () => {
    expect(submittedAt(onTime)).toContain("22:30");
    expect(submittedAt(onTime)).toContain("2026");
    expect(submittedAt(late)).toBe("—");
  });

  it("opens every submitted row, late or without a time", () => {
    expect(canOpen(onTime)).toBe(true);
    expect(canOpen(late)).toBe(true);
  });

  it("names each failure", () => {
    expect(failureMessage({ kind: "session-expired" })).toBe(submissionsMessages.signedOut);
    expect(failureMessage({ kind: "greska", code: "not_found" })).toBe(submissionsMessages.notFound);
    expect(failureMessage({ kind: "nepoznato" })).toBe(submissionsMessages.unavailable);
  });

  it("has an empty state for an assignment without submissions", async () => {
    expect(await fakeSubmissionsPort([]).list("a")).toEqual({ kind: "ready", rows: [] });
    expect(submissionsMessages.empty).toBe("Još nema predaja.");
  });
});

describe("submitted version read only", () => {
  it("reads the blocks of the fake submitted version", async () => {
    const port = fakeSubmissionsPort();
    const read = await port.open("a", onTime.studentId);
    expect(port.opened).toEqual([onTime.studentId]);
    expect(read.kind === "ready" && documentBlocks(read.version.document)).toEqual({
      kind: "ready",
      blocks: [{ kind: "heading", text: "Izmišljeni naslov" }, { kind: "paragraph", text: "Izmišljeni odlomak predanog rada." }],
    });
  });

  it("drops an answer for a version no longer open", () => {
    const other = late;
    const ready = { kind: "nepoznato" } as const;
    expect(answeredPanel({ assignmentId: "a", row: other, read: "loading" }, "a", onTime, ready)).toEqual({ assignmentId: "a", row: other, read: "loading" });
    expect(answeredPanel(null, "a", onTime, ready)).toBeNull();
    expect(answeredPanel({ assignmentId: "b", row: onTime, read: "loading" }, "a", onTime, ready)).toEqual({ assignmentId: "b", row: onTime, read: "loading" });
    expect(answeredPanel({ assignmentId: "a", row: onTime, read: "loading" }, "a", onTime, ready)).toEqual({ assignmentId: "a", row: onTime, read: ready });
  });

  it("shows nothing read for another assignment", () => {
    const list = { assignmentId: "a", read: { kind: "ready", rows: [...FAKE_ROWS] } } as const;
    expect(forAssignment(list, "a")).toBe(list);
    expect(forAssignment(list, "b")).toBeNull();
    expect(forAssignment({ assignmentId: "a", row: onTime, read: "loading" }, "b")).toBeNull();
  });

  it("reads the contract vector's empty document", () => {
    expect(documentBlocks("{\"nodes\":[],\"schemaVersion\":2}")).toEqual({ kind: "ready", blocks: [] });
  });

  it.each([
    ["not JSON", "{"],
    ["another schema version", "{\"nodes\":[],\"schemaVersion\":4}"],
    ["an unknown block", "{\"nodes\":[{\"type\":\"table\",\"children\":[]}],\"schemaVersion\":2}"],
    ["a citation, never dropped", "{\"nodes\":[{\"type\":\"paragraph\",\"children\":[{\"type\":\"citation\",\"sourceId\":\"s1\"}]}],\"schemaVersion\":2}"],
  ])("shows %s as unreadable", (_name, document) => {
    expect(documentBlocks(document)).toEqual({ kind: "unreadable" });
  });
});

describe("submissions texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(submissionsMessages)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
