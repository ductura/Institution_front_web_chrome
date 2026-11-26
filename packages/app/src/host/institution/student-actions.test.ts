// OPE-R03: the removal and return controls of a course are rendered with their honest "not available" note for direct enrolment.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudentActions } from "./InstitutionPanels";

describe("StudentActions", () => {
  const out = renderToStaticMarkup(createElement(StudentActions, { courseId: "11111111-1111-4111-8111-111111111111", onChanged: () => {} }));

  it("offers removal and return, both disabled until a valid student id is typed", () => {
    expect(out).toContain("Uklanjanje i povratak studenta");
    expect(out).toMatch(/<button[^>]*disabled[^>]*>[^<]*Ukloni iz kolegija/);
    expect(out).toMatch(/<button[^>]*disabled[^>]*>[^<]*Dopusti povratak/);
  });

  it("says plainly that direct enrolment is not available", () => {
    expect(out).toContain("Izravni upis studenta nije dostupan.");
  });
});
