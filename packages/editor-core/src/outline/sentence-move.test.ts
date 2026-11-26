// @vitest-environment node
import { Editor, type JSONContent } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { Step } from "@tiptap/pm/transform";
import { describe, expect, it } from "vitest";

import { createEditorExtensions, createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../editor/schema";

import { moveSentenceInEditor, planSentenceMove, sentenceSpans, SentenceMove } from "./index";

/** ED-33 (P2-2): Alt+↑/↓ swaps a sentence with its neighbour inside the paragraph. Invented text only. */

const ID = "00000000-0000-4000-8000-000000000001";

function editorWith(text: string, editable = true): Editor {
  return new Editor({
    element: null,
    editable,
    extensions: [...createEditorExtensions(), SentenceMove],
    content: { type: "doc", content: [{ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text }] }] },
  });
}

/** Puts the cursor `offset` characters into the first paragraph. */
function cursorAt(editor: Editor, offset: number): void {
  editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 1 + offset)));
}

const text = (editor: Editor) => editor.state.doc.firstChild!.textContent;

describe("sentenceSpans", () => {
  it("cuts after the end marks and closing quotes, without the spaces around", () => {
    const t = "Park je velik. Ima „klupe.” Zar ne?";
    expect(sentenceSpans(t).map((s) => t.slice(s.from, s.to))).toEqual(["Park je velik.", "Ima „klupe.”", "Zar ne?"]);
  });
  it("keeps a last sentence without an end mark", () => {
    const t = "Prva rečenica. Druga bez točke";
    expect(sentenceSpans(t).map((s) => t.slice(s.from, s.to))).toEqual(["Prva rečenica.", "Druga bez točke"]);
  });
  it("gives nothing for blank text", () => {
    expect(sentenceSpans("   ")).toEqual([]);
  });
  it.each([
    ["the reported short form and decimal", [
      "Rezultat je npr. dobar.", "Vrijednost je 3.14.", "Slijedi zaključak.",
    ]],
    ["decimal comma and thousands separators", [
      "Omjer je 0,25.", "Iznos je 1.234,56 eura.", "Drugi je 1,234.56 eura.",
    ]],
    ["titles, initials and page numbers", [
      "Pišu prof. dr. sc. A. B. Čičak i Lj. Žunić.", "V. Tablicu 3 na str. 14.", "Podaci su izmišljeni.",
    ]],
    ["dotted abbreviations that can end a sentence", [
      "Navodi uzorke, mjere itd.", "Rad o d. o. o. sadrži tablice.", "Zatim navodi uzorke itd. iz drugog rada.",
    ]],
    ["numeric and written dates", [
      "Pokus je bio 12.\u00a03. 2024. u podne.", "Počeo je 5. studenoga 2024. godine.",
      "Završio je 26.11.2026.", "Zapis od 3. stu. 2026. je sačuvan.",
    ]],
    ["quotations and author-date or numbered references", [
      "„Pokus je uspio.” (Čičak, 2024, str. 3. i 4).",
      "„Zašto?” upitao je autor.", "„Uzorak je malen.” (Žunić 2023: 12)",
      "Drugo pitanje glasi: „Zašto?” [12, 14]", "Slijedi zaključak.",
    ]],
    ["parenthetical citations and legal references within a sentence", [
      "To vrijedi i ranije (Čičak, 2024, str. 3. i 4), kao i danas.",
      "Prema čl. 3. st. 2. postupak se ponavlja.",
      "Žunić i sur. (2023) potvrđuju nalaz.", "Tako piše u radu (Čičak, 2024., str. 4.).",
    ]],
    ["closing punctuation and inline atoms", [
      "🙂 „Tako je!”\uFFFC.", "Vrijedi li (vidi [2])?", "Zaključak još nema točku",
    ]],
  ])("keeps %s inside exact UTF-16 ranges", (_label, parts) => {
    const paragraph = `  ${parts.join("\u00a0 ")}  `;
    let from = 2;
    expect(sentenceSpans(paragraph)).toEqual(parts.map((part) => {
      const span = { from, to: from + part.length };
      from = span.to + 2;
      return span;
    }));
  });
});

describe("planSentenceMove", () => {
  const t = "Prva. Druga. Treća.";
  it("swaps with the sentence before or after", () => {
    expect(planSentenceMove(t, 8, "up")).toEqual({ ok: true, first: { from: 0, to: 5 }, second: { from: 6, to: 12 }, moving: "second" });
    expect(planSentenceMove(t, 8, "down")).toEqual({ ok: true, first: { from: 6, to: 12 }, second: { from: 13, to: 19 }, moving: "first" });
  });
  it("refuses at the edges and in a paragraph of one sentence", () => {
    expect(planSentenceMove(t, 1, "up")).toEqual({ ok: false, reason: "first" });
    expect(planSentenceMove(t, 15, "down")).toEqual({ ok: false, reason: "last" });
    expect(planSentenceMove("Samo jedna.", 2, "down")).toEqual({ ok: false, reason: "one-sentence" });
  });
});

describe("moveSentenceInEditor", () => {
  it("moves the sentence up and keeps the cursor at its start", () => {
    const editor = editorWith("Prva. Druga. Treća.");
    cursorAt(editor, 8);
    expect(moveSentenceInEditor(editor, "up")).toBe(true);
    expect(text(editor)).toBe("Druga. Prva. Treća.");
    expect(editor.state.selection.from).toBe(1);
    expect(editor.state.doc.firstChild!.attrs[NODE_ID_ATTRIBUTE]).toBe(ID);
    editor.destroy();
  });
  it("moves the sentence down twice and stops at the end", () => {
    const editor = editorWith("Prva. Druga. Treća.");
    cursorAt(editor, 2);
    expect(moveSentenceInEditor(editor, "down")).toBe(true);
    expect(text(editor)).toBe("Druga. Prva. Treća.");
    expect(moveSentenceInEditor(editor, "down")).toBe(true);
    expect(text(editor)).toBe("Druga. Treća. Prva.");
    expect(moveSentenceInEditor(editor, "down")).toBe(false);
    expect(text(editor)).toBe("Druga. Treća. Prva.");
    editor.destroy();
  });
  it("moves marked text and citation atoms in one captured step and undoes/redoes the full JSON", () => {
    const first: JSONContent[] = [
      { type: "text", text: "🙂 Rezultat je " },
      { type: "text", text: "npr. dobar", marks: [{ type: "bold" }] },
      { type: "citation", attrs: { sourceId: "00000000-0000-4000-8000-000000000009", locator: "14" } },
      { type: "text", text: "." },
    ];
    const second: JSONContent = { type: "text", text: "Vrijednost je 3.14.", marks: [{ type: "italic" }] };
    const gap: JSONContent = { type: "text", text: "\u00a0  " };
    const tail: JSONContent = { type: "text", text: " Slijedi zaključak." };
    const content = (inline: JSONContent[]): JSONContent => ({
      type: "doc",
      content: [
        { type: "paragraph", attrs: { nodeId: ID }, content: inline },
        { type: "paragraph", attrs: { nodeId: "00000000-0000-4000-8000-000000000002" }, content: [{ type: "text", text: "Susjedni odlomak." }] },
      ],
    });
    const editor = new Editor({
      element: null,
      extensions: [...createEditorExtensionsV3(), SentenceMove],
      content: content([...first, gap, second, tail]),
    });
    try {
      editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
      const initial = editor.getJSON();
      const changedSteps: number[] = [];
      let replay = editor.state.doc;
      editor.on("transaction", ({ transaction, appendedTransactions }) => {
        for (const tr of [transaction, ...appendedTransactions]) {
          if (!tr.docChanged) continue;
          changedSteps.push(tr.steps.length);
          for (const step of tr.steps) {
            const result = Step.fromJSON(editor.schema, step.toJSON()).apply(replay);
            expect(result.failed).toBeNull();
            replay = result.doc!;
          }
        }
      });
      cursorAt(editor, "🙂 Rezultat je npr".length);
      expect(moveSentenceInEditor(editor, "down")).toBe(true);
      const moved = editor.getJSON();
      const expected = editor.schema.nodeFromJSON(content([second, gap, ...first, tail])).toJSON();
      expect(moved).toEqual(expected);
      expect(changedSteps).toEqual([1]);
      expect(replay.toJSON()).toEqual(moved);
      expect(editor.state.selection.from).toBe(1 + second.text!.length + gap.text!.length);
      expect(editor.commands.undo()).toBe(true);
      expect(editor.getJSON()).toEqual(initial);
      expect(replay.toJSON()).toEqual(initial);
      expect(editor.commands.redo()).toBe(true);
      expect(editor.getJSON()).toEqual(moved);
      expect(replay.toJSON()).toEqual(moved);
    } finally {
      editor.destroy();
    }
  });

  it("keeps typing immediately before and after a move in their own undo steps", () => {
    const editor = editorWith("Prva. Druga.");
    try {
      editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
      editor.view.dispatch(editor.state.tr.insertText("X", 1));
      expect(moveSentenceInEditor(editor, "down")).toBe(true);
      editor.view.dispatch(editor.state.tr.insertText("Y"));
      expect(text(editor)).toBe("Druga. YXPrva.");
      expect(editor.commands.undo()).toBe(true);
      expect(text(editor)).toBe("Druga. XPrva.");
      expect(editor.commands.undo()).toBe(true);
      expect(text(editor)).toBe("XPrva. Druga.");
      expect(editor.commands.undo()).toBe(true);
      expect(text(editor)).toBe("Prva. Druga.");
    } finally {
      editor.destroy();
    }
  });
  it("does nothing in a read-only work or with a selection", () => {
    const locked = editorWith("Prva. Druga.", false);
    cursorAt(locked, 8);
    expect(moveSentenceInEditor(locked, "up")).toBe(false);
    locked.destroy();
    const editor = editorWith("Prva. Druga.");
    editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc, 7, 10)));
    expect(moveSentenceInEditor(editor, "up")).toBe(false);
    expect(text(editor)).toBe("Prva. Druga.");
    editor.destroy();
  });
});
