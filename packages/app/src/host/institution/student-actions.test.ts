// OPE-R03: the administrator's course screen does not offer removal or return of a student; it says the course's teacher does it.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { institutionHostMessages as h } from "./messages.hr";
import { StudentActions } from "./InstitutionPanels";

describe("StudentActions (administrator)", () => {
  const out = renderToStaticMarkup(createElement(StudentActions));

  it("shows the instruction that the course's teacher removes and returns a student", () => {
    expect(out).toContain("Uklanjanje i povratak studenta");
    expect(out).toContain("radi nastavnik kolegija");
  });

  it("offers no action that would send a request", () => {
    expect(out).not.toContain("<button");
    expect(out).not.toContain("<input");
    expect(out).not.toContain("Ukloni iz kolegija");
    expect(out).not.toContain("Dopusti povratak");
  });

  it("says plainly that direct enrolment is not available", () => {
    expect(out).toContain("Izravni upis studenta nije dostupan.");
  });

  it("never words a refusal as an expired sign-in", () => {
    expect(JSON.stringify(h.student)).not.toContain("Prijava je istekla");
  });
});
