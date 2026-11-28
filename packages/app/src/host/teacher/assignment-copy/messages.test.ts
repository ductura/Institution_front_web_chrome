import { expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { assignmentCopyMessages } from "./messages.hr";

it("uses the P-D4 action label and keeps other copy messages within the terminology rules", () => {
  const { title, errors, ...labels } = assignmentCopyMessages;
  expect(title).toBe("Dupliciraj zadatak");
  for (const text of [...Object.values(labels), ...Object.values(errors)]) {
    expect(findForbiddenTerms(text, "hr"), text).toEqual([]);
  }
});
