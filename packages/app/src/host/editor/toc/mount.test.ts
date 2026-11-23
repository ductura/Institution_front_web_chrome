// @vitest-environment jsdom
// PIL-K-SADRZAJ: the table of contents follows the document's headings and a click
// jumps to the chosen heading; the student's editor mounts it and not the old outline.
import { Editor } from "@tiptap/core";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { ChapterNumbers, ChapterMove } from "../../../../../editor-core/src/outline/index.ts";
import { createEditorExtensions, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { TableOfContentsHost } from "./TableOfContentsHost";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const doc = (blocks: ReadonlyArray<readonly [1 | 2 | "p", string]>) => ({
  type: "doc",
  content: blocks.map(([kind, text], i) => ({
    type: kind === "p" ? "paragraph" : "heading",
    attrs: kind === "p" ? { [NODE_ID_ATTRIBUTE]: ID(i + 1) } : { [NODE_ID_ATTRIBUTE]: ID(i + 1), level: kind },
    content: [{ type: "text", text }],
  })),
});

let host: HTMLDivElement | null = null;
let editor: Editor | null = null;
afterEach(() => { host?.remove(); host = null; editor?.destroy(); editor = null; });

const labels = () => Array.from(host!.querySelectorAll("button")).map((b) => b.textContent ?? "");

describe("TableOfContentsHost over a live editor", () => {
  it("lists the headings, follows a new heading and jumps to the chosen one", async () => {
    editor = new Editor({
      element: document.createElement("div"),
      extensions: [...createEditorExtensions(), ChapterNumbers, ChapterMove],
      content: doc([[1, "Uvod"], ["p", "Prvi izmišljeni odlomak."], [1, "Okvir"], ["p", "Drugi odlomak."]]),
    });
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(createElement(TableOfContentsHost, { editor: editor as never })); });
    expect(labels().some((l) => l.includes("Uvod"))).toBe(true);
    expect(labels().some((l) => l.includes("Okvir"))).toBe(true);

    await act(async () => { editor!.commands.setContent(doc([[1, "Uvod"], [1, "Okvir"], [2, "Novi podnaslov"]])); });
    expect(labels().some((l) => l.includes("Novi podnaslov"))).toBe(true);

    const target = Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.includes("Okvir"))!;
    await act(async () => { target.click(); });
    const { $from } = editor.state.selection;
    expect($from.parent.type.name).toBe("heading");
    expect($from.parent.textContent).toBe("Okvir");
    await act(async () => { root.unmount(); });
  });
});

describe("the student's editor", () => {
  const read = (...p: string[]) => readFileSync(join(import.meta.dirname, ...p), "utf8");
  const work = read("..", "..", "student", "work.tsx");
  it("mounts the table of contents in the left panel and never the old HeadingOutline", () => {
    expect(work).toMatch(/chapter: <><TableOfContentsMount \/><ChapterPanel /);
    expect(work).not.toMatch(/HeadingOutline/);
    expect(read("..", "..", "..", "..", "..", "..", "src", "components", "editor", "EditorPageWork.tsx")).not.toMatch(/HeadingOutline/);
  });
});
