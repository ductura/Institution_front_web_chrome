// WEB-DIZ-S06-S42 (S-07): the subtitle of the workspace top bar. Invented names only.
import { describe, expect, it } from "vitest";

import { courseLine } from "./frame";

describe("courseLine", () => {
  it("says course, work type and the deadline with the full month, with no middle dot", () => {
    expect(courseLine("Uvod u znanstveno pisanje", "2026-11-30T22:59:00.000Z", "Esej"))
      .toBe("Uvod u znanstveno pisanje, Esej, rok 30. studenoga 2026. u 23:59");
  });

  it("leaves the work type out when the read does not give it", () => {
    expect(courseLine("Izmišljeni kolegij", "2026-11-30T22:59:00.000Z")).toBe("Izmišljeni kolegij, rok 30. studenoga 2026. u 23:59");
  });

  it("never shows a raw ISO string: an unreadable deadline is left out", () => {
    expect(courseLine("Izmišljeni kolegij", "nije datum", "Esej")).toBe("Izmišljeni kolegij, Esej");
    expect(courseLine("Izmišljeni kolegij", "nije datum")).toBe("Izmišljeni kolegij");
  });
});
