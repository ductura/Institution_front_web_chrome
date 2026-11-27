import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AssignmentDraft } from "@/components/teacher/assignment-create";

import AssignmentForm from "./AssignmentForm";
import { checkForm, errorSummary, withPractice } from "./form-checks";
import { assignmentFormHr as f } from "./messages.hr";

const draft: AssignmentDraft = {
  title: "Izmišljeni seminar", workType: "seminar_paper", opensAt: "2027-01-10T10:00", dueAt: "2027-01-30T16:00",
  instructions: "", wordMin: "", wordMax: "", aiPurposes: [],
};
const course = { id: "c1", name: "Izmišljeni kolegij", academicYear: "2026./2027.", aiPolicy: "prohibited" } as const;
const render = (aiPolicy: "prohibited" | "partially_allowed" = "prohibited") =>
  renderToStaticMarkup(createElement(AssignmentForm, { course: { ...course, aiPolicy } }));

describe("assignment form checks (WEB-2146)", () => {
  it("needs a title of at most 160 characters", () => {
    expect(checkForm(draft)).toEqual({});
    expect(checkForm({ ...draft, title: "  " }).title).toBe(f.errors.title);
    expect(checkForm({ ...draft, title: "x".repeat(161) }).title).toBe(f.errors.title);
  });

  it("needs both times, the deadline after the opening, and a sane word range", () => {
    expect(checkForm({ ...draft, opensAt: "" }).opensAt).toBe(f.errors.opensAt);
    expect(checkForm({ ...draft, dueAt: "" }).dueAt).toBe(f.errors.dueAt);
    expect(checkForm({ ...draft, dueAt: "2027-01-10T10:00" }).dueAt).toBe(f.errors.dueBeforeOpen);
    expect(checkForm({ ...draft, wordMin: "900", wordMax: "100" }).wordMax).toBe(f.errors.words);
    expect(checkForm({ ...draft, wordMin: "abc" }).wordMax).toBe(f.errors.words);
  });

  it("collects every error in one summary, in field order", () => {
    expect(errorSummary(checkForm({ ...draft, title: "", opensAt: "" }))).toBe(`${f.errors.title} ${f.errors.opensAt}`);
    expect(errorSummary({})).toBe("");
  });

  it("sends the practice flag only when ticked, as a boolean and never adds a grade field (WEB-1901)", () => {
    expect(withPractice({ title: "x" }, { practice: true })).toEqual({ title: "x", isPractice: true });
    expect(withPractice({ title: "x" }, {})).toEqual({ title: "x" });
    expect(Object.keys(withPractice({ title: "x" }, { practice: true })).join()).not.toMatch(/grade|score|ocjen/i);
  });
});

describe("assignment form rendering (WEB-2146)", () => {
  it("is one form with the four prototype sections, not a wizard", () => {
    const html = render("partially_allowed");
    for (const title of Object.values(f.sections)) expect(html).toContain(title);
    for (const id of ["zs-1", "zs-2", "zs-3", "zs-4"]) expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Naslov zadatka");
    expect(html).toContain("Do 160 znakova.");
    expect(html).toContain("Najmanje riječi");
    expect(html).toContain("Najviše riječi");
    expect(html).toContain(f.review);
    expect(html).toContain(f.cancel);
    expect(html).not.toContain("Nastavi");
  });

  it("offers the practice choice with the agreed wording (WEB-1901)", () => {
    const html = render();
    expect(html).toContain("Probni zadatak (bez ocjene)");
    expect(html).toContain(f.practice.off);
  });

  it("offers summary-only and external tools as working choices, and says groups are loading (NZ-3)", () => {
    const html = render("partially_allowed");
    expect(html).toContain(f.rules.aiSummary);
    expect(html).toMatch(/<input(?=[^>]*value="summary")(?![^>]*disabled)[^>]*>/);
    expect(html).toMatch(/<input(?=[^>]*value="no")(?=[^>]*name="tools")(?![^>]*disabled)[^>]*>/);
    expect(html).toContain(f.groups.loading);
  });

  it("has the section Pravila predaje with the late rule as a working choice, allowed at the start (NZ-4, F4-NAS-R01)", () => {
    const html = render("partially_allowed");
    expect(html).toContain('id="zs-5"');
    expect(html).toContain(f.sections.submitRules);
    expect(html).not.toContain(f.submitRules.lateUnavailable);
    expect(html).not.toMatch(/<fieldset[^>]*disabled=""[^>]*><legend>Predaja nakon roka<\/legend>/);
    expect(html).toMatch(/<input(?=[^>]*name="pr-late")(?=[^>]*value="yes")(?=[^>]*checked)(?![^>]*disabled)[^>]*>/);
    expect(html).toMatch(/<input(?=[^>]*name="pr-withdrawal")(?![^>]*disabled)[^>]*>/);
    expect(html).toContain(`${f.submitRules.seesIntro} ${f.submitRules.seesLate.on}; ${f.submitRules.seesWithdrawal.on}; ${f.submitRules.seesDeclaration.on}.`);
  });

  it("offers only the no-help choice when the course prohibits AI help (D-52)", () => {
    expect(render("prohibited")).not.toContain(f.rules.aiCourse);
    expect(render("partially_allowed")).toContain(f.rules.aiCourse);
  });

  it("lists what is recorded with the P-01 and P-02 thresholds", () => {
    const html = render();
    expect(html).toContain("prag P-01");
    expect(html).toContain("prag P-02");
    expect(html).toContain("Ne zna tko je tipkao.");
  });
});
