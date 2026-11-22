import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import type { CanonicalDocument } from "@/domain/document";
import { clientRestorePort, restorableDocument, type RestoreEditor } from "./client-port";
import { waitForReceipt } from "./restore-editor";

// PIL-D7-OBNOVA. Invented text only.
const baseUrl = "https://ductura.example.invalid";
const VERSION_1 = JSON.stringify({ schemaVersion: 1, nodes: [
  { type: "heading", id: "11111111-1111-4111-8111-111111111111", level: 2, children: [{ type: "text", text: "Uvod", marks: [] }] },
  { type: "paragraph", id: "22222222-2222-4222-8222-222222222222", children: [{ type: "text", text: "Izmišljeni odlomak prve verzije.", marks: [] }] },
] });
const listed = (...revisions: number[]) => ({
  versions: revisions.map((revision) => ({ kind: "checkpoint", revision, savedMinute: "2026-11-20T09:15:00.000Z" })),
  nextBeforeRevision: null,
});

/** Serves the two version reads; `heads` is the head the list reports on each read, in order. */
function serving(heads: number[], { status = 200 }: { status?: number } = {}) {
  let read = 0;
  return vi.fn<typeof fetch>(async (url) => {
    const path = new URL(String(url)).pathname;
    if (status !== 200) return Response.json({ code: "unauthenticated" }, { status });
    if (path === "/api/v1/works/rad-1/versions") {
      const head = heads[Math.min(read++, heads.length - 1)]!;
      return Response.json(listed(...Array.from({ length: head }, (_, i) => i + 1)));
    }
    if (path === "/api/v1/works/rad-1/versions/1") return Response.json({ revision: 1, document: VERSION_1 });
    return Response.json({ code: "not_found" }, { status: 404 });
  });
}

function fakeEditor(over: Partial<RestoreEditor> = {}): RestoreEditor & { applied: CanonicalDocument[] } {
  const applied: CanonicalDocument[] = [];
  return {
    applied,
    signedOut: () => false,
    writable: () => true,
    unconfirmed: () => false,
    edits: () => 0,
    apply: (document) => { applied.push(document); return true; },
    confirmed: async () => "confirmed",
    ...over,
  };
}

const paths = (fetchImpl: ReturnType<typeof serving>) =>
  fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${new URL(String(url)).pathname}`);

describe("restore real port (PIL-D7-OBNOVA)", () => {
  it("(1) puts version 1 into the editor once and is saved only on the server's verified receipt; nothing is deleted", async () => {
    const fetchImpl = serving([3]);
    const editor = fakeEditor();
    const outcome = await clientRestorePort(editor, createApi({ baseUrl, fetchImpl })).restore("rad-1", 1, 3);
    expect(outcome).toEqual({ kind: "saved" });
    expect(editor.applied).toEqual([restorableDocument(VERSION_1)]);
    expect(paths(fetchImpl).every((p) => p.startsWith("GET "))).toBe(true);
  });

  it("(2) a stale base gives stale and never touches the newer text", async () => {
    const newer = fakeEditor();
    expect(await clientRestorePort(newer, createApi({ baseUrl, fetchImpl: serving([5]) })).restore("rad-1", 1, 3))
      .toEqual({ kind: "stale", currentRevision: 5 });
    expect(newer.applied).toEqual([]);
    // Text typed in this tab and not yet confirmed is newer than any listed version.
    const typing = fakeEditor({ unconfirmed: () => true });
    const fetchImpl = serving([3]);
    expect(await clientRestorePort(typing, createApi({ baseUrl, fetchImpl })).restore("rad-1", 1, 3))
      .toEqual({ kind: "stale", currentRevision: 3 });
    expect(typing.applied).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
    // Typing that starts during the reads is caught before anything is applied.
    let calls = 0;
    const late = fakeEditor({ unconfirmed: () => calls++ > 0 });
    expect(await clientRestorePort(late, createApi({ baseUrl, fetchImpl: serving([3]) })).restore("rad-1", 1, 3))
      .toEqual({ kind: "stale", currentRevision: 3 });
    expect(late.applied).toEqual([]);
    // A change typed AND confirmed during the reads leaves nothing unconfirmed, but the count moved.
    let count = 0;
    const confirmedMeanwhile = fakeEditor({ edits: () => count++ });
    expect(await clientRestorePort(confirmedMeanwhile, createApi({ baseUrl, fetchImpl: serving([3]) })).restore("rad-1", 1, 3))
      .toEqual({ kind: "stale", currentRevision: 3 });
    expect(confirmedMeanwhile.applied).toEqual([]);
  });

  it("a second restore while the first runs is refused and applies nothing", async () => {
    let release: (value: "confirmed") => void = () => {};
    const editor = fakeEditor({ confirmed: () => new Promise((resolve) => { release = resolve; }) });
    const port = clientRestorePort(editor, createApi({ baseUrl, fetchImpl: serving([3]) }));
    const first = port.restore("rad-1", 1, 3);
    expect(await port.restore("rad-1", 1, 3)).toEqual({ kind: "unavailable" });
    await vi.waitFor(() => expect(editor.applied).toHaveLength(1));
    release("confirmed");
    expect(await first).toEqual({ kind: "saved" });
    expect(editor.applied).toHaveLength(1);
  });

  it("(3) a sign-out gives signedOut and loses nothing", async () => {
    const before = fakeEditor({ signedOut: () => true });
    const none = serving([3]);
    expect(await clientRestorePort(before, createApi({ baseUrl, fetchImpl: none })).restore("rad-1", 1, 3)).toEqual({ kind: "signedOut" });
    expect(none).not.toHaveBeenCalled();
    expect(before.applied).toEqual([]);
    expect(await clientRestorePort(fakeEditor(), createApi({ baseUrl, fetchImpl: serving([3], { status: 401 }) })).restore("rad-1", 1, 3))
      .toEqual({ kind: "signedOut" });
    // Signed out while the receipt was awaited: the text is already in the sheet and the journal.
    const during = fakeEditor({ confirmed: async () => "signedOut" });
    expect(await clientRestorePort(during, createApi({ baseUrl, fetchImpl: serving([3]) })).restore("rad-1", 1, 3)).toEqual({ kind: "signedOut" });
    expect(during.applied).toHaveLength(1);
  });

  it("no receipt in time is pending, never saved", async () => {
    expect(await clientRestorePort(fakeEditor({ confirmed: async () => "waiting" }), createApi({ baseUrl, fetchImpl: serving([3]) })).restore("rad-1", 1, 3))
      .toEqual({ kind: "pending" });
  });

  it("a closed sheet, a refused change or a text the editor cannot take is unavailable", async () => {
    const api = () => createApi({ baseUrl, fetchImpl: serving([3]) });
    expect(await clientRestorePort(fakeEditor({ writable: () => false }), api()).restore("rad-1", 1, 3)).toEqual({ kind: "unavailable" });
    expect(await clientRestorePort(fakeEditor({ apply: () => false }), api()).restore("rad-1", 1, 3)).toEqual({ kind: "unavailable" });
    expect(await clientRestorePort(fakeEditor(), api()).restore("rad-1", 2, 3)).toEqual({ kind: "unavailable" });
    expect(restorableDocument("{")).toBeNull();
    expect(restorableDocument(JSON.stringify({ schemaVersion: 2, nodes: [] }))).toBeNull();
  });

  it("(4) the port reaches no route but the two version reads; the write is the editor's save path", async () => {
    const fetchImpl = serving([3]);
    await clientRestorePort(fakeEditor(), createApi({ baseUrl, fetchImpl })).restore("rad-1", 1, 3);
    expect(new Set(paths(fetchImpl))).toEqual(new Set(["GET /api/v1/works/rad-1/versions", "GET /api/v1/works/rad-1/versions/1"]));
    const imports = (file: string) => [...readFileSync(join(import.meta.dirname, file), "utf8").matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(imports("client-port.ts")).toEqual([
      "../../../../../../../src/client/api.ts", "../../../../../../../src/client/time-machine.ts", "./model", "@/domain/document",
    ].sort());
    // The editor bridge sends nothing itself: no src/client module, only the editor's own provider.
    expect(imports("restore-editor.ts")).toEqual([
      "./client-port", "@/components/editor/LocalDocument", "@/domain/document", "@/editor", "@tiptap/core", "react",
    ].sort());
  });
});

describe("waiting for the receipt", () => {
  const run = (reads: { signedOut: boolean; unconfirmed: boolean }[], withinMs = 1_000) => {
    let i = 0;
    return waitForReceipt(() => reads[Math.min(i++, reads.length - 1)]!, { pollMs: 100, withinMs, schedule: (f) => { queueMicrotask(f); } });
  };
  it("confirms once nothing is unconfirmed, stops at a sign-out and gives up after the limit", async () => {
    expect(await run([{ signedOut: false, unconfirmed: true }, { signedOut: false, unconfirmed: false }])).toBe("confirmed");
    expect(await run([{ signedOut: false, unconfirmed: true }, { signedOut: true, unconfirmed: true }])).toBe("signedOut");
    expect(await run([{ signedOut: false, unconfirmed: true }], 300)).toBe("waiting");
  });
});
