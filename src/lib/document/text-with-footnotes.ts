/** Minimal editor surface needed to read the sheet as plain text. */
export interface TextSource {
  getText(options?: { textSerializers?: Record<string, (props: { node: { attrs: { text?: unknown } } }) => string> }): string;
}

/**
 * Plain text of the sheet with footnotes: each footnote leaves "[n]" in the text and
 * the list "[n] text" follows at the end in order of appearance. A sheet without
 * footnotes (schema v1) returns exactly `getText()`.
 */
export function textWithFootnotes(editor: TextSource): string {
  const notes: string[] = [];
  const body = editor.getText({
    textSerializers: {
      footnote: ({ node }) => {
        notes.push(typeof node.attrs.text === "string" ? node.attrs.text : "");
        return `[${notes.length}]`;
      },
    },
  });
  if (notes.length === 0) return body;
  return `${body}\n\n${notes.map((text, i) => `[${i + 1}] ${text}`).join("\n")}`;
}
