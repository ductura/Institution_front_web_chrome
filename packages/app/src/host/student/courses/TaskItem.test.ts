// STU-R04 (P-3): the deadline tags on a task row of E-3 and E-4, drawn by the real TaskItem.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HostContext } from "../../context";
import { TaskItem } from "./CoursesPages";

const NOW = new Date("2026-11-22T10:00:00Z");
const host = { base: "", page: "student", role: "student" } as never;
const a = (over: object) => ({ id: "20000000-0000-4000-8000-000000000001", title: "Izmišljeni zadatak", dueAt: "2026-11-18T22:59:00.000Z", extendedDueAt: null, noticeFirst: false, ...over }) as never;
const draw = (props: object) => renderToStaticMarkup(createElement(HostContext.Provider, { value: host }, createElement(TaskItem, { course: null, kind: "task", now: NOW, ...props } as never)));

describe("TaskItem deadline tag (P-3, E-3 and E-4)", () => {
  it("says the deadline has passed on a work not submitted, also on the E-4 line variant", () => {
    expect(draw({ a: a({}) })).toContain("Rok je prošao 18. 11. 2026.");
    expect(draw({ a: a({}), line: createElement("span", null, "Rok 18. 11. 2026.") })).toContain("Rok je prošao 18. 11. 2026.");
  });
  it("says the original deadline has passed while the extension runs", () => {
    const html = draw({ a: a({ extendedDueAt: "2026-11-30T22:59:00.000Z" }) });
    expect(html).toContain("Izvorni rok je prošao 18. 11. 2026.");
    expect(html).not.toContain("Rok je prošao");
  });
  it("has no tag for a submitted work or a future deadline", () => {
    expect(draw({ a: a({}), kind: "submitted" })).not.toContain("prošao");
    expect(draw({ a: a({ dueAt: "2026-12-30T10:00:00Z" }) })).not.toContain("prošao");
  });
});

describe("TaskItem work kind and mentor (STU-R14, E-3)", () => {
  const mentor = { id: "m", givenName: "Iva", familyName: "Izmišljenić" };
  it("shows kind and mentor only where asked (E-3), from the server's answer", () => {
    const html = draw({ a: a({ workType: "essay", mentor }), showWork: true });
    expect(html).toContain("Esej · Mentor: Iva Izmišljenić");
    expect(draw({ a: a({ workType: "essay", mentor }) })).not.toContain("Mentor:");
  });
  it("draws no line when the answer has neither", () => {
    expect(draw({ a: a({}), showWork: true })).not.toContain("data-work-meta");
  });
});
