import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { assignmentBody, type AssignmentDraft } from "../../../../../../src/components/teacher/assignment-create.ts";

import { ImportAllowedField } from "./ImportAllowedField";

// WEB-1801 (M8.2b): invented assignment.
const draft: AssignmentDraft = {
  title: "Izmišljeni seminar", workType: "seminar_paper", opensAt: "2026-12-01T09:00", dueAt: "2026-12-20T09:00",
  instructions: "", wordMin: "", wordMax: "", aiPurposes: [],
};

describe("Dopušten uvoz", () => {
  it("is off unless the teacher ticks it", () => {
    expect(assignmentBody(draft, "prohibited")?.importAllowed).toBe(false);
    expect(assignmentBody({ ...draft, importAllowed: true }, "prohibited")?.importAllowed).toBe(true);
  });
  it("renders the labelled checkbox with the matching note", () => {
    const off = renderToStaticMarkup(<ImportAllowedField value={false} onChange={() => {}} />);
    const on = renderToStaticMarkup(<ImportAllowedField value onChange={() => {}} />);
    expect(off).toContain("Dopušten uvoz");
    expect(off).not.toContain("checked");
    expect(off).toContain("student ne vidi gumb");
    expect(on).toContain("checked");
    expect(on).toContain("DOCX ili PDF");
  });
});
