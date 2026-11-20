import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { canonicalizeJcs } from "../forensics/jcs";
import { FIXTURE_V4 } from "./fixture-v4";
import { REVISION_ZERO_V4_JCS, REVISION_ZERO_V4_SHA256, revisionZeroDocumentV4 } from "./revision-zero";
import { validateDocumentV4 } from "./validate-v4";

/**
 * Golden vectors of document v4 (contract §10 and §12, class 60). The hashes
 * are written down, never recomputed from the code under test: the revision
 * zero hash is the contract's own, the fixture's was computed outside the
 * code with `sha256sum` over `golden-v4-fixture.jcs.txt`.
 */
const FIXTURE_SHA256 = "f4d64d8833a10293221d1d1707e93cfde7b9f497f8491a7f5d2f8ee06e28e351";
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

describe("document v4 golden vectors", () => {
  it("revision zero: JCS and SHA-256 equal the contract's", () => {
    expect(canonicalizeJcs(revisionZeroDocumentV4())).toBe(REVISION_ZERO_V4_JCS);
    expect(sha256(REVISION_ZERO_V4_JCS)).toBe("52da86d9b1344b46cf3028d3cf891bbc78a70a860b4c4e481c792a77b66557d5");
    expect(REVISION_ZERO_V4_SHA256).toBe(sha256(REVISION_ZERO_V4_JCS));
    expect(validateDocumentV4(JSON.parse(REVISION_ZERO_V4_JCS)).ok).toBe(true);
  });

  it("every block, atom and mark: JCS is the recorded text and its hash the recorded one", () => {
    const recorded = readFileSync(new URL("./golden-v4-fixture.jcs.txt", import.meta.url), "utf8");
    expect(canonicalizeJcs(FIXTURE_V4)).toBe(recorded);
    expect(sha256(recorded)).toBe(FIXTURE_SHA256);
  });

  it("the recorded text validates and reads back as itself", () => {
    const recorded = readFileSync(new URL("./golden-v4-fixture.jcs.txt", import.meta.url), "utf8");
    const outcome = validateDocumentV4(JSON.parse(recorded));
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(canonicalizeJcs(outcome.doc)).toBe(recorded);
  });

  it("a number that is not an integer is refused before it can reach a hash", () => {
    const doc = JSON.parse(readFileSync(new URL("./golden-v4-fixture.jcs.txt", import.meta.url), "utf8"));
    doc.nodes[7].widthPercent = 60.5;
    expect(validateDocumentV4(doc).ok).toBe(false);
  });
});
