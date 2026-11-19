import { afterEach, describe, expect, it, vi } from "vitest";
import { isConditionalValidityEnabled } from "./conditional-validity";

// Front only (w1119a): the package runs in the browser, where `process` does not exist.
describe("conditional validity flag in the browser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is off, not a ReferenceError, when there is no process", () => {
    vi.stubGlobal("process", undefined);
    expect(isConditionalValidityEnabled()).toBe(false);
  });

  it("is off when process has no env", () => {
    vi.stubGlobal("process", {});
    expect(isConditionalValidityEnabled()).toBe(false);
  });

  it("still reads the env in node", () => {
    vi.stubEnv("CONDITIONAL_VALIDITY", "true");
    expect(isConditionalValidityEnabled()).toBe(true);
    vi.stubEnv("CONDITIONAL_VALIDITY", "false");
    expect(isConditionalValidityEnabled()).toBe(false);
  });
});
