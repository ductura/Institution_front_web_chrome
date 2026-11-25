import { describe, expect, it } from "vitest";

import { parseIpynb } from "./parse.ts";
import { notebookToBlocks } from "./to-blocks.ts";

const convert = (cells: unknown[], language = "python") => {
  const result = parseIpynb(JSON.stringify({ metadata: { kernelspec: { language } }, cells }));
  if (result.kind !== "ok") throw new Error("invalid fixture");
  return notebookToBlocks(result.notebook);
};
const code = (source: string, outputs: unknown[] = []) => ({ cell_type: "code", source, outputs });

describe("notebookToBlocks", () => {
  it("turns markdown into headings and paragraphs, all as imported", () => {
    const { blocks } = convert([{ cell_type: "markdown", source: "# Prvi\n\nRedak jedan\nredak dva\n\n#### Dubok" }]);
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Prvi", imported: true },
      { type: "paragraph", text: "Redak jedan redak dva", imported: true },
      { type: "heading", level: 3, text: "Dubok", imported: true },
    ]);
  });
  it("keeps a <script> in markdown as plain text", () => {
    const { blocks } = convert([{ cell_type: "markdown", source: "<script>alert(1)</script>" }]);
    expect(blocks).toEqual([{ type: "paragraph", text: "<script>alert(1)</script>", imported: true }]);
  });
  it("takes the language from the kernel only when it is on the list", () => {
    expect(convert([code("a")]).blocks[0]).toMatchObject({ type: "codeBlock", language: "python", caption: null, imported: true });
    expect(convert([code("a")], "julia").blocks[0]).toMatchObject({ language: null });
  });
  it("keeps stream and text/plain as a block captioned Izlaz and drops and counts the rest", () => {
    const { blocks, discarded } = convert([code("print(1)", [
      { output_type: "stream", name: "stdout", text: "1\n" },
      { output_type: "execute_result", data: { "text/plain": "2", "text/html": "<b>2</b>" } },
      { output_type: "display_data", data: { "image/png": "AAAA", "application/javascript": "x" } },
      { output_type: "error", ename: "E", evalue: "v", traceback: [] },
    ])]);
    expect(blocks).toEqual([
      { type: "codeBlock", language: "python", caption: null, text: "print(1)", imported: true },
      { type: "codeBlock", language: null, caption: "Izlaz", text: "1\n2", imported: true },
    ]);
    expect(discarded).toBe(4);
    expect(JSON.stringify(blocks)).not.toContain("<b>");
  });
  it("makes no output block when nothing is left to show", () => {
    const { blocks, discarded } = convert([code("x", [{ output_type: "display_data", data: { "text/html": "<i>a</i>" } }])]);
    expect(blocks).toHaveLength(1);
    expect(discarded).toBe(1);
  });
});
