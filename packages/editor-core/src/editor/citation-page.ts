import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";

/**
 * ED-105 (prototype features.js; INVENTAR-editor 777): typing ":31" or ":31-35" right after a citation, then a
 * space or one of . , ; ) puts the page in the citation's `locator` and takes the typed ":31" out of the text.
 * One space between the citation and ":" is allowed, because inserting a citation leaves a space after it.
 * A hyphen between two pages becomes an en dash, as the page field suggests ("14–16").
 */
export const CITATION_PAGE_META = "citationPage";
const key = new PluginKey("citationPage");
const TYPED = /^( ?):(\d{1,5}(?:[-–]\d{1,5})?)$/u;
const ENDS = new Set([" ", ".", ",", ";", ")"]);

export function createCitationPage(citation = "citation"): Plugin {
  return new Plugin({
    key,
    props: {
      handleTextInput(view, from, to, text) {
        if (from !== to || !ENDS.has(text) || !view.editable) return false;
        const $from = view.state.doc.resolve(from);
        if (!$from.parent.isTextblock) return false;
        // The text from the node before the cursor up to the cursor, and the citation before it.
        const textNode = $from.nodeBefore;
        if (!textNode?.isText) return false;
        const textStart = from - textNode.nodeSize;
        const $text = view.state.doc.resolve(textStart);
        const before = $text.nodeBefore;
        if (!before || before.type.name !== citation) return false;
        const match = TYPED.exec(textNode.text ?? "");
        if (!match) return false;
        const page = match[2]!.replace("-", "–");
        const citationPos = textStart - before.nodeSize;
        const tr = view.state.tr
          .setNodeMarkup(citationPos, undefined, { ...before.attrs, locator: page })
          .insertText(text === " " ? " " : text, textStart, from);
        tr.setSelection(TextSelection.create(tr.doc, textStart + 1)).setMeta(CITATION_PAGE_META, page);
        view.dispatch(tr.scrollIntoView());
        return true;
      },
    },
  });
}
