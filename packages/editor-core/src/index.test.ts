import { describe, expect, it } from "vitest";

import * as core from "./index";
import { canonicalizeJcs } from "./domain/forensics/jcs";

describe("editor-core entry (888-1): schema and the empty document", () => {
  it("rejects what is not a document first", () => {
    const bad: unknown[] = [
      null, undefined, [], "", 0, true, {}, { nodes: [] }, { schemaVersion: 1 },
      JSON.parse('{"__proto__": {"x": 1}}'), { toString: () => "x" },
    ];
    for (const value of bad) expect(core.validateDocument(value).ok).toBe(false);
    const extra = { ...core.revisionZeroDocument(), constructor: 1 };
    expect(core.validateDocument(extra).ok).toBe(false);
  });

  it("creates the empty document: one empty paragraph that validates", () => {
    const doc = core.revisionZeroDocument();
    expect(doc.nodes).toHaveLength(1);
    expect(doc.nodes[0]!.type).toBe("paragraph");
    expect(core.validateDocument(doc)).toEqual({ ok: true, doc });
  });

  it("verifies the empty document snapshot and rejects altered bytes", async () => {
    const bytes = new TextEncoder().encode(canonicalizeJcs(core.revisionZeroDocument()));
    expect(await core.verifyDocumentSnapshot(bytes)).toMatchObject({ ok: true });
    const altered = new Uint8Array(bytes);
    altered[altered.length - 2] = altered[altered.length - 2]! ^ 1;
    expect(await core.verifyDocumentSnapshot(altered)).toMatchObject({ ok: false });
    expect(core.REVISION_ZERO_JCS).toBe(canonicalizeJcs(core.revisionZeroDocument()));
  });

  it("freezes the public names", () => {
    expect(Object.keys(core).sort()).toEqual([
      "DOCUMENT_BLOCK_TYPES_BY_VERSION",
      "DOCUMENT_SCHEMA_VERSION",
      "DOCUMENT_SCHEMA_VERSION_V2",
      "FORBIDDEN_CODE_POINT_RANGES",
      "MARK_ORDER",
      "MAX_CITATION_LOCATOR_CODE_POINTS",
      "MAX_DOCUMENT_SNAPSHOT_BYTES",
      "MAX_DOCUMENT_SOURCES",
      "MAX_SOURCE_AUTHORS",
      "MAX_SOURCE_EDITORS",
      "MAX_SOURCE_URL_LENGTH",
      "PLAIN_BLOCK_TYPES",
      "REVISION_ZERO_JCS",
      "REVISION_ZERO_NODE_ID",
      "REVISION_ZERO_SHA256",
      "REVISION_ZERO_V2_JCS",
      "REVISION_ZERO_V2_SHA256",
      "SOURCE_TEXT_FIELD_MAX",
      "SOURCE_TYPES",
      "VALIDATION_ERROR_CODES",
      "WHITE_SPACE_CODE_POINT_RANGES",
      "allowedCodePointLength",
      "bulletItemNode",
      "canonicalMarks",
      "citationNode",
      "compareMarks",
      "headingNode",
      "isAcceptedDocumentSchemaVersion",
      "isAllowedText",
      "isAllowedTrimmedText",
      "isForbiddenCodePoint",
      "isHeadingLevel",
      "isMark",
      "isNodeId",
      "isPlainBlockType",
      "isSourceId",
      "isWhiteSpaceCodePoint",
      "marksAreCanonical",
      "marksEqual",
      "newNodeId",
      "paragraphNode",
      "quoteNode",
      "revisionZeroDocument",
      "revisionZeroDocumentV2",
      "textNode",
      "validateDocument",
      "validateVersionedDocument",
      "verifyDocumentSnapshot",
    ]);
  });
});
