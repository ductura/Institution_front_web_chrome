// @vitest-environment jsdom
// WEB-DIZ-B-V21: the availability is recomputed when a heading's text changes, not only when the toolbar flags do.
import { Editor } from "@tiptap/core";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";

import { createEditorExtensionsV3 } from "../../../../../../editor-core/src/editor/schema";
import { DEFAULT_SECTIONS } from "./skeleton";
import { useSkeletonAvailability } from "./use-skeleton-availability";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let editor: Editor | undefined;
afterEach(() => { editor?.destroy(); document.body.innerHTML = ""; });

it("turns on again when a required heading is renamed", async () => {
  const element = document.createElement("div");
  document.body.append(element);
  const content = DEFAULT_SECTIONS.map((s) => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: s }] }));
  editor = new Editor({ element, extensions: createEditorExtensionsV3(), content: { type: "doc", content } });
  let seen: boolean | undefined;
  const Probe = () => { seen = useSkeletonAvailability(editor!, null).enabled; return null; };
  const root = createRoot(document.createElement("div"));
  await act(async () => { root.render(createElement(Probe)); });
  expect(seen).toBe(false);
  await act(async () => { editor!.commands.insertContentAt(2, "x"); });
  expect(seen).toBe(true);
  act(() => root.unmount());
});
