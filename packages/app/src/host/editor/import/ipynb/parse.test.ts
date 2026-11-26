import { describe, expect, it } from "vitest";

import { IPYNB_MAX_BYTES, IPYNB_MAX_CELLS, parseIpynb } from "./parse.ts";

// Invented notebooks only.
const nb = (cells: unknown[], metadata: unknown = { kernelspec: { name: "python3", language: "python" } }) => JSON.stringify({ nbformat: 4, metadata, cells });
const md = (source: unknown) => ({ cell_type: "markdown", source });

describe("parseIpynb", () => {
  it("reads markdown and code cells, with source as a string or as lines", () => {
    const result = parseIpynb(nb([md(["# Naslov\n", "Tekst"]), { cell_type: "code", source: "x = 1", outputs: [{ output_type: "stream", name: "stdout", text: ["1\n"] }] }]));
    expect(result).toMatchObject({ kind: "ok", notebook: { language: "python" } });
    if (result.kind !== "ok") return;
    expect(result.notebook.cells.map((cell) => [cell.kind, cell.source])).toEqual([["markdown", "# Naslov\nTekst"], ["code", "x = 1"]]);
    expect(result.notebook.cells[1]!.outputs[0]).toMatchObject({ outputType: "stream", text: "1\n" });
  });
  it("falls back to the kernel name and skips raw cells", () => {
    const result = parseIpynb(nb([{ cell_type: "raw", source: "x" }, md("a")], { kernelspec: { name: "IR" } }));
    expect(result.kind === "ok" && [result.notebook.language, result.notebook.cells.length]).toEqual(["ir", 1]);
  });
  it("refuses 201 cells and 1 MiB + 1, and accepts the limits", () => {
    const cell = md("a");
    expect(parseIpynb(nb(Array.from({ length: IPYNB_MAX_CELLS + 1 }, () => cell)))).toEqual({ kind: "refused", reason: "tooManyCells" });
    expect(parseIpynb(nb(Array.from({ length: IPYNB_MAX_CELLS }, () => cell))).kind).toBe("ok");
    const head = '{"cells":[],"x":"';
    const fill = (bytes: number) => head + "a".repeat(bytes - head.length - 2) + '"}';
    expect(fill(IPYNB_MAX_BYTES + 1).length).toBe(IPYNB_MAX_BYTES + 1);
    expect(parseIpynb(fill(IPYNB_MAX_BYTES + 1))).toEqual({ kind: "refused", reason: "tooLarge" });
    expect(parseIpynb(fill(IPYNB_MAX_BYTES)).kind).toBe("ok");
  });
  it("counts bytes, not characters", () => {
    expect(parseIpynb(`{"cells":[],"x":"${"č".repeat(IPYNB_MAX_BYTES / 2)}"}`)).toEqual({ kind: "refused", reason: "tooLarge" });
  });
  it.each(["", "{", "[]", "null", '{"cells":{}}', "{}", nb([null]), nb([md(5)]), nb([{ cell_type: "code", source: "x", outputs: [1] }]), nb([{ cell_type: "code", source: "x", outputs: "a" }])])(
    "gives an error, not a crash, for %s", (text) => { expect(parseIpynb(text)).toEqual({ kind: "refused", reason: "invalid" }); });
});
