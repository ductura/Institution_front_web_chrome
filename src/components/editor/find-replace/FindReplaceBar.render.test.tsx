// @vitest-environment node
import { Editor } from "@tiptap/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { FindReplaceBar } from "./FindReplaceBar";

// The server render has no window for Tiptap's store; the bar falls back to the editor's own state.
vi.mock("@tiptap/react", () => ({ useEditorState: () => null }));

/** WEB-1605 part 2: the bar in Croatian, and no replacing in a locked work. */
function markup(editable: boolean) {
  const editor = new Editor({ element: null, extensions: createEditorExtensionsV2(), editable, content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljen tekst." }] }] } });
  return renderToStaticMarkup(<FindReplaceBar editor={editor as never} onClose={() => {}} />);
}

describe("FindReplaceBar", () => {
  it("offers search, replacement, matching case and both replace buttons", () => {
    const html = markup(true);
    for (const text of ["Traži…", "Zamijeni s…", "Poštuj velika slova", ">Zamijeni<", ">Zamijeni sve<"]) expect(html).toContain(text);
    expect(html).toContain('role="status"');
  });

  it("keeps the replacement field disabled in a locked work", () => {
    const field = (html: string) => html.match(/<input[^>]*placeholder="Zamijeni s…"[^>]*>/)?.[0] ?? "";
    expect(field(markup(false))).toContain('disabled=""');
    expect(field(markup(true))).not.toContain("disabled");
  });
});
