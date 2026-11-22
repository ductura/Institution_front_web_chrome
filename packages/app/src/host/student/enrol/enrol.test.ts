import { describe, expect, it } from "vitest";

import { codeFromQuery, editorPath } from "./model";
import { enrolText, noticeText } from "./messages.hr";

describe("WEB-2104 upis i obavijest", () => {
  it("reads the code of ?kod as R-10 stores it", () => {
    expect(codeFromQuery("?kod=%20abcd1234 ")).toBe("ABCD1234");
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
});
