// WEB-V21-KOD-POKRETANJE: invented tests for the local preview and the tests (no real work, no personal data).
import type { ReadCodeTests } from "./port.ts";

export const FAKE_CODE_TESTS = [
  { id: "t1", title: "Zbroj dva broja", input: [2, 3], expected: 5 },
  { id: "t2", title: "Zbroj s nulom", input: [0, 7], expected: 7 },
] as const;

export const fakeReadCodeTests: ReadCodeTests = async () => ({
  ok: true,
  body: { revisionNo: 1, language: "javascript", tests: FAKE_CODE_TESTS },
});
