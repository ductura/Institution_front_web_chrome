// WEB-V16-KOSTUR: the frame's rules and its two mount points. Every id and text is invented.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { orderSections, panelVisible, readSafely, sectionOf, type SectionRead, type ThesisSectionDef } from "./model";
import { registeredSections } from "./sections";
import { ThesisPanel } from "./ThesisPanel";

const def = (id: string, order: number, read: ThesisSectionDef<string>["read"] = async () => ({ kind: "empty" })): ThesisSectionDef<string> =>
  ({ id, order, title: `Odjeljak ${id}`, read, View: () => null });

describe("orderSections", () => {
  it("sorts by order, then id, and keeps the first of a repeated id", () => {
    const list = orderSections([def("b", 2), def("c", 1), def("a", 2), def("a", 9)] as never);
    expect(list.map((s) => `${s.id}${s.order}`)).toEqual(["c1", "a2", "b2"]);
  });
});

describe("readSafely", () => {
  it("a throwing read is unavailable, not empty", async () => {
    expect(await readSafely(async () => { throw new Error("izmišljena greška"); })).toEqual({ kind: "unavailable" });
  });
  it("passes a normal answer through", async () => {
    const ready: SectionRead<number> = { kind: "ready", value: 1 };
    expect(await readSafely(async () => ready)).toBe(ready);
  });
});

describe("panelVisible", () => {
  it("is hidden outside a mentorship and with no sections", () => {
    expect(panelVisible(false, [{ kind: "loading" }])).toBe(false);
    expect(panelVisible(true, [])).toBe(false);
  });
  it("is hidden when every section is notFound (a work the server does not show)", () => {
    expect(panelVisible(true, [{ kind: "notFound" }, { kind: "notFound" }])).toBe(false);
  });
  it("stays shown while loading, empty or unavailable (neither is 'no mentorship')", () => {
    expect(panelVisible(true, [{ kind: "loading" }, { kind: "notFound" }])).toBe(true);
    expect(panelVisible(true, [{ kind: "unavailable" }])).toBe(true);
    expect(panelVisible(true, [{ kind: "empty" }])).toBe(true);
  });
});

describe("sectionOf", () => {
  it("accepts only a well-formed section export", () => {
    expect(sectionOf({ section: def("x", 1) })?.id).toBe("x");
    expect(sectionOf({ section: { id: "x" } })).toBeNull();
    expect(sectionOf({})).toBeNull();
    expect(sectionOf(null)).toBeNull();
  });
});

describe("ThesisPanel", () => {
  it("renders nothing with no registered sections (the registry starts empty)", () => {
    expect(registeredSections).toEqual([]);
    expect(renderToStaticMarkup(createElement(ThesisPanel, { documentId: "izmisljeni-dokument-1", role: "student" }))).toBe("");
  });
  it("renders nothing when the work is not in a mentorship", () => {
    const html = renderToStaticMarkup(createElement(ThesisPanel, { documentId: "d1", role: "mentor", inMentorship: false, sections: [def("a", 1)] as never }));
    expect(html).toBe("");
  });
  it("shows a loading card per section first, never 'nema podataka'", () => {
    const html = renderToStaticMarkup(createElement(ThesisPanel, { documentId: "d1", role: "student", sections: [def("a", 1), def("b", 2)] as never }));
    expect(html).toContain("Odjeljak a");
    expect(html).toContain("Odjeljak b");
    expect(html).toContain("Učitavanje…");
    expect(html).not.toContain("Ovdje još nema zapisa.");
  });
});

describe("mount points", () => {
  const src = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  it("the student's Mentor card mounts the panel for the student", () => {
    expect(src("editor/right/MentorMount.tsx")).toMatch(/<ThesisPanel documentId=\{documentId\} role="student" \/>/);
  });
  it("the mentor's page mounts it beside each started work's WorkPlan", () => {
    expect(src("teacher/mentorships/MentorshipsPage.tsx")).toMatch(/<\/WorkPlan>|<WorkPlan[\s\S]*?\/>\s*[\s\S]*?<ThesisPanel documentId=\{work\.documentId\} role="mentor" \/>/);
  });
});

describe("registry and retry (review of #686)", () => {
  const here = (f: string) => readFileSync(join(__dirname, f), "utf8");
  it("the registry does not use the Vite-only glob (the app runs on Next)", () => {
    expect(here("sections.ts")).not.toMatch(/^[^/\n]*import\.meta\.glob/m);
  });
  it("the unavailable state renders the retry button as a child, not through Card's error prop", () => {
    const src = here("ThesisPanel.tsx");
    expect(src).not.toMatch(/error=\{thesisHr\.unavailable\}/);
    expect(src).toMatch(/<Button[^>]*onClick=\{reload\}>\{thesisHr\.retry\}/);
  });
});
