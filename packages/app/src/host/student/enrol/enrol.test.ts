import { describe, expect, it } from "vitest";

import { codeFromQuery, editorPath, enrolError, enrolErrorPlace } from "./model";
import { enrolText, noticeText } from "./messages.hr";

describe("WEB-2104 upis i obavijest", () => {
  it("reads the code of ?kod as R-10 stores it", () => {
    expect(codeFromQuery("?kod=%20abcd1234 ")).toBe("ABCD1234");
    expect(codeFromQuery("?kod=kol-d-2026")).toBe("KOLD2026");
    expect(codeFromQuery("?kod=")).toBeNull();
    expect(codeFromQuery("")).toBeNull();
    expect(codeFromQuery(`?kod=${"a".repeat(80)}`)).toHaveLength(64);
  });

  it("opens the editor of the assignment, not the pending /rad page", () => {
    expect(editorPath("a1")).toBe("/rad/a1");
    expect(editorPath("a/b")).toBe("/rad/a%2Fb");
  });

  it("keeps the prototype wording", () => {
    expect(enrolText.alreadyEnrolled).toBe("Već ste upisani u ovaj kolegij.");
    expect(enrolText.openAssignment).toBe("Otvori zadatak");
    expect(enrolText.another).toBe("Upiši drugi kolegij");
    expect(noticeText.facultyRule).toBe("Pravilo fakulteta (FPZG čl. 8)");
  });

  it("says the prototype's text under the field", () => {
    expect(enrolError({ kind: "malformed" })).toBe("Kod ima od 8 do 32 slova i brojke. Provjerite ga i upišite ponovno.");
    expect(enrolError({ kind: "invalidCode" })).toBe("Kod ne postoji ili je istekao. Provjerite ga s nastavnikom.");
    expect(enrolError({ kind: "offline" })).toBe("Nema veze s poslužiteljem. Provjerite mrežu i pokušajte ponovno.");
    expect(enrolError(null)).toBeNull();
  });
});

describe("P-10 previše pokušaja (E-5a)", () => {
  it("has its own text for 429, without a made-up waiting time", () => {
    const text = enrolError({ kind: "tooManyAttempts" });
    expect(text).toBe("Previše pokušaja. Pričekajte malo i pokušajte ponovno ili se javite nastavniku.");
    expect(text).not.toMatch(/\d/);
  });
  it("keeps one text for a code that does not exist and an expired one", () => {
    expect(enrolError({ kind: "expiredCode" })).toBe(enrolError({ kind: "invalidCode" }));
  });
  it("marks the field only for a wrong code; the attempt's refusals are said apart", () => {
    expect(enrolErrorPlace({ kind: "malformed" })).toEqual({ field: enrolError({ kind: "malformed" }), form: null });
    expect(enrolErrorPlace({ kind: "invalidCode" }).field).not.toBeNull();
    expect(enrolErrorPlace({ kind: "expiredCode" }).form).toBeNull();
    for (const kind of ["tooManyAttempts", "offline", "unavailable", "signedOut", "forbidden", "invalid"] as const) {
      const place = enrolErrorPlace({ kind });
      expect(place.field).toBeNull();
      expect(place.form).toBe(enrolError({ kind }));
    }
    expect(enrolErrorPlace(null)).toEqual({ field: null, form: null });
    expect(enrolErrorPlace({ kind: "enrolled", courseId: "c" })).toEqual({ field: null, form: null });
  });
});
