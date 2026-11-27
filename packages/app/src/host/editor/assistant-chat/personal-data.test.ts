import { describe, expect, it } from "vitest";

import { REMOVED, findPersonalData, removePersonalData } from "./personal-data";

// ED-80: the prototype's three kinds (assist2.js `PII`). Every address and number is invented.
describe("ED-80 personal data in a question", () => {
  it("finds an e-mail address, an 11-digit number and a phone number, in that order", () => {
    const text = "Pišite na ana.izmisljena@primjer.hr, OIB 12345678901, mob. 091 234 5678.";
    expect(findPersonalData(text)).toEqual([
      { kind: "email", matches: ["ana.izmisljena@primjer.hr"] },
      { kind: "longNumber", matches: ["12345678901"] },
      { kind: "phone", matches: ["091 234 5678"] },
    ]);
  });

  it("keeps every match of a kind and leaves out kinds with none", () => {
    expect(findPersonalData("a@primjer.hr i b@primjer.hr")).toEqual([{ kind: "email", matches: ["a@primjer.hr", "b@primjer.hr"] }]);
    expect(findPersonalData("+385 1 234 5678")).toEqual([{ kind: "phone", matches: ["+385 1 234 5678"] }]);
  });

  it("finds nothing in an ordinary sentence, a year or a short number", () => {
    expect(findPersonalData("Izmišljena rečenica iz 2026. sa 12 primjera i stranicom 345.")).toEqual([]);
  });

  it("replaces every finding, so the cleaned text has none left", () => {
    const cleaned = removePersonalData("Ana (ana@primjer.hr, 12345678901) i 091 234 5678.");
    expect(cleaned).toBe(`Ana (${REMOVED}, ${REMOVED}) i ${REMOVED}.`);
    expect(findPersonalData(cleaned)).toEqual([]);
  });

  it("is the same on a second call (no regular expression keeps its place)", () => {
    const text = "ana@primjer.hr";
    expect(findPersonalData(text)).toEqual(findPersonalData(text));
  });
});
