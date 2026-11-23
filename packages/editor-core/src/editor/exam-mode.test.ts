import { describe, expect, it } from "vitest";

import { examDecision, type ExamContext } from "./exam-mode";

const base: ExamContext = { insertsText: true, internalPaste: false, accommodation: false, keyInTask: false, trustedByApp: false };
const with_ = (over: Partial<ExamContext>): ExamContext => ({ ...base, ...over });

describe("examDecision (P-4 proposal)", () => {
  it.each(["editor", "system-replacement", "citation-form", "cut", "composition"] as const)("lets %s in", (source) => {
    expect(examDecision(source, base)).toBeNull();
  });

  it("refuses a paste from outside the work and lets a paste of text copied in it in", () => {
    expect(examDecision("paste", base)).toBe("pasted-from-outside");
    expect(examDecision("paste", with_({ internalPaste: true }))).toBeNull();
  });

  it("refuses a drop from outside the work", () => {
    expect(examDecision("drop", base)).toBe("dropped");
  });

  it("refuses input without keys, unless an accommodation is approved or keys made the composition", () => {
    expect(examDecision("keyless-input", base)).toBe("keyless-input");
    expect(examDecision("keyless-input", with_({ accommodation: true }))).toBeNull();
    expect(examDecision("keyless-input", with_({ keyInTask: true }))).toBeNull();
  });

  it("refuses a change no trusted event explains (a script, an extension, a program)", () => {
    expect(examDecision("unattributed", base)).toBe("program");
    // An accommodation covers assistive input, not a program writing.
    expect(examDecision("unattributed", with_({ accommodation: true }))).toBe("program");
  });

  it("never refuses a change that inserts no text, or one the application makes", () => {
    for (const source of ["paste", "drop", "keyless-input", "unattributed"] as const) {
      expect(examDecision(source, with_({ insertsText: false }))).toBeNull();
      expect(examDecision(source, with_({ trustedByApp: true }))).toBeNull();
    }
  });
});
