// @vitest-environment jsdom
// ED-97 (prototype right.js scopeBar, vCmt): "Ovo poglavlje / Cijeli rad" and "Još N komentara u drugim poglavljima".
// Invented texts only.
import { Editor } from "@tiptap/core";
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { PREFERENCES_KEY } from "@/components/editor/layout-prefs/preferences";
import { createEditorExtensionsV3, NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/schema";
import { chapterAt } from "./chapter-scope";
import { CommentsPanel, type ChapterScope } from "./CommentsPanel";
import { fakeCommentsPort } from "./fake-port";
import { commentsHr as t } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("comments in this chapter (ED-97)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); root = undefined; document.body.innerHTML = ""; });

  const mount = async (chapter: ChapterScope | undefined) => {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(h(CommentsPanel, { workId: "w", role: "student", port: fakeCommentsPort(), selection: () => null, docSize: () => 100, onJump: () => {}, chapter }));
    });
    return host;
  };
  const press = async (label: string) => { await act(async () => { ([...document.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement).click(); }); };
  const ids = (host: HTMLElement) => [...host.querySelectorAll("li[data-cid]")].map((li) => li.getAttribute("data-cid"));

  it("shows this chapter first and links to the comments elsewhere", async () => {
    const host = await mount({ title: "2. Metoda", from: 50, to: 100 });
    expect(host.textContent).toContain("2. Metoda");
    expect(ids(host)).toEqual(["c2"]);
    expect(host.textContent).toContain(t.moreElsewhere(2));
    await press(t.moreElsewhere(2));
    expect(ids(host)).toEqual(["c1", "c2", "c3"]);
    expect(host.textContent).not.toContain("2. Metoda");
    await press(t.scopeChapter);
    expect(ids(host)).toEqual(["c2"]);
  });

  it("opens on the whole work when the right panel's settings say so (ED-116)", async () => {
    window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ left: { layout: "a", mobile: "c" }, right: { layout: "a", mobile: "same", scope: "all" } }));
    try {
      const host = await mount({ title: "2. Metoda", from: 50, to: 100 });
      expect(ids(host)).toEqual(["c1", "c2", "c3"]);
      await press(t.scopeChapter);
      expect(ids(host)).toEqual(["c2"]);
    } finally {
      window.localStorage.removeItem(PREFERENCES_KEY);
    }
  });

  it("says when the chapter has no comments", async () => {
    const host = await mount({ title: "3. Zaključak", from: 200, to: 300 });
    expect(ids(host)).toEqual([]);
    expect(host.textContent).toContain(t.emptyHere);
    expect(host.textContent).toContain(t.moreElsewhere(3));
  });

  it("outside every chapter shows the whole work and says so; without the text there is no scope", async () => {
    const host = await mount(null);
    expect(ids(host)).toEqual(["c1", "c2", "c3"]);
    expect(host.textContent).toContain(t.noChapter);
    act(() => root?.unmount());
    document.body.innerHTML = "";
    const plain = await mount(undefined);
    expect(plain.textContent).not.toContain(t.scopeChapter);
    expect(ids(plain)).toEqual(["c1", "c2", "c3"]);
  });

  it("finds the chapter under the cursor from the level 2 headings", () => {
    const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
    const node = (type: string, n: number, text: string, level?: number) => ({ type, attrs: { [NODE_ID_ATTRIBUTE]: id(n), ...(level ? { level } : {}) }, content: [{ type: "text", text }] });
    const editor = new Editor({ element: document.createElement("div"), extensions: createEditorExtensionsV3(), content: { type: "doc", content: [
      node("paragraph", 1, "Prije."), node("heading", 2, "Uvod", 2), node("paragraph", 3, "Tekst."), node("heading", 4, "Metoda", 2), node("paragraph", 5, "Još."),
    ] } });
    const doc = editor.state.doc;
    expect(chapterAt(doc, 2)).toBeNull();
    const intro = chapterAt(doc, 10)!;
    expect(intro.title).toBe("1. Uvod");
    const method = chapterAt(doc, doc.content.size - 2)!;
    expect(method).toMatchObject({ title: "2. Metoda", from: intro.to, to: doc.content.size });
    editor.destroy();
  });
});
