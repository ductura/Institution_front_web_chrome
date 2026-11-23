// @vitest-environment jsdom
// PIL-K-SHEMA-V3: the real sheet (LocalDocument) mounts its editor schema by the work's
// server-confirmed schema version. A v3 work gets the v3 editor, so the host's footnote
// dialog opens and inserts a footnote node; a v1 work keeps exactly the v1 editor, its
// document and its evidence; an unknown or missing version falls back to v1.
// Invented text and ids only.
import { Editor } from "@tiptap/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
  ArrowCollapse, ChapterNumbers, changeOf, createEditorExtensions, EvidenceRecorder, NODE_ID_ATTRIBUTE, SourceObserver,
  StorableInput, tiptapToCanonical, type BuiltSegment,
} from "../../../../../editor-core/src/editor";
import { CroatianQuotes } from "../../../../../editor-core/src/typography/croatian-quotes";
import { sheetExtensions, sheetSchemaOf } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { useV3EditorDialogs } from "../../../../../../src/components/editor/footnotes/useV3EditorDialogs.tsx";
import { messagesHr as t } from "../../../../../../src/lib/i18n/messages.hr";
import { FootnoteDialogHost } from "./FootnoteHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as { requestAnimationFrame?: (cb: () => void) => number }).requestAnimationFrame = (cb) => { cb(); return 0; };
HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close = function close() { this.removeAttribute("open"); };

const ID = "00000000-0000-4000-8000-0000000000a1";
const UTC = Date.parse("2026-11-23T10:00:00.000Z");
const CONTENT = {
  type: "doc",
  content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Izmišljeni odlomak rada." }] }],
};

const editors: Editor[] = [];
let mount: HTMLDivElement | null = null;
afterEach(() => {
  mount?.remove(); mount = null;
  for (const editor of editors.splice(0)) editor.destroy();
});

function sheet(version: unknown): Editor {
  const element = document.createElement("div");
  document.body.append(element);
  const editor = new Editor({ element, extensions: sheetExtensions(sheetSchemaOf(version), new SourceObserver().extension), content: CONTENT });
  editors.push(editor);
  return editor;
}

/** The sheet's extensions as LocalDocument built them before PIL-K-SHEMA-V3. */
function before(): Editor {
  const extensions = [...createEditorExtensions(t.editor.placeholder), StorableInput, ArrowCollapse, ChapterNumbers, CroatianQuotes, new SourceObserver().extension];
  const editor = new Editor({ element: document.createElement("div"), extensions, content: CONTENT });
  editors.push(editor);
  return editor;
}

const button = (label: string) => Array.from(document.querySelectorAll("button")).find((b) => b.textContent === label);

/** Mounts the editor's v3 dialogs with the host's footnote dialog, as the student's toolbar does. */
async function dialogs(editor: Editor, confirmed: number | undefined) {
  let open: ((kind: "footnote" | "crossReference") => boolean) | undefined;
  const Harness = () => {
    const v3 = useV3EditorDialogs(editor as never, confirmed, FootnoteDialogHost as never);
    open = v3.openInsert;
    return createElement("div", null, v3.dialog);
  };
  mount = document.createElement("div");
  document.body.append(mount);
  const root = createRoot(mount);
  await act(async () => { root.render(createElement(Harness)); });
  return { open, unmount: () => act(async () => { root.unmount(); }) };
}

async function segmentOf(editor: Editor): Promise<BuiltSegment> {
  const recorder = new EvidenceRecorder();
  recorder.record(changeOf([editor.state.tr.insertText(" Dopuna.", 25)], "editor", UTC));
  recorder.close();
  return (await recorder.takeSegment({
    documentId: "11111111-1111-4111-8111-1111111111a1", sessionId: "sesija-izmisljena", segmentId: "segment-izmisljeni",
    evidenceProfileId: "profil-izmisljeni", sequenceFrom: 1, predecessorSegmentHash: null,
  }))!;
}

describe("the sheet's schema by the confirmed version", () => {
  it.each([[3, 3], [1, 1], [2, 1], [4, 1], [undefined, 1], [null, 1], ["3", 1], [3.5, 1], [Number.NaN, 1]] as const)(
    "version %s mounts schema v%s", (version, schema) => {
      expect(sheetSchemaOf(version)).toBe(schema);
    });

  it("a v3 work's sheet opens the host's footnote dialog and inserts a footnote node", async () => {
    const editor = sheet(3);
    editor.commands.setTextSelection(10);
    const { open, unmount } = await dialogs(editor, 3);
    expect(open).toBeTypeOf("function");
    await act(async () => { expect(open!("footnote")).toBe(true); });
    expect(document.querySelector("dialog")).toBeTruthy();
    const field = document.querySelector("textarea")!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(field, "Izmišljena bilješka.");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { button("Umetni")!.click(); });
    const footnotes: string[] = [];
    editor.state.doc.descendants((node) => { if (node.type.name === "footnote") footnotes.push(node.attrs.text as string); });
    expect(footnotes).toEqual(["Izmišljena bilješka."]);
    await unmount();
  });

  it.each([1, undefined, 2, 4])("a work confirmed as %s gets no footnote dialog and no footnote node", async (version) => {
    const editor = sheet(version);
    expect(editor.schema.nodes.footnote).toBeUndefined();
    const { open, unmount } = await dialogs(editor, version);
    expect(open).toBeUndefined();
    await unmount();
  });

  it("a v1 work's sheet is the same editor as before: the same schema, document and evidence segment", async () => {
    const now = sheet(1);
    const old = before();
    expect(now.extensionManager.extensions.map((e) => e.name)).toEqual(old.extensionManager.extensions.map((e) => e.name));
    expect(Object.keys(now.schema.nodes)).toEqual(Object.keys(old.schema.nodes));
    expect(Object.keys(now.schema.marks)).toEqual(Object.keys(old.schema.marks));
    expect(tiptapToCanonical(now.getJSON())).toEqual(tiptapToCanonical(old.getJSON()));
    const [a, b] = await Promise.all([segmentOf(now), segmentOf(old)]);
    expect(a.sha256).toBe(b.sha256);
  });
});

describe("the page hands the confirmed version to the sheet", () => {
  const read = (...parts: string[]) => readFileSync(join(import.meta.dirname, "..", "..", "..", "..", "..", "..", ...parts), "utf8");
  const page = read("src", "components", "editor", "EditorPageWork.tsx");
  const local = read("src", "components", "editor", "LocalDocument.tsx");

  it("EditorPageWork passes the open answer's schemaVersion to LocalDocumentProvider and keys it by it", () => {
    expect(page).toMatch(/<LocalDocumentProvider key=\{`[^`]*\$\{read\.schemaVersion \?\? ""\}`\}[^>]* schemaVersion=\{read\.schemaVersion\}>/);
  });

  it("LocalDocument mounts the editor with the extensions of the chosen schema only", () => {
    expect(local).toMatch(/const \[sheet\] = useState\(\(\) => sheetSchemaOf\(schemaVersion\)\);/);
    expect(local).toMatch(/extensions: sheetExtensions\(sheet, observer\.extension\),/);
    expect(local.match(/createEditorExtensions(V3)?\(/g)).toEqual(["createEditorExtensionsV3(", "createEditorExtensions("]);
  });

  it("a v3 sheet never proposes its text through the v1 candidate, journal and evidence", () => {
    expect(local).toMatch(/if \(sheet === 3\) \{\s*setInvalid\(true\);\s*return;\s*\}\s*const candidate = tiptapToCanonical\(/);
  });
});
