import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { directEditSettingMessages } from "../../student/direct-edit-setting/messages.hr";
import { directEditMessages } from "./messages.hr";

describe("direct-edit texts", () => {
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const set of [directEditSettingMessages, directEditMessages])
      for (const value of Object.values(set)) expect(findForbiddenTerms(value, "hr")).toEqual([]);
  });
});
