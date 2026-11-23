// @vitest-environment jsdom
// PIL-K-SHEMA-V3: the real student page (EditorPageWork with the host's StudentToolbar and
// FootnoteDialogHost, as host/student/work.tsx mounts it) builds the sheet in LocalDocument by the
// work's server-confirmed schema version. A work confirmed as 3 gets the v3 schema, and the toolbar's
// Umetni > Fusnota opens the host's dialog and inserts a footnote node; a work confirmed as 1, any
// other version or none keeps the v1 schema, with no footnote node and no dialog. Another confirmed
// version of the same work is a new sheet (the provider's key). Invented ids and text only.
import type { Editor } from "@tiptap/core";
import { act, createElement, useEffect, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { OpenOutcome, OpenedWork } from "@/client/evidence-ingest";
import { sheetSchemaVersion } from "../../../../../editor-core/src/editor/schema";
import EditorPageWork, { type ToolbarSlot } from "../../../../../../src/components/editor/EditorPageWork.tsx";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { StudentToolbar } from "../toolbar/StudentToolbar";
import { FootnoteDialogHost } from "./FootnoteHost";

const { opened } = vi.hoisted(() => ({ opened: new Map<string, number | undefined>() }));
const SCOPE = "c".repeat(64);
const SESSION = { tag: "izmisljena-sesija-shema", at: 1_000 };
const DOC = "22222222-2222-4222-8222-2222222222c3";

// The page's two readers: the journal scope, then the open answer with the confirmed version.
vi.mock("../../../../../../src/components/editor/EditorPage.scope", () => ({
  readJournalScope: async () => ({ kind: "scope", scope: SCOPE, session: SESSION }),
}));
vi.mock("@/client/evidence-ingest", async (actual) => ({
  ...(await actual<typeof import("@/client/evidence-ingest")>()),
  openWork: async (assignmentId: string): Promise<OpenOutcome> => {
    const version = opened.get(assignmentId);
    const work = { documentId: DOC, ...(version === undefined ? {} : { schemaVersion: version }) } as OpenedWork;
    return { status: "opened", work };
  },
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

let editors: (Editor | null)[] = [];
let mounts = 0;
let unmounts = 0;
/** Inside the provider: hands out the sheet's editor and counts the provider's mounts. */
function Probe({ children }: { children: ReactNode }) {
  const editor = useLocalEditor() as Editor | null;
  useEffect(() => { editors.push(editor); }, [editor]);
  useEffect(() => { mounts += 1; return () => { unmounts += 1; }; }, []);
  return children;
}
const toolbar: ToolbarSlot = (ctx) => createElement(Probe, null, createElement(StudentToolbar, ctx));

let root: Root | null = null;
let host: HTMLDivElement | null = null;
beforeEach(() => {
  // Nothing of the page reaches a server here: every other request is refused.
  vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 503 })));
  // jsdom has no media queries: the page's layout reads a wide screen.
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
});
afterEach(async () => {
  if (root) await act(async () => { root!.unmount(); });
  host?.remove();
  root = null; host = null; editors = []; mounts = 0; unmounts = 0;
  opened.clear();
  vi.unstubAllGlobals();
});

async function render(assignmentId: string) {
  host ??= document.body.appendChild(document.createElement("div"));
  root ??= createRoot(host);
  await act(async () => {
    root!.render(createElement(EditorPageWork, {
      assignmentId, course: "Izmišljeni kolegij", title: "Izmišljeni rad", footnoteDialog: FootnoteDialogHost, toolbar,
    }));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

/** The sheet's editor as the page mounted it, made writable as a loaded journal makes it. */
function sheet(): Editor {
  const editor = editors.findLast((e) => e && !e.isDestroyed);
  expect(editor, "the page mounted a sheet").toBeTruthy();
  return editor!;
}

const button = (label: string) => Array.from(document.querySelectorAll("button, [role=menuitem]"))
  .find((b) => b.textContent?.trim() === label) as HTMLElement | undefined;
const click = async (label: string) => {
  const target = button(label);
  expect(target, label).toBeTruthy();
  await act(async () => { target!.click(); });
};
const footnotesOf = (editor: Editor) => {
  const found: string[] = [];
  editor.state.doc.descendants((node) => { if (node.type.name === "footnote") found.push(node.attrs.text as string); });
  return found;
};

/** Writes a paragraph, then asks the toolbar for a footnote; returns whether the dialog opened. */
async function askForFootnote(editor: Editor) {
  await act(async () => {
    editor.setEditable(true, false);
    editor.commands.setContent("<p>Izmišljeni odlomak rada.</p>", { emitUpdate: false });
    editor.commands.setTextSelection(10);
  });
  await click("Umetni ▾");
  const item = button("Fusnota");
  expect(item, "Umetni > Fusnota").toBeTruthy();
  await act(async () => { item!.click(); });
  return document.querySelector("dialog") !== null;
}

describe("the student's page mounts the sheet's schema by the confirmed version", () => {
  it("uses the editor core's own reading of the version", () => {
    expect([3, 1, 2, 4, undefined, "3", 3.5].map(sheetSchemaVersion)).toEqual([3, 1, 1, 1, 1, 1, 1]);
  });

  it("a work confirmed as 3 gets the v3 sheet, and Umetni > Fusnota inserts a footnote node", async () => {
    opened.set("zadatak-v3", 3);
    await render("zadatak-v3");
    const editor = sheet();
    expect(editor.schema.nodes.footnote).toBeDefined();
    expect(editor.schema.nodes.crossReference).toBeDefined();
    expect(await askForFootnote(editor)).toBe(true);
    const field = document.querySelector("dialog textarea") as HTMLTextAreaElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "Izmišljena bilješka.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await click("Umetni");
    expect(footnotesOf(editor)).toEqual(["Izmišljena bilješka."]);
    expect(document.querySelector("dialog")).toBeNull();
  });

  it.each([["1", 1], ["2", 2], ["4", 4], ["missing", undefined]] as const)(
    "a work confirmed as %s keeps the v1 sheet: no footnote node and no dialog", async (_, version) => {
      opened.set("zadatak-v1", version);
      await render("zadatak-v1");
      const editor = sheet();
      expect(editor.schema.nodes.footnote).toBeUndefined();
      expect(editor.schema.nodes.crossReference).toBeUndefined();
      expect(await askForFootnote(editor)).toBe(false);
      expect(footnotesOf(editor)).toEqual([]);
    });

  it("another confirmed version of the same work mounts a new sheet with that version's schema", async () => {
    opened.set("zadatak-a", 1);
    opened.set("zadatak-b", 3);
    opened.set("zadatak-c", 3);
    await render("zadatak-a");
    expect(sheet().schema.nodes.footnote).toBeUndefined();
    expect([mounts, unmounts]).toEqual([1, 0]);
    // Same session, scope and document; only the confirmed version differs.
    await render("zadatak-b");
    expect(sheet().schema.nodes.footnote).toBeDefined();
    expect([mounts, unmounts]).toEqual([2, 1]);
    // Same version again: the sheet stays the one already mounted.
    await render("zadatak-c");
    expect([mounts, unmounts]).toEqual([2, 1]);
  });
});
