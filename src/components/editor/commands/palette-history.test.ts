// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { paletteActions } from "./palette";
import { offerWorkHistory, workHistoryOffered } from "./work-history-event";

// ED-16 (NF2-P14, review of #667): Ctrl+K offers "Povijest i usporedba" only where a host can open it,
// so on a page without the history host the entry is not there to do nothing.
describe("history entry in the palette", () => {
  it("is offered only while a host knows the document", () => {
    const editor = new Editor({ element: null, extensions: createEditorExtensionsV2(),
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljen tekst." }] }] } });
    const history = () => paletteActions(editor as never, () => {}).find((action) => action.id === "history");
    expect(workHistoryOffered()).toBe(false);
    expect(history()).toBeUndefined();
    const withdraw = offerWorkHistory();
    expect(history()?.disabled).toBe(false);
    withdraw();
    withdraw();
    expect(workHistoryOffered()).toBe(false);
    expect(history()).toBeUndefined();
    editor.destroy();
  });
});
