import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { journalScopeOf } from "./EditorPage.scope";

// WEB-14b: the interim journal scope is a fixed function of the work's documentId.
const DOC = "doc-izmisljeni-1";

describe("journalScopeOf", () => {
  it("is the SHA-256 hex of the versioned label and the documentId", async () => {
    const expected = createHash("sha256").update(`ductura-journal-scope-v1\n${DOC}`).digest("hex");
    expect(await journalScopeOf(DOC)).toBe(expected);
    expect(await journalScopeOf(DOC)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("differs per work", async () => {
    expect(await journalScopeOf(DOC)).not.toBe(await journalScopeOf("doc-izmisljeni-2"));
  });
});
