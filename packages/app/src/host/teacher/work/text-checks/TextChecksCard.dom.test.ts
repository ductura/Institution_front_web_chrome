// @vitest-environment jsdom
// ED-130: "U komentar" hands the anchor and the first line to the comments, and says so.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DOCUMENT_SCHEMA_VERSION, paragraphNode, textNode, type CanonicalDocument, type NodeId } from "@/domain/document";

import { textChecksHr as t } from "./messages.hr";
import TextChecksCard from "./TextChecksCard";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}` as NodeId;
const DOC: CanonicalDocument = { schemaVersion: DOCUMENT_SCHEMA_VERSION, nodes: [
  paragraphNode(id(1), [textNode("Park je super mjesto za odmor obitelji, djece i starijih stanovnika kvarta.")]),
] };
const CLEAN: CanonicalDocument = { schemaVersion: DOCUMENT_SCHEMA_VERSION, nodes: [
  paragraphNode(id(1), [textNode("Gradski park ima tri staze, dva igrališta i jedno jezero za šetnju posjetitelja.")]),
] };

describe("TextChecksCard (ED-130)", () => {
  let root: Root | undefined;
  afterEach(() => { act(() => root?.unmount()); document.body.innerHTML = ""; });

  function mount(props: Parameters<typeof TextChecksCard>[0]) {
    const host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    act(() => root?.render(h(TextChecksCard, props)));
    return host;
  }
  const button = (host: HTMLElement) => [...host.querySelectorAll("button")].find((b) => b.textContent === t.toComment);
  const status = (host: HTMLElement) => host.querySelector('section > p[role="status"]')?.textContent;

  it("turns a finding into a new comment on its words", () => {
    const onComment = vi.fn();
    const host = mount({ document: DOC, ready: true, onComment });
    act(() => button(host)!.click());
    expect(onComment).toHaveBeenCalledTimes(1);
    const [anchor, text] = onComment.mock.calls[0]!;
    expect(anchor.nodeId).toBe(id(1));
    expect(anchor.quote).toContain("super");
    expect(text).toBe(t.comment.colloq);
    expect(status(host)).toBe(t.done);
  });

  it("sends nothing while the comments are not ready", () => {
    const onComment = vi.fn();
    const host = mount({ document: DOC, ready: false, onComment });
    act(() => button(host)!.click());
    expect(onComment).not.toHaveBeenCalled();
    expect(status(host)).toBe(t.waiting);
  });

  it("says so when there is nothing to comment", () => {
    const host = mount({ document: CLEAN, ready: true, onComment: vi.fn() });
    expect(button(host)).toBeUndefined();
    expect(host.textContent).toContain(t.empty);
  });
});
