import { describe, expect, it } from "vitest";

import type { OpenOutcome, OpenedWork } from "@/client/evidence-ingest";

import { openReadOf } from "./EditorPageWork";

// WEB-14b: what the page does with each answer of evidence.open.post. Invented work only.
const work = { documentId: "doc-izmisljeni-1" } as OpenedWork;
const scopeOf = async (id: string) => `scope:${id}`;

describe("openReadOf", () => {
  it("opens the journal of the opened work, under its scope", async () => {
    expect(await openReadOf({ status: "opened", work }, scopeOf)).toEqual({ kind: "ready", documentId: "doc-izmisljeni-1", scope: "scope:doc-izmisljeni-1" });
  });

  it.each([
    ["unauthenticated", "signedOut"],
    ["not_found", "closed"],
    ["not_accepting", "closed"],
    ["upgrade_required", "reload"],
    ["unavailable", "unavailable"],
  ] as const)("%s mounts no editor (%s)", async (status, kind) => {
    let asked = false;
    const read = await openReadOf({ status } as OpenOutcome, async (id) => { asked = true; return id; });
    expect(read).toEqual({ kind });
    expect(asked).toBe(false);
  });
});
