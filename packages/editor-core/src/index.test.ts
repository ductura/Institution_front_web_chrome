import { describe, expect, it } from "vitest";
import * as core from "./index";

describe("@ductura/editor-core", () => {
  it("loads through its entry point", () => {
    expect(core.EDITOR_CORE_PACKAGE).toBe("@ductura/editor-core");
  });
});
