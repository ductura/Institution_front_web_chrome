import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { gradeSlot, readGrade } from "./contract";
import { fakeGradeServer } from "./fake-port";
import { GradeGate, PracticeNotice } from "./GradeGate";
import { gradeMessages as text } from "./messages.hr";

const ID = "00000000-0000-4000-8000-0000000000b1";
const ACTIONS = createElement("button", { type: "button" }, "Preuzmi sve predaje");
const gate = (read: Parameters<typeof GradeGate>[0]["read"]) =>
  renderToStaticMarkup(createElement(GradeGate, { read, onRetry: () => {}, children: ACTIONS }));

describe("grade route of an assignment (PIL-D1-BEZ-OCJENE)", () => {
  it("reads 409 practice_assignment as a practice assignment, not as an error", async () => {
    const server = fakeGradeServer("practice");
    expect(await readGrade(server.call, ID)).toEqual({ kind: "practice" });
    expect(server.asked).toEqual([ID]);
  });

  it("offers the actions only for an exact 200 { eligible: true }", async () => {
    expect(await readGrade(fakeGradeServer("graded").call, ID)).toEqual({ kind: "graded" });
    expect(await readGrade(fakeGradeServer("bad").call, ID)).toEqual({ kind: "unavailable" });
    expect(await readGrade(async () => ({ ok: false, status: 409, code: "conflict" }), ID)).toEqual({ kind: "unavailable" });
    expect(await readGrade(async () => { throw new Error("x"); }, ID)).toEqual({ kind: "unavailable" });
  });

  it("maps the other answers without inventing a grade", async () => {
    expect(await readGrade(fakeGradeServer(401).call, ID)).toEqual({ kind: "signedOut" });
    expect(await readGrade(fakeGradeServer(403).call, ID)).toEqual({ kind: "notFound" });
    expect(await readGrade(fakeGradeServer(404).call, ID)).toEqual({ kind: "notFound" });
    expect(await readGrade(fakeGradeServer(503).call, ID)).toEqual({ kind: "unavailable" });
    expect(await readGrade(fakeGradeServer().call, "")).toEqual({ kind: "notFound" });
  });

  it("puts the actions only where the assignment is confirmed as graded", () => {
    expect(gradeSlot(null)).toBe("waiting");
    expect(gradeSlot({ kind: "graded" })).toBe("actions");
    expect(gradeSlot({ kind: "practice" })).toBe("practice");
    expect(gradeSlot({ kind: "unavailable" })).toBe("unavailable");
    expect(gradeSlot({ kind: "notFound" })).toBe("none");
    expect(gradeSlot({ kind: "signedOut" })).toBe("none");
  });

  it("shows a practice assignment as a calm note and offers no grade or export action", () => {
    const html = gate({ kind: "practice" });
    expect(html).toContain(text.practiceTitle);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain("Preuzmi sve predaje");
    expect(html).toContain("Probni");
  });

  it("renders the actions for a graded assignment and none while reading or after a failure", () => {
    expect(gate({ kind: "graded" })).toContain("Preuzmi sve predaje");
    for (const read of [null, { kind: "unavailable" } as const, { kind: "notFound" } as const]) expect(gate(read)).not.toContain("Preuzmi sve predaje");
    expect(gate({ kind: "unavailable" })).toContain(text.retry);
  });

  it("holds no forbidden term (Ductus PRODUCT §5)", () => {
    for (const value of Object.values(text)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
    expect(findForbiddenTerms(renderToStaticMarkup(createElement(PracticeNotice)), "hr")).toEqual([]);
  });
});
