// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import CommentBank from "./CommentBank";
import { fakeCommentBankPort, fakeDraftCommentsPort } from "./fake-port";
import { commentBankMessages as text } from "./messages.hr";
import type { CommentBankPort, DraftAnchor } from "./model";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const ANCHOR: DraftAnchor = { nodeId: "n", quote: "q", prefix: "", suffix: "", startHint: 0, endHint: 1 };

async function show(bank: CommentBankPort, anchor: DraftAnchor | null = ANCHOR) {
  const drafts = fakeDraftCommentsPort();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(CommentBank, { assignmentId: "d1", drafts, bank, anchor })); });
  return drafts;
}
const click = async (label: string) => {
  const button = [...host!.querySelectorAll("button")].find((b) => b.textContent === label);
  if (!button) throw new Error(`no button ${label}`);
  await act(async () => { button.click(); });
};
const items = () => [...host!.querySelectorAll("li")].map((li) => li.textContent ?? "");

afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });

describe("CommentBank card (WEB-1704)", () => {
  it("keeps a bank entry listed until the server confirms the removal", async () => {
    const base = fakeCommentBankPort();
    let answer: "unknown" | "removed" = "unknown";
    await show({ read: base.read, remove: async (id) => (answer === "removed" ? base.remove(id) : { kind: "unknown" }) });
    const before = items().length;
    await click(text.remove);
    expect(items().length).toBe(before);
    expect(host!.textContent).toContain(text.unknown);
    answer = "removed";
    await click(text.remove);
    expect(items().length).toBe(before - 1);
  });

  it("offers no draft without a selected text", async () => {
    await show(fakeCommentBankPort(), null);
    expect(host!.textContent).toContain(text.needAnchor);
    expect([...host!.querySelectorAll("button")].find((b) => b.textContent === text.saveDraft)?.disabled).toBe(true);
  });
});
