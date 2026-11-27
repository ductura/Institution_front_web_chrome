// F4-PM1-R12A: the student's page format comes from the work's rule profile, general values where it is silent.
import { describe, expect, it } from "vitest";

import { DEFAULT_PROFILE_ID, profileById } from "../rules/profiles";
import { pageFormatOf } from "./page-format-of";

describe("pageFormatOf", () => {
  it("reads typeface, spacing and page numbers from a profile that states them", () => {
    const format = pageFormatOf(profileById("df-diplomski"));
    expect(format.label).toBe("Fakultet društvenih znanosti Primjer – diplomski rad");
    expect(format.font).toBe("Times New Roman");
    expect(format.spacing).toBe(1.5);
    expect(format.known).toMatchObject({ font: true, spacing: true, numbering: true, margins: false });
    expect(format.numberStart).toBe("intro");
    expect(format.sources).toEqual(["Rimski i arapski brojevi stranica od Uvoda"]);
    expect(format.margins).toEqual({ top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 });
  });

  it("shows the general values, marked as general, for the general academic work", () => {
    const format = pageFormatOf(profileById(DEFAULT_PROFILE_ID));
    expect(format.label).toBe("Fakultet društvenih znanosti Primjer – opći akademski rad");
    expect(format.known).toEqual({ font: false, size: false, spacing: false, margins: false, numbering: false });
    expect(format.font).toBe("Times New Roman");
  });

  it("without a profile gives the general format with no label", () => {
    const format = pageFormatOf(null);
    expect(format.label).toBe("");
    expect(format.sources).toEqual([]);
  });
});
