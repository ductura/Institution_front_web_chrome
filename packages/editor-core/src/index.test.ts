import { describe, expect, it } from "vitest";
import * as core from "./index";
import { canonicalizeJcs } from "./document/forensics/jcs";

describe("@ductura/editor-core", () => {
  it("loads through its entry point", () => {
    expect(core.EDITOR_CORE_PACKAGE).toBe("@ductura/editor-core");
  });

  it("makes an empty document that its own validator and snapshot check accept", async () => {
    const doc = core.revisionZeroDocument();
    expect(core.validateDocument(doc).ok).toBe(true);
    expect((await core.verifyDocumentSnapshot(new TextEncoder().encode(canonicalizeJcs(doc)))).ok).toBe(true);
  });

  it("refuses what is not a document", () => {
    for (const value of [null, [], {}, JSON.parse('{"__proto__":{}}'), "doc"]) {
      expect(core.validateDocument(value).ok).toBe(false);
    }
  });
});
