// WEB-V21-STEM-IPYNB-UVOZ (7a): notebook → blocks of the document. Display only: markdown becomes plain
// paragraphs and headings (never HTML), code stays text in a code block, only `stream` and `text/plain`
// outputs are kept (as a block captioned "Izlaz"); everything else is dropped and counted.
import { isCodeLanguage, type CodeLanguage } from "../../code-block/highlight.ts";
import type { Notebook } from "./parse.ts";

export const OUTPUT_CAPTION = "Izlaz";

export type IpynbBlock =
  | { readonly type: "paragraph"; readonly text: string; readonly imported: true }
  | { readonly type: "heading"; readonly level: 1 | 2 | 3; readonly text: string; readonly imported: true }
  | { readonly type: "codeBlock"; readonly language: CodeLanguage | null; readonly caption: string | null; readonly text: string; readonly imported: true };
export type IpynbConversion = { readonly blocks: IpynbBlock[]; readonly discarded: number };

function markdownBlocks(source: string): IpynbBlock[] {
  const blocks: IpynbBlock[] = [];
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join(" ").trim();
    if (text !== "") blocks.push({ type: "paragraph", text, imported: true });
    lines = [];
  };
  for (const line of source.split(/\r\n|[\r\n]/)) {
    const heading = /^ {0,3}(#{1,6})[ \t]+(.*?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
    if (heading) {
      flush();
      const text = heading[2]!.trim();
      if (text !== "") blocks.push({ type: "heading", level: Math.min(heading[1]!.length, 3) as 1 | 2 | 3, text, imported: true });
    } else if (line.trim() === "") flush();
    else lines.push(line.trim());
  }
  flush();
  return blocks;
}

export function notebookToBlocks(notebook: Notebook): IpynbConversion {
  const language: CodeLanguage | null = isCodeLanguage(notebook.language) ? notebook.language : null;
  const blocks: IpynbBlock[] = [];
  let discarded = 0;
  for (const cell of notebook.cells) {
    if (cell.kind === "markdown") { blocks.push(...markdownBlocks(cell.source)); continue; }
    if (cell.source.trim() !== "") blocks.push({ type: "codeBlock", language, caption: null, text: cell.source.replace(/\n+$/, ""), imported: true });
    const shown: string[] = [];
    for (const output of cell.outputs) {
      if (output.outputType === "stream") { if (output.text !== null && output.text !== "") shown.push(output.text.replace(/\n+$/, "")); continue; }
      const mimes = Object.keys(output.data);
      if ((output.outputType === "execute_result" || output.outputType === "display_data") && output.data["text/plain"] !== undefined) {
        if (output.data["text/plain"] !== "") shown.push(output.data["text/plain"].replace(/\n+$/, ""));
        discarded += mimes.filter((mime) => mime !== "text/plain").length;
      } else discarded += Math.max(mimes.length, 1);
    }
    const text = shown.join("\n").replace(/\n+$/, "");
    if (text.trim() !== "") blocks.push({ type: "codeBlock", language: null, caption: OUTPUT_CAPTION, text, imported: true });
  }
  return { blocks, discarded };
}
