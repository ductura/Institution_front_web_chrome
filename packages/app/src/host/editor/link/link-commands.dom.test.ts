// @vitest-environment jsdom
// ED-127: Umetni › Poveznica (prototype acad.js acLink, acLinkDel). Invented text and addresses.
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, it } from "vitest";

import { createEditorExtensionsV3, createEditorExtensionsV4, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { applyLink, linkActive, linkAvailable, normalizeHref, removeLink } from "./link-commands";

const ID = "00000000-0000-4000-8000-000000000001";
let editor: Editor | null = null;
afterEach(() => { editor?.destroy(); editor = null; });

function make(v4 = true) {
  editor = new Editor({
    element: document.createElement("div"), extensions: v4 ? createEditorExtensionsV4() : createEditorExtensionsV3(),
    content: { type: "doc", content: [
      { type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: ID }, content: [{ type: "text", text: "Izmišljeni izvor na mreži." }] },
    ] },
  });
  return editor;
}
const links = (e: Editor) => JSON.stringify(e.getJSON()).match(/"href":"[^"]*"/g) ?? [];

describe("normalizeHref", () => {
  it("adds https:// or mailto: and keeps a scheme the student typed", () => {
    expect(normalizeHref(" primjer.invalid/a ")).toBe("https://primjer.invalid/a");
    expect(normalizeHref("netko@primjer.invalid")).toBe("mailto:netko@primjer.invalid");
    expect(normalizeHref("http://primjer.invalid")).toBe("http://primjer.invalid");
    expect(normalizeHref("javascript:alert(1)")).toBe("javascript:alert(1)");
  });
});

describe("Poveznica na označeni tekst (ED-127)", () => {
  it("puts the link on the selection and takes it off again, the text stays", () => {
    const e = make();
    expect(linkAvailable(e)).toBe(true);
    expect(applyLink(e, "primjer.invalid", { from: 12, to: 17 })).toBe("done");
    expect(links(e)).toEqual(['"href":"https://primjer.invalid"']);
    e.commands.setTextSelection(14);
    expect(linkActive(e)).toBe(true);
    expect(removeLink(e)).toBe(true);
    expect(links(e)).toEqual([]);
    expect(e.getText()).toBe("Izmišljeni izvor na mreži.");
  });
  it("asks for a selection and refuses an address the schema would not keep", () => {
    const e = make();
    e.commands.setTextSelection(3);
    expect(applyLink(e, "primjer.invalid")).toBe("noSelection");
    expect(applyLink(e, "javascript:alert(1)", { from: 12, to: 17 })).toBe("invalid");
    expect(applyLink(e, "primjer.invalid/a b", { from: 12, to: 17 })).toBe("invalid");
    expect(links(e)).toEqual([]);
  });
  it("is off on a v3 work, which has no link mark", () => {
    const e = make(false);
    expect(linkAvailable(e)).toBe(false);
    expect(applyLink(e, "primjer.invalid", { from: 12, to: 17 })).toBe("unavailable");
    expect(removeLink(e)).toBe(false);
  });
});
