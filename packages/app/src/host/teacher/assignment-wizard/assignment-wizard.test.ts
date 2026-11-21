import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { AssignmentDraft } from "@/components/teacher/assignment-create";

import AssignmentWizard from "./AssignmentWizard";
import { checkBasics, checkSchedule } from "./assignment-wizard-steps";
import { wizardHr } from "./messages.hr";

const draft: AssignmentDraft = {
  title: "Izmišljeni seminar", workType: "seminar_paper", opensAt: "2027-01-10T10:00", dueAt: "2027-01-30T16:00",
  instructions: "", wordMin: "", wordMax: "", aiPurposes: [],
};

describe("assignment wizard step checks (WEB-1403)", () => {
  it("step 1 needs a title of at most 160 characters", () => {
    expect(checkBasics(draft)).toEqual({});
    expect(checkBasics({ ...draft, title: "  " }).title).toBe(wizardHr.errors.title);
    expect(checkBasics({ ...draft, title: "x".repeat(161) }).title).toBe(wizardHr.errors.title);
  });

  it("step 2 needs both times, the deadline after the start, and a sane word range", () => {
    expect(checkSchedule(draft)).toEqual({});
    expect(checkSchedule({ ...draft, opensAt: "" }).opensAt).toBe(wizardHr.errors.opensAt);
    expect(checkSchedule({ ...draft, dueAt: "" }).dueAt).toBe(wizardHr.errors.dueAt);
    expect(checkSchedule({ ...draft, dueAt: "2027-01-10T10:00" }).dueAt).toBe(wizardHr.errors.dueBeforeOpen);
    expect(checkSchedule({ ...draft, wordMin: "900", wordMax: "100" }).wordMax).toBe(wizardHr.errors.words);
    expect(checkSchedule({ ...draft, wordMin: "abc" }).wordMax).toBe(wizardHr.errors.words);
  });

  it("renders the first step with the course and no back button", () => {
    const html = renderToStaticMarkup(createElement(AssignmentWizard, { course: { id: "c1", name: "Izmišljeni kolegij", academicYear: "2026./2027.", aiPolicy: "prohibited" } }));
    expect(html).toContain("Izmišljeni kolegij");
    expect(html).toContain(wizardHr.steps.basics);
    expect(html).not.toContain(wizardHr.labels.back);
  });
});
