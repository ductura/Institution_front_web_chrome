import { describe, expect, it } from "vitest";

import { examDecision, type ExamContext } from "./exam-mode";

const base: ExamContext = { insertsText: true, insertedLength: 5, internalPaste: false, accommodation: false, keyInTask: false, composing: false, trustedByApp: false };
const with_ = (over: Partial<ExamContext>): ExamContext => ({ ...base, ...over });

describe("examDecision (P-4 proposal)", () => {
  it.each(["editor", "system-replacement", "cut", "composition"] as const)("lets %s in", (source) => {
    expect(examDecision(source, base)).toBeNull();
  });

  it("refuses a paste from outside the work and lets a paste of text copied in it in", () => {
    expect(examDecision("paste", base)).toBe("pasted-from-outside");
    expect(examDecision("paste", with_({ internalPaste: true }))).toBeNull();
  });

  it("lets a spelling suggestion in, but not a sentence through the same channel", () => {
    expect(examDecision("system-replacement", with_({ insertedLength: 12 }))).toBeNull();
    expect(examDecision("system-replacement", with_({ insertedLength: 200 }))).toBe("long-replacement");
  });

  it("refuses a drop from outside the work", () => {
    expect(examDecision("drop", base)).toBe("dropped");
  });

  it("refuses input without keys, unless an accommodation is approved or keys made the composition", () => {
    expect(examDecision("keyless-input", base)).toBe("keyless-input");
    expect(examDecision("keyless-input", with_({ accommodation: true }))).toBeNull();
    expect(examDecision("keyless-input", with_({ keyInTask: true, composing: true }))).toBeNull();
  });

  it("does not take a real key alone as cover for text without a key event", () => {
    // A tool that answers a real key with a whole sentence.
    expect(examDecision("keyless-input", with_({ keyInTask: true }))).toBe("keyless-input");
    expect(examDecision("keyless-input", with_({ composing: true }))).toBe("keyless-input");
  });

  it("refuses a change no trusted event explains (a script, an extension, a program)", () => {
    expect(examDecision("unattributed", base)).toBe("program");
    // An accommodation covers assistive input, not a program writing.
    expect(examDecision("unattributed", with_({ accommodation: true }))).toBe("program");
  });

  it("trusts the Literatura form only when the application marked the change", () => {
    expect(examDecision("citation-form", base)).toBe("program");
    expect(examDecision("citation-form", with_({ trustedByApp: true }))).toBeNull();
  });

  it("never refuses a change that inserts no text, or one the application makes", () => {
    for (const source of ["paste", "drop", "keyless-input", "unattributed"] as const) {
      expect(examDecision(source, with_({ insertsText: false }))).toBeNull();
      expect(examDecision(source, with_({ trustedByApp: true }))).toBeNull();
    }
  });
});
