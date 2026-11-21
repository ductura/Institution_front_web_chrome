// @vitest-environment node
import { Editor, type JSONContent } from "@tiptap/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { createEditorExtensionsV4, V4_CORE_EXTENSIONS } from "@/editor";

import { applyBox, applyLanguage, formulaTarget, insertCodeBlock, removeBox, saveFormula, setCodeCaption, setCodeLanguage } from "./block-commands";
import { FormulaDialog } from "./FormulaDialog";
import { FORMULA_GROUPS, HOLE, applyTemplate, hasHoles, nextHole } from "./formula-templates";
import { renderTex } from "./katex-render";
import { richBlocksMessages } from "./messages.hr";

const make = () => {
  const editor = new Editor({
    element: null,
    enableCoreExtensions: V4_CORE_EXTENSIONS,
    extensions: createEditorExtensionsV4(),
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljeni tekst" }] }] } as JSONContent,
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  return editor;
};

describe("renderTex", () => {
  it("renders KaTeX locally with MathML", () => {
    const out = renderTex("\\frac{a}{b}", true);
    expect(out.ok).toBe(true);
    expect(out.html).toContain("katex");
    expect(out.html).toContain("<math");
  });
  it("marks a broken formula and refuses links", () => {
    expect(renderTex("\\frac{", false).ok).toBe(false);
    expect(renderTex("\\href{https://example.test}{x}", false).html).not.toContain("<a ");
    expect(renderTex("   ", false)).toEqual({ html: "", ok: false });
  });
});

describe("templates", () => {
  it("finds and walks the blanks", () => {
    expect(nextHole(`a${HOLE}b${HOLE}`, 0)).toBe(1);
    expect(nextHole(`a${HOLE}b${HOLE}`, 2)).toBe(3);
    expect(nextHole(`a${HOLE}b`, 2)).toBe(1);
    expect(nextHole("ab", 0)).toBe(-1);
    expect(hasHoles("\\frac{□}{1}")).toBe(true);
  });
  it("puts the selection into the first blank and selects the next", () => {
    const r = applyTemplate("x", 0, 1, "\\frac{□}{□}");
    expect(r.tex).toBe("\\frac{x}{□}");
    expect(r.tex.slice(r.caret, r.caretEnd)).toBe(HOLE);
  });
  it("every template renders", () => {
    for (const group of FORMULA_GROUPS) for (const item of group.items) {
      expect(renderTex(item.tex.replaceAll(HOLE, "x"), true).ok, item.label).toBe(true);
    }
  });
});

describe("commands", () => {
  it("inserts and edits a block formula", () => {
    const editor = make();
    const target = formulaTarget(editor, false);
    expect(saveFormula(editor, target, "x^{2}")).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain("x^{2}");
    expect(saveFormula(editor, target, "")).toBe(false);
  });
  it("inserts an inline formula", () => {
    const editor = make();
    expect(saveFormula(editor, formulaTarget(editor, true), "\\alpha")).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain("inlineFormula");
  });
  it("sets code block, language and caption", () => {
    const editor = make();
    expect(insertCodeBlock(editor)).toBe(true);
    expect(setCodeLanguage(editor, "python")).toBe(true);
    expect(setCodeCaption(editor, "Izmišljeni ispis")).toBe(true);
    expect(editor.getAttributes("codeBlock")).toMatchObject({ language: "python", caption: "Izmišljeni ispis" });
  });
  it("wraps, changes and removes a box", () => {
    const editor = make();
    expect(applyBox(editor, "theorem")).toBe(true);
    expect(editor.getAttributes("box").kind).toBe("theorem");
    expect(applyBox(editor, "proof")).toBe(true);
    expect(editor.getAttributes("box").kind).toBe("proof");
    expect(removeBox(editor)).toBe(true);
    expect(editor.isActive("box")).toBe(false);
  });
  it("marks a foreign language only on a selection", () => {
    const editor = make();
    expect(applyLanguage(editor, "la")).toBe(false);
    editor.commands.selectAll();
    expect(applyLanguage(editor, "la")).toBe(true);
    expect(JSON.stringify(editor.getJSON())).toContain('"lang":"la"');
    expect(applyLanguage(editor, null)).toBe(true);
    expect(JSON.stringify(editor.getJSON())).not.toContain('"lang"');
  });
});

describe("FormulaDialog", () => {
  it("renders inline (not modal) with groups and preview text", () => {
    const html = renderToStaticMarkup(
      <FormulaDialog open inline={false} editing={false} initialTex="" onSave={() => true} onClose={() => {}} />,
    );
    expect(html).toContain(richBlocksMessages.formulaTitle);
    expect(html).toContain(richBlocksMessages.groups.greek);
  });
});
